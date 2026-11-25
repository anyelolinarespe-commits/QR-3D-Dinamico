import crypto from 'crypto';
import { db } from '../db/pool.js';
import { config } from '../config/env.js';

export const SESSION_COOKIE_NAME = 'qr3d_session';
export const VALID_ROLES = new Set(['superadmin', 'admin', 'user']);

export function hashPassword(password) {
  const plain = String(password || '');
  if (plain.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function generateReadablePassword(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function hashSessionToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function buildSessionCookie(rawToken, maxAgeSec) {
  const secureFlag = config.nodeEnv === 'production' && config.publicBaseUrl.startsWith('https://')
    ? '; Secure'
    : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(60, Math.floor(maxAgeSec))}${secureFlag}`;
}

export function buildClearedSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function createUserSession(userId) {
  const sessionId = 'ses_' + crypto.randomBytes(8).toString('hex');
  const rawToken = 'qr3dses_' + crypto.randomBytes(24).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const maxAgeSec = config.sessionTtlHours * 3600;
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000).toISOString();

  await db.query(
    `INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, userId, tokenHash, expiresAt]
  );

  await db.query(
    `UPDATE users SET last_login_at = $1, updated_at = NOW() WHERE id = $2`,
    [new Date().toISOString(), userId]
  );

  return { sessionId, rawToken, expiresAt, maxAgeSec };
}

export async function deleteSessionByToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
}

export async function deleteUserSessions(userId) {
  if (!userId) return;
  await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
}

export async function deleteTenantUserSessions(tenantId) {
  if (!tenantId) return;
  await db.query(
    'DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)',
    [tenantId]
  );
}

export async function findActiveSession(rawToken) {
  if (!rawToken || !String(rawToken).startsWith('qr3dses_')) return null;
  const tokenHash = hashSessionToken(rawToken);
  const res = await db.query(
    `SELECT s.id AS session_id,
            s.expires_at AS session_expires_at,
            u.id,
            u.username,
            u.email,
            u.full_name,
            u.role,
            u.tenant_id,
            u.is_active AS user_is_active,
            u.last_login_at,
            u.created_at,
            t.name AS tenant_name,
            t.website_url AS tenant_website_url,
            t.is_active AS tenant_is_active,
            t.rate_limit_rpm AS tenant_rate_limit_rpm,
            t.api_key_prefix AS tenant_api_key_prefix
     FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN tenants t ON t.id = u.tenant_id
     WHERE s.token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const expMs = Date.parse(row.session_expires_at);
  if (Number.isNaN(expMs) || expMs <= Date.now()) {
    await db.query('DELETE FROM user_sessions WHERE id = $1', [row.session_id]).catch(() => {});
    return null;
  }

  if (!row.user_is_active) {
    return null;
  }

  if (row.role !== 'superadmin') {
    if (!row.tenant_id || !row.tenant_is_active) {
      return null;
    }
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.id,
      username: row.username,
      email: row.email || null,
      full_name: row.full_name || row.username,
      role: row.role,
      tenant_id: row.tenant_id || null,
      is_active: Boolean(row.user_is_active),
      is_master: row.role === 'superadmin',
      last_login_at: row.last_login_at || null,
      created_at: row.created_at
    },
    tenant: row.role === 'superadmin'
      ? {
          id: 'master_admin',
          name: 'Super Admin',
          is_master: true,
          role: 'superadmin',
          rate_limit_rpm: 10000
        }
      : {
          id: row.tenant_id,
          name: row.tenant_name,
          website_url: row.tenant_website_url || '',
          rate_limit_rpm: Number(row.tenant_rate_limit_rpm || 120),
          is_active: Boolean(row.tenant_is_active),
          api_key_prefix: row.tenant_api_key_prefix || ''
        }
  };
}

export function serializeUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email || null,
    full_name: row.full_name || row.username,
    role: row.role,
    tenant_id: row.tenant_id || null,
    tenant_name: row.tenant_name || (row.role === 'superadmin' ? 'Plataforma Global' : null),
    tenant_website_url: row.tenant_website_url || '',
    tenant_api_key_prefix: row.role === 'admin' || row.role === 'superadmin' ? (row.tenant_api_key_prefix || '') : undefined,
    is_active: Boolean(row.is_active !== undefined ? row.is_active : row.user_is_active),
    last_login_at: row.last_login_at || null,
    created_at: row.created_at,
    qrCount: row.qr_count !== undefined ? Number(row.qr_count) : undefined,
    fileCount: row.file_count !== undefined ? Number(row.file_count) : undefined
  };
}
