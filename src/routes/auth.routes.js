import { db } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  createUserSession,
  deleteSessionByToken,
  hashPassword,
  parseCookies,
  serializeUser,
  verifyPassword
} from '../services/auth.service.js';

export async function authRoutes(fastify) {
  // Iniciar sesión con usuario o correo y contraseña
  fastify.post('/api/auth/login', async (request, reply) => {
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const rawIdentifier = String(body.identifier || body.username || body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!rawIdentifier || !password) {
      return reply.status(400).send({
        error: 'Se requiere usuario (o correo) y contraseña'
      });
    }

    const res = await db.query(
      `SELECT u.*,
              t.name AS tenant_name,
              t.website_url AS tenant_website_url,
              t.is_active AS tenant_is_active,
              t.api_key_prefix AS tenant_api_key_prefix
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.username) = $1 OR LOWER(u.email) = $1
       LIMIT 1`,
      [rawIdentifier]
    );

    if (res.rows.length === 0) {
      return reply.status(401).send({
        error: 'Credenciales inválidas'
      });
    }

    const userRow = res.rows[0];
    if (!verifyPassword(password, userRow.password_hash)) {
      return reply.status(401).send({
        error: 'Credenciales inválidas'
      });
    }

    if (!userRow.is_active) {
      return reply.status(403).send({
        error: 'Tu cuenta está desactivada. Contacta a tu administrador.'
      });
    }

    if (userRow.role !== 'superadmin' && (!userRow.tenant_id || !userRow.tenant_is_active)) {
      return reply.status(403).send({
        error: 'El sitio web asociado a tu cuenta está desactivado o suspendido.'
      });
    }

    const session = await createUserSession(userRow.id);
    reply.header('Set-Cookie', buildSessionCookie(session.rawToken, session.maxAgeSec));

    return reply.send({
      success: true,
      token: session.rawToken,
      expiresAt: session.expiresAt,
      user: serializeUser(userRow)
    });
  });

  // Cerrar sesión actual
  fastify.post('/api/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
    const cookies = parseCookies(request.headers.cookie);
    const rawToken = (bearer && bearer.startsWith('qr3dses_')) ? bearer : cookies[SESSION_COOKIE_NAME];

    if (rawToken) {
      await deleteSessionByToken(rawToken);
    }

    reply.header('Set-Cookie', buildClearedSessionCookie());
    return reply.send({ success: true });
  });

  // Obtener perfil y rol autenticado actual
  fastify.get('/api/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    return reply.send({
      authenticated: true,
      authType: request.authType,
      user: request.authUser,
      tenant: request.tenant
    });
  });

  // Cambiar contraseña propia (solo sesiones de usuario)
  fastify.post('/api/auth/change-password', { preHandler: [requireAuth] }, async (request, reply) => {
    if (!request.authUser || !request.authUser.id) {
      return reply.status(400).send({
        error: 'Esta acción requiere iniciar sesión como usuario'
      });
    }

    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const currentPassword = typeof body.current_password === 'string' ? body.current_password : '';
    const newPassword = typeof body.new_password === 'string' ? body.new_password : '';

    if (!currentPassword || newPassword.length < 6) {
      return reply.status(400).send({
        error: 'Ingresa tu contraseña actual y una nueva contraseña de al menos 6 caracteres'
      });
    }

    const res = await db.query('SELECT id, password_hash FROM users WHERE id = $1', [request.authUser.id]);
    if (res.rows.length === 0 || !verifyPassword(currentPassword, res.rows[0].password_hash)) {
      return reply.status(401).send({
        error: 'La contraseña actual es incorrecta'
      });
    }

    const nextHash = hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [nextHash, request.authUser.id]
    );

    if (request.sessionId) {
      await db.query(
        'DELETE FROM user_sessions WHERE user_id = $1 AND id <> $2',
        [request.authUser.id, request.sessionId]
      );
    }

    return reply.send({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  });
}
