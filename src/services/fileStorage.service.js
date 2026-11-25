import crypto from 'crypto';
import path from 'path';
import { db, refreshStartupStats } from '../db/pool.js';

export function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function inferFileKind(filename = '', mimeType = '', explicitKind = '') {
  const cleanKind = String(explicitKind || '').toLowerCase();
  if (cleanKind === 'model' || cleanKind === 'image') return cleanKind;
  const ext = path.extname(filename).toLowerCase();
  if (['.glb', '.gltf', '.obj', '.fbx', '.stl'].includes(ext)) return 'model';
  if (mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
    return 'image';
  }
  return 'model';
}

function serializeFileMeta(row, extra = {}) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    tenant_name: row.tenant_name || undefined,
    owner_user_id: row.owner_user_id || null,
    owner_username: row.owner_username || undefined,
    owner_name: row.owner_name || undefined,
    file_kind: row.file_kind,
    filename: row.filename,
    mime_type: row.mime_type,
    format: row.format,
    size_bytes: Number(row.size_bytes),
    sizeFormatted: formatBytes(row.size_bytes),
    sha256: row.sha256,
    created_at: row.created_at,
    downloadUrl: `/api/files/${row.id}/download`,
    ...extra
  };
}

function normalizeScope(scopeOrTenantId) {
  if (typeof scopeOrTenantId === 'string') {
    return { role: 'admin', tenantId: scopeOrTenantId, userId: null, filterTenantId: null };
  }
  return {
    role: scopeOrTenantId?.role || 'admin',
    tenantId: scopeOrTenantId?.tenantId || null,
    userId: scopeOrTenantId?.userId || null,
    filterTenantId: scopeOrTenantId?.filterTenantId || null
  };
}

/**
 * Guarda un archivo binario (modelo 3D o imagen) en la base de datos persistente.
 * Deduplica por (tenant_id, owner_user_id, sha256, file_kind) cuando pertenece a un usuario específico.
 */
