import { db, hashApiKey } from '../db/pool.js';
import { config } from '../config/env.js';
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  findActiveSession,
  parseCookies
} from '../services/auth.service.js';

function getBearerToken(request) {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function resolveApiKeyAuth(apiKey) {
  if (apiKey === config.masterAdminKey) {
    return {
      authType: 'api_key',
      tenant: {
        id: 'master_admin',
        name: 'Super Admin',
        is_master: true,
        role: 'superadmin',
        rate_limit_rpm: 10000
      },
      authUser: {
        id: null,
        username: 'master_api_key',
        full_name: 'Super Admin (API Key)',
        role: 'superadmin',
        tenant_id: null,
        is_master: true,
        is_api_key: true
      }
    };
  }

  const keyHash = hashApiKey(apiKey);
  const result = await db.query(
    'SELECT id, name, website_url, api_key_prefix, rate_limit_rpm, is_active, default_viewer_config FROM tenants WHERE api_key_hash = $1',
    [keyHash]
  );

  if (result.rows.length === 0 || !result.rows[0].is_active) {
    return null;
  }

  const rawTenant = result.rows[0];
  let parsedDefaultCfg = {};
  if (rawTenant.default_viewer_config) {
    try {
      parsedDefaultCfg = typeof rawTenant.default_viewer_config === 'string'
        ? JSON.parse(rawTenant.default_viewer_config)
        : rawTenant.default_viewer_config;
    } catch {
      parsedDefaultCfg = {};
    }
  }
  const tenant = {
    ...rawTenant,
    default_viewer_config: parsedDefaultCfg && typeof parsedDefaultCfg === 'object' ? parsedDefaultCfg : {}
  };
  return {
    authType: 'api_key',
    tenant,
    authUser: {
      id: null,
      username: tenant.name,
      full_name: tenant.name,
      role: 'admin',
      tenant_id: tenant.id,
      is_master: false,
      is_api_key: true
    }
  };
}

export async function authenticateRequest(request) {
  const bearer = getBearerToken(request);
  const querySession = request.query?.session_token || null;

  if (bearer && bearer.startsWith('qr3dses_')) {
    const sess = await findActiveSession(bearer);
    if (!sess) return { errorStatus: 401, errorCode: 'INVALID_SESSION' };
    return {
      authType: 'session',
      sessionId: sess.sessionId,
      authUser: sess.user,
      tenant: sess.tenant
    };
  }

  const apiKey = request.headers['x-api-key'] || request.query?.api_key || bearer;
  if (apiKey) {
    const keyAuth = await resolveApiKeyAuth(apiKey);
    if (!keyAuth) return { errorStatus: 403, errorCode: 'INVALID_API_KEY' };
    return keyAuth;
  }

  const cookies = parseCookies(request.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME] || querySession;
  if (cookieToken) {
    const sess = await findActiveSession(cookieToken);
    if (!sess) return { errorStatus: 401, errorCode: 'INVALID_SESSION', clearCookie: true };
    return {
      authType: 'session',
      sessionId: sess.sessionId,
      authUser: sess.user,
      tenant: sess.tenant
    };
  }

  return { errorStatus: 401, errorCode: 'MISSING_AUTH' };
}

export async function requireAuth(request, reply) {
  const res = await authenticateRequest(request);
  if (res.errorStatus) {
    if (res.clearCookie) {
      reply.header('Set-Cookie', buildClearedSessionCookie());
    }
    if (res.errorStatus === 403) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'API Key inválida, revocada o inactiva'
      });
    }
    return reply.status(401).send({
      error: 'Unauthorized',
      message: res.errorCode === 'INVALID_SESSION'
        ? 'Sesión expirada o revocada. Inicia sesión nuevamente.'
        : 'Se requiere iniciar sesión o enviar una API Key válida en x-api-key'
    });
  }

  request.authType = res.authType;
  request.sessionId = res.sessionId || null;
  request.authUser = res.authUser;
  request.tenant = res.tenant;
}

export const requireApiKey = requireAuth;

export function requireRole(...allowedRoles) {
  return async function roleGuard(request, reply) {
    await requireAuth(request, reply);
    if (reply.sent) return;
    if (!request.authUser || !allowedRoles.includes(request.authUser.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'No tienes permisos para realizar esta acción'
      });
    }
  };
}

export async function optionalAuth(request) {
  const res = await authenticateRequest(request).catch(() => null);
  if (res && !res.errorStatus) {
    request.authType = res.authType;
    request.sessionId = res.sessionId || null;
    request.authUser = res.authUser;
    request.tenant = res.tenant;
  }
}

export const optionalApiKey = optionalAuth;
