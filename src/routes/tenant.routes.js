import crypto from 'crypto';
import { db, hashApiKey } from '../db/pool.js';
import { requireApiKey } from '../middleware/auth.js';

export async function tenantRoutes(fastify, options) {
  // Información del tenant actual
  fastify.get('/api/tenants/me', { preHandler: [requireApiKey] }, async (request, reply) => {
    return reply.send({
      tenant: request.tenant
    });
  });

  // Crear un nuevo tenant (solo con Master Admin Key)
  fastify.post('/api/tenants', { preHandler: [requireApiKey] }, async (request, reply) => {
    if (!request.tenant.is_master) {
      return reply.status(403).send({ error: 'Solo el administrador principal puede crear inquilinos' });
    }

    const { name, rate_limit_rpm } = request.body || {};
    if (!name) {
      return reply.status(400).send({ error: 'El nombre del inquilino es requerido' });
    }

    const tenantId = 't_' + crypto.randomBytes(6).toString('hex');
    const rawApiKey = 'tk_live_' + crypto.randomBytes(16).toString('hex');
    const keyHash = hashApiKey(rawApiKey);
    const prefix = rawApiKey.slice(0, 10);

    await db.query(
      `INSERT INTO tenants (id, name, api_key_hash, api_key_prefix, is_active, rate_limit_rpm)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, name, keyHash, prefix, true, rate_limit_rpm || 120]
    );

    return reply.status(201).send({
      success: true,
      tenant: {
        id: tenantId,
        name,
        apiKey: rawApiKey, // Se muestra una sola vez
        prefix,
        rate_limit_rpm: rate_limit_rpm || 120
      }
    });
  });
}
