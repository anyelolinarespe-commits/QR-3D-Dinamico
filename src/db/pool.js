import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let pool = null;
let useFallbackStorage = false;

// Fallback in-memory / disk store for environments without active PostgreSQL
const mockStore = {
  tenants: new Map(),
  qr_items: new Map(),
  scan_logs: [],
  qr_rotation_history: []
};

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function initDb() {
  try {
    pool = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 3000,
      max: 20
    });

    // Test connection
    const client = await pool.connect();
    console.log('✅ Conexión exitosa a PostgreSQL');

    // Run schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schemaSql);

    // Seed default developer tenant if not exists
    const devKeyHash = hashApiKey(config.devTenantKey);
    const existingTenant = await client.query('SELECT id FROM tenants WHERE id = $1', ['tenant_default']);
    if (existingTenant.rows.length === 0) {
      await client.query(
        `INSERT INTO tenants (id, name, api_key_hash, api_key_prefix, is_active, rate_limit_rpm)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['tenant_default', 'Default Dev Tenant', devKeyHash, config.devTenantKey.slice(0, 10), true, 300]
      );
      console.log(`🔑 Inquilino por defecto creado con API Key: ${config.devTenantKey}`);
    }

    client.release();
  } catch (err) {
    console.warn('⚠️  PostgreSQL no detectado en localhost o falló la conexión:', err.message);
    console.log('📦 Activando adaptador de almacenamiento embebido resiliente (Zero-config local mode)');
    useFallbackStorage = true;

    // Seed default tenant in mock store
    const devKeyHash = hashApiKey(config.devTenantKey);
    mockStore.tenants.set('tenant_default', {
      id: 'tenant_default',
      name: 'Default Dev Tenant',
      api_key_hash: devKeyHash,
      api_key_prefix: config.devTenantKey.slice(0, 10),
      is_active: true,
      rate_limit_rpm: 300,
      created_at: new Date()
    });
  }
}

export const db = {
  isFallback: () => useFallbackStorage,

  async query(text, params = []) {
    if (!useFallbackStorage && pool) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        console.error('Database query error:', err.message);
        throw err;
      }
    }

    // Emulated queries for local standalone dev without postgres
    const normalizedText = text.replace(/\s+/g, ' ').trim();

    // SELECT FROM tenants WHERE api_key_hash = $1
    if (normalizedText.includes('FROM tenants WHERE api_key_hash = $1')) {
      const hash = params[0];
      for (const tenant of mockStore.tenants.values()) {
        if (tenant.api_key_hash === hash && tenant.is_active) {
          return { rows: [tenant] };
        }
      }
      return { rows: [] };
    }

    // SELECT FROM tenants WHERE id = $1
    if (normalizedText.includes('FROM tenants WHERE id = $1')) {
      const id = params[0];
      const tenant = mockStore.tenants.get(id);
      return { rows: tenant ? [tenant] : [] };
    }

    // INSERT INTO qr_items
    if (normalizedText.startsWith('INSERT INTO qr_items')) {
      const [
        id, tenant_id, title, target_url, rotation_strategy,
        scan_count, max_scans, is_active, color_primary, color_secondary,
        model_blob, model_filename, model_format, image_blob, image_mime,
        current_qr_png, metadata
      ] = params;

      const item = {
        id, tenant_id, title, target_url, rotation_strategy,
        scan_count: scan_count || 0,
        max_scans: max_scans || 1,
        is_active: is_active ?? true,
        color_primary, color_secondary,
        model_blob, model_filename, model_format,
        image_blob, image_mime, current_qr_png,
        metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockStore.qr_items.set(id, item);
      return { rows: [item] };
    }

    // SELECT FROM qr_items WHERE id = $1
    if (normalizedText.includes('FROM qr_items WHERE id = $1')) {
      const id = params[0];
      const item = mockStore.qr_items.get(id);
      if (!item) return { rows: [] };
      if (params.length > 1) {
        // Checking tenant_id as second parameter
        if (item.tenant_id !== params[1]) return { rows: [] };
      }
      return { rows: [item] };
    }

    // SELECT list from qr_items WHERE tenant_id = $1
    if (normalizedText.includes('FROM qr_items WHERE tenant_id = $1')) {
      const tenant_id = params[0];
      const items = Array.from(mockStore.qr_items.values())
        .filter(i => i.tenant_id === tenant_id)
        .sort((a, b) => b.created_at - a.created_at);
      return { rows: items };
    }

    // UPDATE qr_items
    if (normalizedText.startsWith('UPDATE qr_items')) {
      const id = params[params.length - 1];
      const item = mockStore.qr_items.get(id);
      if (item) {
        if (normalizedText.includes('scan_count = scan_count + 1')) {
          item.scan_count += 1;
          if (normalizedText.includes('current_qr_png = $1')) {
            item.current_qr_png = params[0];
          }
          if (normalizedText.includes('metadata = $2')) {
            item.metadata = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
          }
        } else if (normalizedText.includes('target_url = $1')) {
          item.target_url = params[0];
          if (normalizedText.includes('title = $2')) {
            item.title = params[1];
          }
          if (normalizedText.includes('is_active = $3')) {
            item.is_active = params[2];
          }
          if (normalizedText.includes('current_qr_png = $4')) {
            item.current_qr_png = params[3];
          }
          if (normalizedText.includes('metadata = $5')) {
            item.metadata = typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4];
          }
        }
        item.updated_at = new Date();
        return { rows: [item] };
      }
      return { rows: [] };
    }

    // DELETE FROM qr_items WHERE id = $1
    if (normalizedText.startsWith('DELETE FROM qr_items WHERE id = $1')) {
      const id = params[0];
      const deleted = mockStore.qr_items.delete(id);
      return { rowCount: deleted ? 1 : 0 };
    }

    // INSERT INTO scan_logs
    if (normalizedText.startsWith('INSERT INTO scan_logs')) {
      const log = {
        id: mockStore.scan_logs.length + 1,
        qr_id: params[0],
        tenant_id: params[1],
        ip_address: params[2],
        user_agent: params[3],
        rotated: params[4],
        target_url: params[5],
        scanned_at: new Date()
      };
      mockStore.scan_logs.push(log);
      return { rows: [log] };
    }

    // SELECT FROM scan_logs WHERE qr_id = $1
    if (normalizedText.includes('FROM scan_logs WHERE qr_id = $1')) {
      const qr_id = params[0];
      const logs = mockStore.scan_logs
        .filter(l => l.qr_id === qr_id)
        .sort((a, b) => b.scanned_at - a.scanned_at);
      return { rows: logs };
    }

    // INSERT INTO qr_rotation_history
    if (normalizedText.startsWith('INSERT INTO qr_rotation_history')) {
      const rot = {
        id: params[0],
        qr_id: params[1],
        previous_url: params[2],
        new_url: params[3],
        reason: params[4],
        rotated_at: new Date()
      };
      mockStore.qr_rotation_history.push(rot);
      return { rows: [rot] };
    }

    return { rows: [] };
  }
};
