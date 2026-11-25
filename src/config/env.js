import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const port = parseInt(process.env.PORT || '3000', 10);
const rawPublicBase = (process.env.PUBLIC_BASE_URL || '').trim();
const publicBaseUrl =
  !rawPublicBase || (port !== 3000 && rawPublicBase === 'http://localhost:3000')
    ? `http://localhost:${port}`
    : rawPublicBase.replace(/\/+$/, '');

export const config = {
  port,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration ('auto' | 'postgres' | 'sqlite')
  dbEngine: (process.env.DB_ENGINE || 'auto').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qr3d_db',
  sqliteDbPath: process.env.SQLITE_DB_PATH || path.join(projectRoot, 'data', 'qr3d.sqlite'),
  
  // Redis configuration
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Storage & Limits
  maxModelSizeMb: parseInt(process.env.MAX_MODEL_SIZE_MB || '100', 10),
  maxImageSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB || '20', 10),
  
  // Server public URL (used for QR redirects and view links)
  publicBaseUrl,

  // Master key for initial setup & tenant management
  masterAdminKey: process.env.MASTER_ADMIN_KEY || 'master_admin_secret_key_2026',

  // Default dev tenant key
  devTenantKey: process.env.DEV_TENANT_KEY || 'tk_live_demo_123456789',

  // Initial Superadmin account & session TTL for web login
  superadminUsername: (process.env.SUPERADMIN_USERNAME || 'superadmin').trim().toLowerCase(),
  superadminEmail: (process.env.SUPERADMIN_EMAIL || 'superadmin@3dqr.local').trim().toLowerCase(),
  superadminPassword: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin2026!',
  sessionTtlHours: Math.max(1, parseInt(process.env.SESSION_TTL_HOURS || '168', 10) || 168)
};
