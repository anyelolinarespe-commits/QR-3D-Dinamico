import { db } from '../db/pool.js';
import { eventBus } from '../config/redis.js';

/**
 * Registra el guard de activación de servicio y el endpoint /health.
 * Si la base de datos no logró inicializarse, bloquea las rutas API/Scan con HTTP 503
 * indicando claramente que el servicio no se activó.
 */
export function registerServiceHealthAndGuard(server) {
  server.addHook('onRequest', async (request, reply) => {
    const url = request.url || '';
    const needsDb = url.startsWith('/api/') || url.startsWith('/scan/') || url.startsWith('/view/');
    if (needsDb && !db.isReady()) {
      return reply.status(503).send({
        error: 'SERVICE_INACTIVE',
        serviceActive: false,
        databaseReady: false,
        message: 'El servicio no se activó: la base de datos no está disponible.',
        detail: db.getError() || 'Base de datos sin inicializar'
      });
    }
  });

  server.get('/health', async (request, reply) => {
    const status = db.getStatus();
    if (!status.ready) {
      return reply.status(503).send({
        status: 'inactive',
        serviceActive: false,
        databaseReady: false,
        storageMode: 'inactive',
        error: `El servicio no se activó: ${status.error || 'Base de datos no disponible'}`,
        redisConnected: eventBus.isRedisConnected,
        timestamp: new Date().toISOString()
      });
    }

    return reply.send({
      status: 'ok',
      serviceActive: true,
      databaseReady: true,
      storageMode: status.engine === 'postgresql' ? 'postgresql-cluster' : 'sqlite-persistent',
      databaseEngine: status.engine,
      databaseLocation: status.location,
      startupStats: status.startupStats,
      preloadedFilesCount: status.startupStats.savedFiles,
      redisConnected: eventBus.isRedisConnected,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    });
  });
}
