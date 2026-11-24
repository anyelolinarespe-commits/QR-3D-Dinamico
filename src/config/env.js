import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qr3d_db',
  
  // Redis configuration
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Storage & Limits
  maxModelSizeMb: parseInt(process.env.MAX_MODEL_SIZE_MB || '100', 10),
  maxImageSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB || '20', 10),
  
  // Server public URL (used for QR redirects)
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',

  // Master key for initial setup & tenant management
  masterAdminKey: process.env.MASTER_ADMIN_KEY || 'master_admin_secret_key_2026',

  // Default dev tenant key
  devTenantKey: process.env.DEV_TENANT_KEY || 'tk_live_demo_123456789'
};
