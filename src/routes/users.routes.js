import crypto from 'crypto';
import { db } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import {
  VALID_ROLES,
  deleteUserSessions,
  generateReadablePassword,
  hashPassword,
  serializeUser
} from '../services/auth.service.js';

function normalizeUsername(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  if (!/^[a-z0-9._@-]{3,120}$/.test(clean)) {
    const err = new Error(
      'El usuario debe tener entre 3 y 120 caracteres válidos (letras, números, ".", "_", "-" o "@")'
    );
    err.statusCode = 400;
    throw err;
  }
  return clean;
}

function normalizeEmail(raw) {
  if (raw === undefined || raw === null) return null;
  const clean = String(raw).trim().toLowerCase();
  if (!clean) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    const err = new Error('El correo electrónico no tiene un formato válido');
    err.statusCode = 400;
    throw err;
  }
  return clean;
}

async function ensureUniqueUserFields({ username, email, excludeUserId = null }) {
  if (username) {
    const uRes = excludeUserId
      ? await db.query('SELECT id FROM users WHERE LOWER(username) = $1 AND id <> $2 LIMIT 1', [username, excludeUserId])
      : await db.query('SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1', [username]);
    if (uRes.rows.length > 0) {
      const err = new Error(`El usuario "${username}" ya está en uso`);
      err.statusCode = 409;
      throw err;
    }
  }
  if (email) {
    const eRes = excludeUserId
      ? await db.query('SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1', [email, excludeUserId])
      : await db.query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [email]);
    if (eRes.rows.length > 0) {
      const err = new Error(`El correo "${email}" ya está registrado`);
      err.statusCode = 409;
      throw err;
    }
  }
}

