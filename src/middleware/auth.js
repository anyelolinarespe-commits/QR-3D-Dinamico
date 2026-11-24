import { db, hashApiKey } from '../db/pool.js';
import { config } from '../config/env.js';

export async function requireApiKey(request, reply) {
  const apiKey =
    request.headers['x-api-key'] ||
    request.query.api_key ||
    (request.headers.authorization && request.headers.authorization.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null);

  if (!apiKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Se requiere una API Key válida en el encabezado x-api-key o parámetro api_key'
    });
  }

  // Master admin check
  if (apiKey === config.masterAdminKey) {
    request.tenant = {
      id: 'master_admin',
      name: 'Super Admin',
      is_master: true,
      rate_limit_rpm: 10000
    };
    return;
  }

  const keyHash = hashApiKey(apiKey);
  const result = await db.query(
    'SELECT id, name, rate_limit_rpm, is_active FROM tenants WHERE api_key_hash = $1',
    [keyHash]
  );

  if (result.rows.length === 0 || !result.rows[0].is_active) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'API Key inválida, revocada o inactiva'
    });
  }

  request.tenant = result.rows[0];
}

export async function optionalApiKey(request, reply) {
  const apiKey =
    request.headers['x-api-key'] ||
    request.query.api_key ||
    (request.headers.authorization && request.headers.authorization.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null);

  if (!apiKey) return;

  if (apiKey === config.masterAdminKey) {
    request.tenant = { id: 'master_admin', name: 'Super Admin', is_master: true };
    return;
  }

  const keyHash = hashApiKey(apiKey);
  const result = await db.query(
    'SELECT id, name, rate_limit_rpm, is_active FROM tenants WHERE api_key_hash = $1',
    [keyHash]
  );

  if (result.rows.length > 0 && result.rows[0].is_active) {
    request.tenant = result.rows[0];
  }
}
