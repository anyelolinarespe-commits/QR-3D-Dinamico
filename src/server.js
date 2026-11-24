import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/env.js';
import { initDb, db } from './db/pool.js';
import { eventBus } from './config/redis.js';
import { qrRoutes } from './routes/qr.routes.js';
import { scanRoutes } from './routes/scan.routes.js';
import { tenantRoutes } from './routes/tenant.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const server = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn'
  },
  bodyLimit: config.maxModelSizeMb * 1024 * 1024
});

async function bootstrap() {
  try {
    // 1. Inicializar DB & Redis
    await initDb();
    await eventBus.init();

    // 2. Seguridad & CORS
    await server.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    await server.register(helmet, {
      contentSecurityPolicy: false, // Permitir Three.js CDN y Web Components incrustados
      crossOriginEmbedderPolicy: false
    });

    // 3. Multipart para subir modelos 3D e imágenes
    await server.register(multipart, {
      limits: {
        fileSize: config.maxModelSizeMb * 1024 * 1024
      }
    });

    // 4. Archivos estáticos: Widget, Panel Admin y Proyecto de Ejemplo
    await server.register(fastifyStatic, {
      root: path.join(rootDir, 'widget'),
      prefix: '/widget/',
      decorateReply: false
    });

    await server.register(fastifyStatic, {
      root: path.join(rootDir, 'admin'),
      prefix: '/admin/',
      decorateReply: false
    });

    await server.register(fastifyStatic, {
      root: path.join(rootDir, 'example-project'),
      prefix: '/example/',
      decorateReply: false
    });

    // 5. Rutas API
    await server.register(qrRoutes);
    await server.register(scanRoutes);
    await server.register(tenantRoutes);

    // 6. Health check
    server.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        storageMode: db.isFallback() ? 'embedded-resilient' : 'postgresql-cluster',
        redisConnected: eventBus.isRedisConnected
      };
    });

    // 7. Redirigir raíz al panel de administración
    server.get('/', async (request, reply) => {
      return reply.redirect('/admin/', 302);
    });

    // Iniciar servidor
    await server.listen({ port: config.port, host: config.host });
    console.log(`\n🚀 Servidor API 3D-QR escuchando en http://localhost:${config.port}`);
    console.log(`📱 Widget JS disponible en: http://localhost:${config.port}/widget/3dqr-viewer.js`);
    console.log(`🖥️  Panel Administrativo en: http://localhost:${config.port}/admin/`);
    console.log(`🎪 Proyecto de Ejemplo en: http://localhost:${config.port}/example/\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

bootstrap();
