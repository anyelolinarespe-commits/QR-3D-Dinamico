import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config/env.js';
import { hashPassword } from '../services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let pool = null;
let sqliteDb = null;

const dbStatus = {
  ready: false,
  engine: null,
  location: null,
  error: null,
  startupStats: {
    tenants: 0,
    savedFiles: 0,
    qrItems: 0
  },
  preloadedFiles: [],
  initializedAt: null
};

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    website_url TEXT DEFAULT '',
    api_key_hash TEXT NOT NULL UNIQUE,
    api_key_prefix TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    rate_limit_rpm INTEGER DEFAULT 120,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    full_name TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    created_by_user_id TEXT,
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qr_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    view_token TEXT,
    title TEXT DEFAULT 'Sin título',
    target_url TEXT NOT NULL,
    rotation_strategy TEXT DEFAULT 'one_time',
    scan_count INTEGER DEFAULT 0,
    max_scans INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    color_primary TEXT DEFAULT '#1e293b',
    color_secondary TEXT DEFAULT '#ffffff',
    model_blob BLOB,
    model_filename TEXT,
    model_format TEXT DEFAULT 'glb',
    image_blob BLOB,
    image_mime TEXT DEFAULT 'image/png',
    current_qr_png BLOB,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_files (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    file_kind TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT DEFAULT 'application/octet-stream',
    format TEXT DEFAULT 'glb',
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    file_blob BLOB NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scan_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_id TEXT NOT NULL REFERENCES qr_items(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    scanned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    rotated INTEGER DEFAULT 0,
    target_url TEXT
);

CREATE TABLE IF NOT EXISTS qr_rotation_history (
    id TEXT PRIMARY KEY,
    qr_id TEXT NOT NULL REFERENCES qr_items(id) ON DELETE CASCADE,
    previous_url TEXT,
    new_url TEXT,
    reason TEXT DEFAULT 'scan_exhausted',
    rotated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_items_tenant ON qr_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saved_files_tenant ON saved_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saved_files_hash ON saved_files(tenant_id, sha256, file_kind);
CREATE INDEX IF NOT EXISTS idx_scan_logs_qr ON scan_logs(qr_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_qr_date ON scan_logs(qr_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_tenant_date ON scan_logs(tenant_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_tenants_key_hash ON tenants(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
`;

async function backfillViewTokens() {
  const missing = await db.query(
    `SELECT id, metadata FROM qr_items WHERE view_token IS NULL OR view_token = ''`
  );
  for (const row of missing.rows) {
    let meta = {};
    try {
      meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    } catch {
      meta = {};
    }
    const viewToken = meta.viewToken || ('vw_' + crypto.randomBytes(8).toString('hex'));
    meta.viewToken = viewToken;
    await db.query(
      'UPDATE qr_items SET view_token = $1, metadata = $2 WHERE id = $3',
      [viewToken, JSON.stringify(meta), row.id]
    );
  }
}

function toSqliteSql(sql) {
  return sql
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\$(\d+)\b/g, '?$1');
}

function bindSqliteParam(val) {
  if (val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val instanceof Date) return val.toISOString();
  return val;
}

function normalizeSqliteRow(row) {
  const out = {};
  for (const [key, val] of Object.entries(row)) {
    if (val instanceof Uint8Array) {
      out[key] = Buffer.from(val);
    } else if (
      key === 'is_active' ||
      key === 'rotated' ||
      key === 'user_is_active' ||
      key === 'tenant_is_active'
    ) {
      out[key] = Boolean(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

async function seedDefaultTenant() {
  const devKeyHash = hashApiKey(config.devTenantKey);
  const existingTenant = await db.query('SELECT id FROM tenants WHERE id = $1', ['tenant_default']);
  if (existingTenant.rows.length === 0) {
    await db.query(
      `INSERT INTO tenants (id, name, website_url, api_key_hash, api_key_prefix, is_active, rate_limit_rpm)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['tenant_default', 'Default Dev Tenant', '', devKeyHash, config.devTenantKey.slice(0, 10), true, 300]
    );
    console.log(`🔑 Inquilino por defecto creado con API Key: ${config.devTenantKey}`);
  }
}

async function seedDefaultUsers() {
  const existingSuper = await db.query(
    `SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`
  );
  if (existingSuper.rows.length === 0) {
    const pwdHash = hashPassword(config.superadminPassword);
    await db.query(
      `INSERT INTO users (
        id, username, email, full_name, password_hash, role, tenant_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'usr_superadmin',
        config.superadminUsername,
        config.superadminEmail || null,
        'Super Administrador',
        pwdHash,
        'superadmin',
        null,
        true
      ]
    );
    console.log(`👑 Superadmin inicial listo (usuario: ${config.superadminUsername})`);
  }
}

export async function refreshStartupStats() {
  if (!dbStatus.ready) return dbStatus.startupStats;
  const [tenantsRes, filesRes, qrRes, preloadedRes] = await Promise.all([
    db.query('SELECT COUNT(*) AS cnt FROM tenants'),
    db.query('SELECT COUNT(*) AS cnt FROM saved_files'),
    db.query('SELECT COUNT(*) AS cnt FROM qr_items'),
    db.query(
      `SELECT id, tenant_id, file_kind, filename, mime_type, format, size_bytes, created_at
       FROM saved_files
       ORDER BY created_at DESC`
    )
  ]);

  dbStatus.startupStats = {
    tenants: Number(tenantsRes.rows[0]?.cnt || 0),
    savedFiles: Number(filesRes.rows[0]?.cnt || 0),
    qrItems: Number(qrRes.rows[0]?.cnt || 0)
  };
  dbStatus.preloadedFiles = preloadedRes.rows;
  return dbStatus.startupStats;
}

export async function closeDb() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
  if (sqliteDb) {
    try {
      sqliteDb.close();
    } catch {
      // ignore close errors
    }
    sqliteDb = null;
  }
  dbStatus.ready = false;
  dbStatus.engine = null;
  dbStatus.location = null;
  dbStatus.preloadedFiles = [];
}

export async function initDb(options = {}) {
  await closeDb();
  dbStatus.error = null;
  dbStatus.initializedAt = null;
  dbStatus.startupStats = { tenants: 0, savedFiles: 0, qrItems: 0 };

  const engine = (options.dbEngine || config.dbEngine || 'auto').toLowerCase();
  const targetSqlitePath = options.sqlitePath || config.sqliteDbPath;

  if (engine === 'postgres' || engine === 'auto') {
    try {
      pool = new Pool({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: 3000,
        max: 20
      });

      const client = await pool.connect();
      try {
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        await client.query(schemaSql);
      } finally {
        client.release();
      }

      dbStatus.ready = true;
      dbStatus.engine = 'postgresql';
      dbStatus.location = 'postgresql';
      await seedDefaultTenant();
      await seedDefaultUsers();
      await backfillViewTokens();
      const stats = await refreshStartupStats();
      dbStatus.initializedAt = new Date().toISOString();
      console.log(
        `✅ Conexión exitosa a PostgreSQL (${stats.savedFiles} archivo(s) guardado(s), ${stats.qrItems} QR(s) cargados)`
      );
      return getDbStatus();
    } catch (err) {
      if (pool) {
        await pool.end().catch(() => {});
        pool = null;
      }
      if (engine === 'postgres') {
        dbStatus.ready = false;
        dbStatus.engine = null;
        dbStatus.error = `No se pudo conectar a PostgreSQL: ${err.message}`;
        console.error(`❌ El servicio no se activó (${dbStatus.error})`);
        return getDbStatus();
      }
      console.warn('⚠️  PostgreSQL no disponible en localhost:', err.message);
      console.log(`📦 Activando base de datos SQLite persistente en disco: ${targetSqlitePath}`);
    }
  }

  try {
    if (targetSqlitePath !== ':memory:') {
      fs.mkdirSync(path.dirname(targetSqlitePath), { recursive: true });
    }
    sqliteDb = new DatabaseSync(targetSqlitePath);
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
    if (targetSqlitePath !== ':memory:') {
      sqliteDb.exec('PRAGMA journal_mode = WAL;');
    }
    sqliteDb.exec(SQLITE_SCHEMA);
    const tenantCols = sqliteDb.prepare('PRAGMA table_info(tenants)').all();
    if (!tenantCols.some((c) => c.name === 'website_url')) {
      sqliteDb.exec("ALTER TABLE tenants ADD COLUMN website_url TEXT DEFAULT '';");
    }
    const qrCols = sqliteDb.prepare('PRAGMA table_info(qr_items)').all();
    if (!qrCols.some((c) => c.name === 'view_token')) {
      sqliteDb.exec('ALTER TABLE qr_items ADD COLUMN view_token TEXT;');
    }
    if (!qrCols.some((c) => c.name === 'owner_user_id')) {
      sqliteDb.exec('ALTER TABLE qr_items ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;');
    }
    const fileCols = sqliteDb.prepare('PRAGMA table_info(saved_files)').all();
    if (!fileCols.some((c) => c.name === 'owner_user_id')) {
      sqliteDb.exec('ALTER TABLE saved_files ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;');
    }
    sqliteDb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_items_view_token ON qr_items(view_token);');
    sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_qr_items_owner ON qr_items(owner_user_id);');
    sqliteDb.exec('CREATE INDEX IF NOT EXISTS idx_saved_files_owner ON saved_files(owner_user_id);');

    dbStatus.ready = true;
    dbStatus.engine = 'sqlite';
    dbStatus.location = targetSqlitePath;
    await seedDefaultTenant();
    await seedDefaultUsers();
    await backfillViewTokens();
    const stats = await refreshStartupStats();
    dbStatus.initializedAt = new Date().toISOString();
    console.log(
      `✅ Base de datos SQLite lista (${targetSqlitePath}): ${stats.savedFiles} archivo(s) y ${stats.qrItems} QR(s) cargados al iniciar.`
    );
    return getDbStatus();
  } catch (err) {
    if (sqliteDb) {
      try { sqliteDb.close(); } catch {}
      sqliteDb = null;
    }
    dbStatus.ready = false;
    dbStatus.engine = null;
    dbStatus.location = null;
    dbStatus.error = `Error al abrir la base de datos persistente: ${err.message}`;
    console.error(`❌ El servicio no se activó: ${dbStatus.error}`);
    return getDbStatus();
  }
}

export function getDbStatus() {
  return {
    ...dbStatus,
    startupStats: { ...dbStatus.startupStats },
    preloadedFiles: [...dbStatus.preloadedFiles]
  };
}

export function setDbErrorForTest(message) {
  dbStatus.ready = false;
  dbStatus.error = message || 'Servicio de base de datos desactivado manualmente';
}

export const db = {
  isReady: () => dbStatus.ready,
  isFallback: () => dbStatus.engine === 'sqlite',
  getStatus: () => getDbStatus(),
  getError: () => dbStatus.error,

  async query(text, params = []) {
    if (!dbStatus.ready) {
      const err = new Error(dbStatus.error || 'El servicio no se activó: base de datos no disponible');
      err.code = 'DB_SERVICE_INACTIVE';
      err.statusCode = 503;
      throw err;
    }

    if (dbStatus.engine === 'postgresql' && pool) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        console.error('Database query error:', err.message);
        throw err;
      }
    }

    if (dbStatus.engine === 'sqlite' && sqliteDb) {
      const sql = toSqliteSql(text);
      const bound = params.map(bindSqliteParam);
      const stmt = sqliteDb.prepare(sql);
      const isSelect = /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);

      if (isSelect) {
        const rawRows = stmt.all(...bound);
        const rows = rawRows.map(normalizeSqliteRow);
        return { rows, rowCount: rows.length };
      }

      const info = stmt.run(...bound);
      return { rows: [], rowCount: Number(info.changes || 0) };
    }

    const err = new Error('Motor de base de datos no inicializado');
    err.code = 'DB_SERVICE_INACTIVE';
    err.statusCode = 503;
    throw err;
  }
};