export async function usersRoutes(fastify) {
  // Listar usuarios según jerarquía (superadmin ve todos; admin solo los usuarios 3D de su sitio)
  fastify.get('/api/users', { preHandler: [requireRole('superadmin', 'admin')] }, async (request, reply) => {
    const actor = request.authUser;
    const isSuper = actor.role === 'superadmin';
    const filterTenantId = isSuper && request.query?.tenant_id ? String(request.query.tenant_id) : null;
    const filterRole = isSuper && request.query?.role && VALID_ROLES.has(request.query.role)
      ? request.query.role
      : null;

    const where = [];
    const params = [];

    if (isSuper) {
      if (filterTenantId) {
        params.push(filterTenantId);
        where.push(`u.tenant_id = $${params.length}`);
      }
      if (filterRole) {
        params.push(filterRole);
        where.push(`u.role = $${params.length}`);
      }
    } else {
      params.push(actor.tenant_id);
      where.push(`u.tenant_id = $${params.length}`);
      where.push(`u.role = 'user'`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const res = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.tenant_id,
              u.is_active, u.last_login_at, u.created_at,
              t.name AS tenant_name, t.website_url AS tenant_website_url,
              (SELECT COUNT(*) FROM qr_items q WHERE q.owner_user_id = u.id) AS qr_count,
              (SELECT COUNT(*) FROM saved_files f WHERE f.owner_user_id = u.id) AS file_count
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       ${whereClause}
       ORDER BY u.created_at DESC`,
      params
    );

    return reply.send({
      users: res.rows.map(serializeUser)
    });
  });

  // Crear usuario (superadmin crea admins/users/superadmins; admin solo crea users en su sitio)
  fastify.post('/api/users', { preHandler: [requireRole('superadmin', 'admin')] }, async (request, reply) => {
    const actor = request.authUser;
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const isSuper = actor.role === 'superadmin';

    let targetRole = body.role ? String(body.role).trim().toLowerCase() : 'user';
    if (!VALID_ROLES.has(targetRole)) {
      return reply.status(400).send({ error: 'Rol inválido. Usa superadmin, admin o user.' });
    }

    if (!isSuper) {
      if (targetRole !== 'user') {
        return reply.status(403).send({
          error: 'Un administrador de sitio solo puede crear cuentas de Usuario 3D (rol "user")'
        });
      }
      if (body.tenant_id && body.tenant_id !== actor.tenant_id) {
        return reply.status(403).send({
          error: 'No puedes crear usuarios para otro sitio web'
        });
      }
    }

    let targetTenantId = isSuper ? (body.tenant_id || null) : actor.tenant_id;
    if (targetRole === 'superadmin') {
      targetTenantId = null;
    } else {
      if (!targetTenantId) {
        return reply.status(400).send({ error: 'Se requiere asignar un sitio web (tenant_id) al usuario' });
      }
      const tRes = await db.query('SELECT id, name, website_url FROM tenants WHERE id = $1', [targetTenantId]);
      if (tRes.rows.length === 0) {
        return reply.status(404).send({ error: 'El sitio web especificado no existe' });
      }
    }

    let username;
    let email;
    try {
      username = normalizeUsername(body.username);
      email = normalizeEmail(body.email);
      await ensureUniqueUserFields({ username, email });
    } catch (err) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }

    const fullName = String(body.full_name || body.name || username).trim().slice(0, 255);
    const shouldGeneratePwd = Boolean(body.generate_password) || !body.password;
    const plainPassword = body.password
      ? String(body.password)
      : (body.generate_password ? generateReadablePassword(12) : '');

    if (!plainPassword || plainPassword.length < 6) {
      return reply.status(400).send({
        error: 'Proporciona una contraseña de al menos 6 caracteres o marca generar contraseña automática'
      });
    }

    const passwordHash = hashPassword(plainPassword);
    const userId = 'usr_' + crypto.randomBytes(6).toString('hex');
    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

    await db.query(
      `INSERT INTO users (
        id, username, email, full_name, password_hash, role, tenant_id, created_by_user_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, username, email, fullName, passwordHash, targetRole, targetTenantId, actor.id || null, isActive]
    );

    const createdRes = await db.query(
      `SELECT u.*, t.name AS tenant_name, t.website_url AS tenant_website_url
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [userId]
    );

    return reply.status(201).send({
      success: true,
      user: serializeUser(createdRes.rows[0]),
      ...(shouldGeneratePwd ? { generatedPassword: plainPassword } : {})
    });
  });

  // Editar usuario, activar/desactivar o restablecer contraseña
  fastify.patch('/api/users/:userId', { preHandler: [requireRole('superadmin', 'admin')] }, async (request, reply) => {
    const actor = request.authUser;
    const { userId } = request.params;
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const isSuper = actor.role === 'superadmin';

    const existingRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (existingRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Usuario no encontrado' });
    }
    const target = existingRes.rows[0];

    if (!isSuper) {
      if (target.tenant_id !== actor.tenant_id || target.role !== 'user') {
        return reply.status(403).send({
          error: 'Solo puedes gestionar Usuarios 3D pertenecientes a tu propio sitio web'
        });
      }
      if (body.role && body.role !== 'user') {
        return reply.status(403).send({ error: 'No tienes permiso para cambiar el rol del usuario' });
      }
      if (body.tenant_id && body.tenant_id !== actor.tenant_id) {
        return reply.status(403).send({ error: 'No tienes permiso para mover el usuario a otro sitio' });
      }
    }

    let nextRole = target.role;
    if (isSuper && body.role !== undefined) {
      const candidateRole = String(body.role).trim().toLowerCase();
      if (!VALID_ROLES.has(candidateRole)) {
        return reply.status(400).send({ error: 'Rol inválido' });
      }
      if (target.id === actor.id && candidateRole !== 'superadmin') {
        return reply.status(400).send({ error: 'No puedes quitarte el rol de superadmin a ti mismo' });
      }
      nextRole = candidateRole;
    }

    let nextTenantId = target.tenant_id;
    if (isSuper && body.tenant_id !== undefined) {
      nextTenantId = body.tenant_id || null;
    }
    if (nextRole === 'superadmin') {
      nextTenantId = null;
    } else {
      if (!nextTenantId) {
        return reply.status(400).send({ error: 'Los roles admin y user deben pertenecer a un sitio web' });
      }
      const tRes = await db.query('SELECT id FROM tenants WHERE id = $1', [nextTenantId]);
      if (tRes.rows.length === 0) {
        return reply.status(404).send({ error: 'El sitio web especificado no existe' });
      }
    }

    let nextUsername = target.username;
    let nextEmail = target.email;
    try {
      if (body.username !== undefined) nextUsername = normalizeUsername(body.username);
      if (body.email !== undefined) nextEmail = normalizeEmail(body.email);
      await ensureUniqueUserFields({
        username: nextUsername !== target.username ? nextUsername : null,
        email: nextEmail !== target.email ? nextEmail : null,
        excludeUserId: target.id
      });
    } catch (err) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }

    const nextFullName = body.full_name !== undefined
      ? String(body.full_name || '').trim().slice(0, 255)
      : target.full_name;
    const nextIsActive = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(target.is_active);
    if (target.id === actor.id && !nextIsActive) {
      return reply.status(400).send({ error: 'No puedes desactivar tu propia cuenta activa' });
    }

    let nextPasswordHash = target.password_hash;
    let generatedPassword = null;
    let passwordChanged = false;
    if (body.reset_password === true) {
      generatedPassword = generateReadablePassword(12);
      nextPasswordHash = hashPassword(generatedPassword);
      passwordChanged = true;
    } else if (typeof body.password === 'string' && body.password.length > 0) {
      if (body.password.length < 6) {
        return reply.status(400).send({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }
      nextPasswordHash = hashPassword(body.password);
      passwordChanged = true;
    }

    await db.query(
      `UPDATE users
       SET username = $1,
           email = $2,
           full_name = $3,
           password_hash = $4,
           role = $5,
           tenant_id = $6,
           is_active = $7,
           updated_at = NOW()
       WHERE id = $8`,
      [nextUsername, nextEmail, nextFullName, nextPasswordHash, nextRole, nextTenantId, nextIsActive, userId]
    );

    if (!nextIsActive || passwordChanged || nextRole !== target.role || nextTenantId !== target.tenant_id) {
      await deleteUserSessions(userId);
    }

    const updatedRes = await db.query(
      `SELECT u.*, t.name AS tenant_name, t.website_url AS tenant_website_url
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [userId]
    );

    return reply.send({
      success: true,
      user: serializeUser(updatedRes.rows[0]),
      ...(generatedPassword ? { generatedPassword } : {})
    });
  });

  // Eliminar usuario
  fastify.delete('/api/users/:userId', { preHandler: [requireRole('superadmin', 'admin')] }, async (request, reply) => {
    const actor = request.authUser;
    const { userId } = request.params;
    const isSuper = actor.role === 'superadmin';

    if (userId === actor.id) {
      return reply.status(400).send({ error: 'No puedes eliminar tu propio usuario' });
    }

    const existingRes = await db.query('SELECT id, role, tenant_id FROM users WHERE id = $1', [userId]);
    if (existingRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Usuario no encontrado' });
    }
    const target = existingRes.rows[0];

    if (!isSuper && (target.tenant_id !== actor.tenant_id || target.role !== 'user')) {
      return reply.status(403).send({ error: 'No tienes permiso para eliminar este usuario' });
    }

    await deleteUserSessions(userId);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    return reply.send({ success: true, message: 'Usuario eliminado correctamente' });
  });
}