export async function saveUploadedFile({
  tenantId,
  ownerUserId = null,
  fileKind,
  filename,
  mimeType = 'application/octet-stream',
  format,
  buffer
}) {
  if (!buffer || buffer.length === 0) {
    throw new Error('Archivo vacío');
  }

  const safeName = path.basename(filename || 'archivo.bin');
  const resolvedKind = inferFileKind(safeName, mimeType, fileKind);
  const resolvedFormat = (format || path.extname(safeName).replace('.', '') || 'bin').toLowerCase();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const existing = ownerUserId
    ? await db.query(
        `SELECT f.id, f.tenant_id, f.owner_user_id, f.file_kind, f.filename, f.mime_type, f.format, f.size_bytes, f.sha256, f.created_at
         FROM saved_files f
         WHERE f.tenant_id = $1 AND f.owner_user_id = $2 AND f.sha256 = $3 AND f.file_kind = $4
         LIMIT 1`,
        [tenantId, ownerUserId, sha256, resolvedKind]
      )
    : await db.query(
        `SELECT f.id, f.tenant_id, f.owner_user_id, f.file_kind, f.filename, f.mime_type, f.format, f.size_bytes, f.sha256, f.created_at
         FROM saved_files f
         WHERE f.tenant_id = $1 AND f.sha256 = $2 AND f.file_kind = $3
         LIMIT 1`,
        [tenantId, sha256, resolvedKind]
      );

  if (existing.rows.length > 0) {
    return serializeFileMeta(existing.rows[0], { deduplicated: true });
  }

  const fileId = 'file_' + crypto.randomBytes(6).toString('hex');
  await db.query(
    `INSERT INTO saved_files (
      id, tenant_id, owner_user_id, file_kind, filename, mime_type, format, size_bytes, sha256, file_blob
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      fileId,
      tenantId,
      ownerUserId || null,
      resolvedKind,
      safeName,
      mimeType,
      resolvedFormat,
      buffer.length,
      sha256,
      buffer
    ]
  );

  await refreshStartupStats();

  const created = await db.query(
    `SELECT f.id, f.tenant_id, f.owner_user_id, f.file_kind, f.filename, f.mime_type, f.format, f.size_bytes, f.sha256, f.created_at,
            t.name AS tenant_name, u.username AS owner_username, u.full_name AS owner_name
     FROM saved_files f
     LEFT JOIN tenants t ON t.id = f.tenant_id
     LEFT JOIN users u ON u.id = f.owner_user_id
     WHERE f.id = $1`,
    [fileId]
  );

  return serializeFileMeta(created.rows[0], { deduplicated: false });
}

export async function listSavedFiles(scopeOrTenantId, fileKind = null) {
  const scope = normalizeScope(scopeOrTenantId);
  const where = [];
  const params = [];

  if (scope.role === 'superadmin') {
    if (scope.filterTenantId) {
      params.push(scope.filterTenantId);
      where.push(`f.tenant_id = $${params.length}`);
    }
  } else if (scope.role === 'user') {
    params.push(scope.tenantId);
    where.push(`f.tenant_id = $${params.length}`);
    params.push(scope.userId);
    where.push(`f.owner_user_id = $${params.length}`);
  } else {
    params.push(scope.tenantId);
    where.push(`f.tenant_id = $${params.length}`);
  }

  if (fileKind === 'model' || fileKind === 'image') {
    params.push(fileKind);
    where.push(`f.file_kind = $${params.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT f.id, f.tenant_id, f.owner_user_id, f.file_kind, f.filename, f.mime_type, f.format, f.size_bytes, f.sha256, f.created_at,
            t.name AS tenant_name, u.username AS owner_username, u.full_name AS owner_name
     FROM saved_files f
     LEFT JOIN tenants t ON t.id = f.tenant_id
     LEFT JOIN users u ON u.id = f.owner_user_id
     ${whereClause}
     ORDER BY f.created_at DESC`,
    params
  );

  return result.rows.map((row) => serializeFileMeta(row));
}

export async function getSavedFileById(fileId, scopeOrTenantId) {
  const scope = normalizeScope(scopeOrTenantId);
  let result;
  if (scope.role === 'superadmin') {
    result = await db.query(
      `SELECT id, tenant_id, owner_user_id, file_kind, filename, mime_type, format, size_bytes, sha256, file_blob, created_at
       FROM saved_files
       WHERE id = $1`,
      [fileId]
    );
  } else if (scope.role === 'user') {
    result = await db.query(
      `SELECT id, tenant_id, owner_user_id, file_kind, filename, mime_type, format, size_bytes, sha256, file_blob, created_at
       FROM saved_files
       WHERE id = $1 AND tenant_id = $2 AND owner_user_id = $3`,
      [fileId, scope.tenantId, scope.userId]
    );
  } else {
    result = await db.query(
      `SELECT id, tenant_id, owner_user_id, file_kind, filename, mime_type, format, size_bytes, sha256, file_blob, created_at
       FROM saved_files
       WHERE id = $1 AND tenant_id = $2`,
      [fileId, scope.tenantId]
    );
  }
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function deleteSavedFile(fileId, scopeOrTenantId) {
  const scope = normalizeScope(scopeOrTenantId);
  let res;
  if (scope.role === 'superadmin') {
    res = await db.query('DELETE FROM saved_files WHERE id = $1', [fileId]);
  } else if (scope.role === 'user') {
    res = await db.query(
      'DELETE FROM saved_files WHERE id = $1 AND tenant_id = $2 AND owner_user_id = $3',
      [fileId, scope.tenantId, scope.userId]
    );
  } else {
    res = await db.query(
      'DELETE FROM saved_files WHERE id = $1 AND tenant_id = $2',
      [fileId, scope.tenantId]
    );
  }
  if (res.rowCount > 0) {
    await refreshStartupStats();
    return true;
  }
  return false;
}
