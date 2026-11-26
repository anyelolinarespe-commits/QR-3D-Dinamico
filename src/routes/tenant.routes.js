import crypto from 'crypto';
import { db, hashApiKey, refreshStartupStats } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  deleteTenantUserSessions,
  generateReadablePassword,
  hashPassword,
  serializeUser
} from '../services/auth.service.js';
import { sanitizeTenantDefaultConfig } from '../services/viewerConfig.service.js';

function sanitizeWebsiteUrl(raw) {
  if (raw === undefined || raw === null) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 500);
  return `https://${trimmed}`.slice(0, 500);
}

function parseTenantDefaultConfig(raw) {
  return sanitizeTenantDefaultConfig(raw);
}

export async function tenantRoutes(fastify) {
  // Información del sitio/tenant actual
  fastify.get('/api/tenants/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const defaultConfig = parseTenantDefaultConfig(request.tenant.default_viewer_config);
    if (request.authUser?.role === 'user') {
      return reply.send({
        tenant: {
          id: request.tenant.id,
          name: request.tenant.name,
          website_url: request.tenant.website_url || '',
          is_active: Boolean(request.tenant.is_active),
          default_viewer_config: defaultConfig
        }
      });
    }
    return reply.send({
      tenant: {
        ...request.tenant,
        default_viewer_config: defaultConfig
      }
    });
  });

  // Actualizar nombre, URL o tema visual por defecto del sitio web administrado (Administrador de sitio)
  fastify.patch('/api/tenants/me', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const current = request.tenant;
    const nextName = body.name !== undefined ? String(body.name || '').trim() : current.name;
    if (!nextName) {
      return reply.status(400).send({ error: 'El nombre del sitio es requerido' });
    }
    const nextWebsite = body.website_url !== undefined
      ? sanitizeWebsiteUrl(body.website_url)
      : (current.website_url || '');
    const nextDefaultConfig = body.default_viewer_config !== undefined
      ? parseTenantDefaultConfig(body.default_viewer_config)
      : parseTenantDefaultConfig(current.default_viewer_config);

    await db.query(
      'UPDATE tenants SET name = $1, website_url = $2, default_viewer_config = $3 WHERE id = $4',
      [nextName, nextWebsite, JSON.stringify(nextDefaultConfig), current.id]
    );

    const refreshed = await db.query(
      'SELECT id, name, website_url, api_key_prefix, is_active, rate_limit_rpm, default_viewer_config, created_at FROM tenants WHERE id = $1',
      [current.id]
    );
    const row = refreshed.rows[0];

    return reply.send({
      success: true,
      tenant: {
        ...row,
        default_viewer_config: parseTenantDefaultConfig(row.default_viewer_config)
      }
    });
  });

  // Regenerar API Key del propio sitio (Administrador de sitio)
  fastify.post('/api/tenants/me/rotate-key', { preHandler: [requireRole('admin')] }, async (request, reply) => {
    const rawApiKey = 'tk_live_' + crypto.randomBytes(16).toString('hex');
    const keyHash = hashApiKey(rawApiKey);
    const prefix = rawApiKey.slice(0, 10);

    await db.query(
      'UPDATE tenants SET api_key_hash = $1, api_key_prefix = $2 WHERE id = $3',
      [keyHash, prefix, request.tenant.id]
    );

    return reply.send({
      success: true,
      tenantId: request.tenant.id,
      apiKey: rawApiKey,
      prefix
    });
  });

  // Listar todos los sitios/tenants (solo Superadmin)
  fastify.get('/api/tenants', { preHandler: [requireRole('superadmin')] }, async (request, reply) => {
    const res = await db.query(
      `SELECT t.id, t.name, t.website_url, t.api_key_prefix, t.is_active, t.rate_limit_rpm, t.default_viewer_config, t.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.role = 'admin') AS admin_count,
              (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.role = 'user') AS user_count,
              (SELECT COUNT(*) FROM qr_items q WHERE q.tenant_id = t.id) AS qr_count,
              (SELECT COUNT(*) FROM saved_files f WHERE f.tenant_id = t.id) AS file_count,
              (SELECT COALESCE(SUM(q.scan_count), 0) FROM qr_items q WHERE q.tenant_id = t.id) AS total_scans
       FROM tenants t
       ORDER BY t.created_at DESC`
    );

    return reply.send({
      tenants: res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        website_url: r.website_url || '',
        api_key_prefix: r.api_key_prefix,
        is_active: Boolean(r.is_active),
        rate_limit_rpm: Number(r.rate_limit_rpm || 120),
        default_viewer_config: parseTenantDefaultConfig(r.default_viewer_config),
        created_at: r.created_at,
        adminCount: Number(r.admin_count || 0),
        userCount: Number(r.user_count || 0),
        qrCount: Number(r.qr_count || 0),
        fileCount: Number(r.file_count || 0),
        totalScans: Number(r.total_scans || 0)
      }))
    });
  });

  // Crear un nuevo tenant / sitio web (y opcionalmente su Administrador inicial) — solo Superadmin
  fastify.post('/api/tenants', { preHandler: [requireRole('superadmin')] }, async (request, reply) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const name = String(body.name || '').trim();
    const rateLimitRpm = Math.max(10, parseInt(body.rate_limit_rpm || '120', 10) || 120);
    const websiteUrl = sanitizeWebsiteUrl(body.website_url);
    const defaultViewerConfig = parseTenantDefaultConfig(body.default_viewer_config);

    if (!name) {
      return reply.status(400).send({ error: 'El nombre del sitio/inquilino es requerido' });
    }

    const adminPayload = body.admin_user && typeof body.admin_user === 'object' ? body.admin_user : null;
    let adminUsername = null;
    let adminEmail = null;
    let adminFullName = null;
    let adminPlainPassword = null;
    let adminGeneratedPassword = false;

    if (adminPayload) {
      adminUsername = String(adminPayload.username || '').trim().toLowerCase();
      if (!/^[a-z0-9._@-]{3,120}$/.test(adminUsername)) {
        return reply.status(400).send({
          error: 'El usuario del administrador debe tener entre 3 y 120 caracteres válidos'
        });
      }
      adminEmail = adminPayload.email ? String(adminPayload.email).trim().toLowerCase() : null;
      if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        return reply.status(400).send({ error: 'El correo del administrador no es válido' });
      }
      adminFullName = String(adminPayload.full_name || adminUsername).trim();
      adminGeneratedPassword = Boolean(adminPayload.generate_password) || !adminPayload.password;
      adminPlainPassword = adminPayload.password
        ? String(adminPayload.password)
        : (adminPayload.generate_password ? generateReadablePassword(12) : '');
      if (!adminPlainPassword || adminPlainPassword.length < 6) {
        return reply.status(400).send({
          error: 'La contraseña del administrador debe tener al menos 6 caracteres'
        });
      }

      const dupUser = await db.query('SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1', [adminUsername]);
      if (dupUser.rows.length > 0) {
        return reply.status(409).send({ error: `El usuario "${adminUsername}" ya está en uso` });
      }
      if (adminEmail) {
        const dupEmail = await db.query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [adminEmail]);
        if (dupEmail.rows.length > 0) {
          return reply.status(409).send({ error: `El correo "${adminEmail}" ya está registrado` });
        }
      }
    }

    const tenantId = 't_' + crypto.randomBytes(6).toString('hex');
    const rawApiKey = 'tk_live_' + crypto.randomBytes(16).toString('hex');
    const keyHash = hashApiKey(rawApiKey);
    const prefix = rawApiKey.slice(0, 10);

    await db.query(
      `INSERT INTO tenants (id, name, website_url, api_key_hash, api_key_prefix, is_active, rate_limit_rpm, default_viewer_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, name, websiteUrl, keyHash, prefix, true, rateLimitRpm, JSON.stringify(defaultViewerConfig)]
    );

    let createdAdmin = null;
    if (adminPayload) {
      const adminId = 'usr_' + crypto.randomBytes(6).toString('hex');
      const pwdHash = hashPassword(adminPlainPassword);
      await db.query(
        `INSERT INTO users (
          id, username, email, full_name, password_hash, role, tenant_id, created_by_user_id, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [adminId, adminUsername, adminEmail, adminFullName, pwdHash, 'admin', tenantId, request.authUser?.id || null, true]
      );
      const uRes = await db.query(
        `SELECT u.*, t.name AS tenant_name, t.website_url AS tenant_website_url
         FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1`,
        [adminId]
      );
      createdAdmin = serializeUser(uRes.rows[0]);
    }

    await refreshStartupStats();

    return reply.status(201).send({
      success: true,
      tenant: {
        id: tenantId,
        name,
        website_url: websiteUrl,
        apiKey: rawApiKey, // Se muestra una sola vez
        prefix,
        rate_limit_rpm: rateLimitRpm,
        default_viewer_config: defaultViewerConfig,
        is_active: true
      },
      ...(createdAdmin ? { adminUser: createdAdmin } : {}),
      ...(createdAdmin && adminGeneratedPassword ? { generatedPassword: adminPlainPassword } : {})
    });
  });

  // Editar sitio/tenant (solo Superadmin)
  fastify.patch('/api/tenants/:tenantId', { preHandler: [requireRole('superadmin')] }, async (request, reply) => {
    const { tenantId } = request.params;
    const body = request.body && typeof request.body === 'object' ? request.body : {};

    const existingRes = await db.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (existingRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Sitio / tenant no encontrado' });
    }
    const existing = existingRes.rows[0];

    const nextName = body.name !== undefined ? String(body.name || '').trim() : existing.name;
    if (!nextName) {
      return reply.status(400).send({ error: 'El nombre del sitio no puede estar vacío' });
    }
    const nextWebsite = body.website_url !== undefined
      ? sanitizeWebsiteUrl(body.website_url)
      : (existing.website_url || '');
    const nextActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(existing.is_active);
    const nextRpm = body.rate_limit_rpm !== undefined
      ? Math.max(10, parseInt(body.rate_limit_rpm, 10) || 120)
      : Number(existing.rate_limit_rpm || 120);
    const nextDefaultConfig = body.default_viewer_config !== undefined
      ? parseTenantDefaultConfig(body.default_viewer_config)
      : parseTenantDefaultConfig(existing.default_viewer_config);

    await db.query(
      'UPDATE tenants SET name = $1, website_url = $2, is_active = $3, rate_limit_rpm = $4, default_viewer_config = $5 WHERE id = $6',
      [nextName, nextWebsite, nextActive, nextRpm, JSON.stringify(nextDefaultConfig), tenantId]
    );

    if (!nextActive) {
      await deleteTenantUserSessions(tenantId);
    }

    const updated = await db.query(
      'SELECT id, name, website_url, api_key_prefix, is_active, rate_limit_rpm, default_viewer_config, created_at FROM tenants WHERE id = $1',
      [tenantId]
    );
    const updatedRow = updated.rows[0];
    return reply.send({
      success: true,
      tenant: {
        ...updatedRow,
        default_viewer_config: parseTenantDefaultConfig(updatedRow.default_viewer_config)
      }
    });
  });

  // Rotar API Key de un sitio específico (solo Superadmin)
  fastify.post('/api/tenants/:tenantId/rotate-key', { preHandler: [requireRole('superadmin')] }, async (request, reply) => {
    const { tenantId } = request.params;
    const existingRes = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    if (existingRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Sitio / tenant no encontrado' });
    }

    const rawApiKey = 'tk_live_' + crypto.randomBytes(16).toString('hex');
    const keyHash = hashApiKey(rawApiKey);
    const prefix = rawApiKey.slice(0, 10);

    await db.query(
      'UPDATE tenants SET api_key_hash = $1, api_key_prefix = $2 WHERE id = $3',
      [keyHash, prefix, tenantId]
    );

    return reply.send({
      success: true,
      tenantId,
      apiKey: rawApiKey,
      prefix
    });
  });

  // Eliminar sitio/tenant personalizado (solo Superadmin)
  fastify.delete('/api/tenants/:tenantId', { preHandler: [requireRole('superadmin')] }, async (request, reply) => {
    const { tenantId } = request.params;
    if (tenantId === 'tenant_default') {
      return reply.status(400).send({ error: 'No se puede eliminar el sitio principal por defecto' });
    }
    await deleteTenantUserSessions(tenantId);
    const del = await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
    if (del.rowCount === 0) {
      return reply.status(404).send({ error: 'Sitio / tenant no encontrado' });
    }
    await refreshStartupStats();
    return reply.send({ success: true, message: 'Sitio web y sus recursos eliminados' });
  });
}
