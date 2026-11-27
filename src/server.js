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
import { registerServiceHealthAndGuard } from './middleware/serviceGuard.js';
import { qrRoutes } from './routes/qr.routes.js';
import { filesRoutes } from './routes/files.routes.js';
import { scanRoutes } from './routes/scan.routes.js';
import { tenantRoutes } from './routes/tenant.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { viewRoutes } from './routes/view.routes.js';
import { startQrRotationScheduler, stopQrRotationScheduler } from './services/qrScheduler.service.js';

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
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
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

    // 5. Guard de servicio activo, Healthcheck y Rutas API
    registerServiceHealthAndGuard(server);
    await server.register(authRoutes);
    await server.register(usersRoutes);
    await server.register(qrRoutes);
    await server.register(filesRoutes);
    await server.register(scanRoutes);
    await server.register(tenantRoutes);
    await server.register(viewRoutes);

    server.addHook('onClose', async () => {
      stopQrRotationScheduler();
    });

    // 6. Redirigir raíz al panel de administración
    server.get('/', async (request, reply) => {
      return reply.redirect('/admin/', 302);
    });

    // Iniciar servidor
    await server.listen({ port: config.port, host: config.host });
    startQrRotationScheduler(1000);
    const dbStatus = db.getStatus();
    if (!dbStatus.ready) {
      console.error(`\n[ERROR] ADVERTENCIA CRÍTICA: El servicio HTTP inició, pero la base de datos NO se activó (${dbStatus.error}).`);
      console.error('   Las rutas API devolverán 503 SERVICE_INACTIVE hasta activar la base de datos.\n');
    } else {
      console.log(
        `[DB] Base de datos activa (${dbStatus.engine}): ${dbStatus.startupStats.savedFiles} archivo(s) y ${dbStatus.startupStats.qrItems} QR(s) cargados.`
      );
    }
    console.log(`\n[API] Servidor API 3D-QR escuchando en http://localhost:${config.port}`);
    console.log(`[WIDGET] Widget JS disponible en: http://localhost:${config.port}/widget/3dqr-viewer.js`);
    console.log(`[ADMIN] Panel Administrativo en: http://localhost:${config.port}/admin/`);
    console.log(`[DEMO] Proyecto de Ejemplo en: http://localhost:${config.port}/example/\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

bootstrap();
