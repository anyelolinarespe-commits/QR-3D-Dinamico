import crypto from 'crypto';
import { db } from '../db/pool.js';
import { config } from '../config/env.js';
import { eventBus } from '../config/redis.js';
import { generateQrPngBuffer } from './qr.service.js';
import { resolveEffectiveViewerConfig, sanitizeViewerConfig } from './viewerConfig.service.js';

export const ALLOWED_ROTATION_STRATEGIES = new Set([
  'static',
  'continuous',
  'one_time',
  'timed',
  'dynamic'
]);

export const ALLOWED_SCAN_MODES = new Set(['ar', 'redirect']);

export const STATIC_STRATEGIES = new Set(['static', 'continuous']);
export const MIN_ROTATION_INTERVAL_SEC = 2;
export const MAX_ROTATION_INTERVAL_SEC = 86400;
export const DEFAULT_TIMED_INTERVAL_SEC = 30;

export function parseMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? { ...raw } : {};
}

export function parseBooleanFlag(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const norm = val.trim().toLowerCase();
    if (norm === 'true' || norm === '1' || norm === 'on' || norm === 'yes') return true;
    if (norm === 'false' || norm === '0' || norm === 'off' || norm === 'no') return false;
  }
  return Boolean(val);
}

export function generateViewToken() {
  return 'vw_' + crypto.randomBytes(8).toString('hex');
}

export function sendCachedBinaryAsset(
  request,
  reply,
  buffer,
  {
    contentType = 'application/octet-stream',
    etagPrefix = 'bin',
    cacheControl = 'public, max-age=60, must-revalidate',
    contentDisposition = null
  } = {}
) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
  const etag = `"${etagPrefix}-${buf.length}-${hash}"`;
  reply.header('ETag', etag);
  reply.header('Cache-Control', cacheControl);
  if (contentDisposition) {
    reply.header('Content-Disposition', contentDisposition);
  }

  const ifNoneMatch = request?.headers?.['if-none-match'];
  if (ifNoneMatch && ifNoneMatch.includes(etag)) {
    return reply.status(304).send();
  }

  return reply.header('Content-Type', contentType).send(buf);
}

export function sendCachedGlbModel(
  request,
  reply,
  buffer,
  cacheControl = 'public, max-age=60, must-revalidate'
) {
  return sendCachedBinaryAsset(request, reply, buffer, {
    contentType: 'model/gltf-binary',
    etagPrefix: 'glb',
    cacheControl
  });
}

export function buildViewUrl(viewToken, baseUrl = config.publicBaseUrl) {
  return `${baseUrl}/view/${viewToken}`;
}

export function buildScanUrl(qrId, token = null, baseUrl = config.publicBaseUrl) {
  return token ? `${baseUrl}/scan/${qrId}?token=${token}` : `${baseUrl}/scan/${qrId}`;
}

export function resolveRequestBaseUrl(request) {
  const fallback = config.publicBaseUrl;
  if (!request || !request.headers) return fallback;
  const isLocalConfigured = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fallback);
  if (!isLocalConfigured) return fallback;

  const rawHost = request.headers['x-forwarded-host'] || request.headers.host;
  if (!rawHost || rawHost === 'localhost:80') return fallback;
  const proto = request.headers['x-forwarded-proto'] || request.protocol || 'http';
  return `${proto}://${rawHost}`;
}

export function validateHttpUrl(rawUrl, fieldName = 'target_url') {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!trimmed) {
    const err = new Error(`${fieldName} es requerido`);
    err.statusCode = 400;
    throw err;
  }
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || /[\s\r\n]/.test(trimmed)) {
      const err = new Error(`${fieldName} tiene una ruta inválida`);
      err.statusCode = 400;
      throw err;
    }
    try {
      new URL(trimmed, 'http://localhost');
      return trimmed;
    } catch {
      const err = new Error(`${fieldName} debe ser una ruta válida (ej. /example/sipan-nuevo.html)`);
      err.statusCode = 400;
      throw err;
    }
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    const err = new Error(`${fieldName} debe ser una URL válida (http://, https:// o /ruta)`);
    err.statusCode = 400;
    throw err;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    const err = new Error(`${fieldName} solo permite protocolos http://, https:// o rutas que inicien con /`);
    err.statusCode = 400;
    throw err;
  }
  return trimmed;
}

export function sanitizeViewSlug(rawInput) {
  if (typeof rawInput !== 'string') {
    const err = new Error('La ruta de vista debe ser texto válido');
    err.statusCode = 400;
    throw err;
  }
  let slug = rawInput.trim();
  const fullViewMatch = slug.match(/^https?:\/\/[^/]+\/view\/([^/?#]+)\/?$/i);
  if (fullViewMatch) {
    slug = fullViewMatch[1];
  } else {
    slug = slug.replace(/^\/?view\//i, '').replace(/^\/+|\/+$/g, '');
  }
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(slug)) {
    const err = new Error(
      'La ruta solo puede contener letras, números, guiones (-) o guiones bajos (_), de 3 a 64 caracteres'
    );
    err.statusCode = 400;
    throw err;
  }
  return slug;
}

export async function resolveUniqueViewToken(rawSlug, excludeQrId = null) {
  const slug = sanitizeViewSlug(rawSlug);
  const existing = excludeQrId
    ? await db.query('SELECT id FROM qr_items WHERE view_token = $1 AND id <> $2 LIMIT 1', [slug, excludeQrId])
    : await db.query('SELECT id FROM qr_items WHERE view_token = $1 LIMIT 1', [slug]);
  if (existing.rows.length > 0) {
    const err = new Error(`La ruta "${slug}" ya está en uso por otro QR`);
    err.statusCode = 409;
    throw err;
  }
  return slug;
}

export function sanitizeRotatingUrls(rawInput) {
  if (rawInput === undefined || rawInput === null || rawInput === '') {
    return [];
  }

  let candidates = [];
  if (Array.isArray(rawInput)) {
    candidates = rawInput;
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          candidates = parsed;
        }
      } catch {
        candidates = trimmed.split(/[\r\n,]+/);
      }
    } else {
      candidates = trimmed.split(/[\r\n]+/);
    }
  }

  const out = [];
  const seen = new Set();
  for (const item of candidates) {
    const s = typeof item === 'string' ? item.trim() : '';
    if (!s) continue;
    const valid = validateHttpUrl(s, 'rotating_urls');
    if (!seen.has(valid)) {
      seen.add(valid);
      out.push(valid);
      if (out.length >= 100) break;
    }
  }
  return out;
}

function clampInterval(rawVal, fallback = DEFAULT_TIMED_INTERVAL_SEC) {
  const n = parseInt(rawVal, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(MAX_ROTATION_INTERVAL_SEC, Math.max(MIN_ROTATION_INTERVAL_SEC, n));
}

export function isTimedStrategy(strategy, intervalSeconds) {
  return !STATIC_STRATEGIES.has(strategy) && Number(intervalSeconds || 0) >= MIN_ROTATION_INTERVAL_SEC;
}

export function getLinkMode(strategy, intervalSeconds = 0) {
  if (STATIC_STRATEGIES.has(strategy) && Number(intervalSeconds || 0) <= 0) {
    return 'static';
  }
  return 'dynamic';
}

/**
 * Normaliza la estrategia de link (estático vs dinámico/cambiante) y su intervalo automático.
 */
export function resolveLinkSettings(fields = {}, existing = null) {
  const existingMeta = existing ? parseMetadata(existing.metadata) : {};
  const existingStrategy = existing?.rotation_strategy || 'one_time';
  const existingInterval = Number(existingMeta.rotationIntervalSeconds || 0);

  const rawStrategy = typeof fields.rotation_strategy === 'string'
    ? fields.rotation_strategy.trim().toLowerCase()
    : '';
  const hasExplicitStrategy = ALLOWED_ROTATION_STRATEGIES.has(rawStrategy);

  const rawLinkMode = typeof fields.link_mode === 'string'
    ? fields.link_mode.trim().toLowerCase()
    : '';

  const rawIntervalProvided =
    fields.rotation_interval_seconds !== undefined
      ? fields.rotation_interval_seconds
      : fields.rotation_interval_sec;
  const hasExplicitInterval =
    rawIntervalProvided !== undefined && rawIntervalProvided !== null && rawIntervalProvided !== '';
  const parsedRawInterval = hasExplicitInterval ? parseInt(rawIntervalProvided, 10) : NaN;

  let rotationStrategy = existing ? existingStrategy : 'one_time';
  if (hasExplicitStrategy) {
    rotationStrategy = rawStrategy;
  } else if (rawLinkMode === 'static') {
    rotationStrategy = existing && existingStrategy === 'continuous' ? 'continuous' : 'static';
  } else if (rawLinkMode === 'dynamic') {
    if (!existing || STATIC_STRATEGIES.has(existingStrategy)) {
      rotationStrategy = Number.isFinite(parsedRawInterval) && parsedRawInterval > 0 ? 'timed' : 'one_time';
    }
  } else if (hasExplicitInterval && Number.isFinite(parsedRawInterval)) {
    if (parsedRawInterval > 0 && (!existing || STATIC_STRATEGIES.has(rotationStrategy))) {
      rotationStrategy = 'timed';
    } else if (parsedRawInterval <= 0 && (rotationStrategy === 'timed' || rotationStrategy === 'dynamic')) {
      rotationStrategy = rotationStrategy === 'dynamic' ? 'one_time' : 'static';
    }
  }

  // Si enviaron link_mode='static' sin forzar una estrategia dinámica
  if (rawLinkMode === 'static' && !hasExplicitStrategy) {
    rotationStrategy = existing && existingStrategy === 'continuous' ? 'continuous' : 'static';
  }

  let rotationIntervalSeconds = existing ? existingInterval : 0;
  if (STATIC_STRATEGIES.has(rotationStrategy)) {
    rotationIntervalSeconds = 0;
  } else if (rotationStrategy === 'timed' || rotationStrategy === 'dynamic') {
    if (hasExplicitInterval) {
      rotationIntervalSeconds = clampInterval(parsedRawInterval, DEFAULT_TIMED_INTERVAL_SEC);
    } else if (rotationIntervalSeconds < MIN_ROTATION_INTERVAL_SEC) {
      rotationIntervalSeconds = DEFAULT_TIMED_INTERVAL_SEC;
    }
  } else if (rotationStrategy === 'one_time') {
    if (hasExplicitInterval) {
      rotationIntervalSeconds = Number.isFinite(parsedRawInterval) && parsedRawInterval > 0
        ? clampInterval(parsedRawInterval, DEFAULT_TIMED_INTERVAL_SEC)
        : 0;
    } else if (!existing) {
      rotationIntervalSeconds = 0;
    }
  }

  const linkMode = getLinkMode(rotationStrategy, rotationIntervalSeconds);

  const hasRotatingUrlsField =
    fields.rotating_urls !== undefined || fields.target_urls !== undefined;
  const rawRotatingUrls = fields.rotating_urls !== undefined ? fields.rotating_urls : fields.target_urls;
  const rotatingUrls = hasRotatingUrlsField
    ? sanitizeRotatingUrls(rawRotatingUrls)
    : Array.isArray(existingMeta.rotatingUrls)
      ? existingMeta.rotatingUrls
      : [];

  let rotatingUrlIndex = Number(existingMeta.rotatingUrlIndex || 0);
  if (hasRotatingUrlsField || rotatingUrlIndex >= rotatingUrls.length) {
    rotatingUrlIndex = 0;
  }

  const viewEnabled = parseBooleanFlag(
    fields.view_enabled,
    existingMeta.viewEnabled !== undefined ? Boolean(existingMeta.viewEnabled) : true
  );

  const rawScanMode = typeof (fields.scan_mode ?? fields.scanMode) === 'string'
    ? String(fields.scan_mode ?? fields.scanMode).trim().toLowerCase()
    : '';
  const scanMode = ALLOWED_SCAN_MODES.has(rawScanMode)
    ? rawScanMode
    : (existingMeta.scanMode === 'ar' ? 'ar' : 'redirect');

  let nextRotationAt = null;
  if (rotationIntervalSeconds >= MIN_ROTATION_INTERVAL_SEC) {
    const existingNext = existingMeta.nextRotationAt;
    const strategyOrIntervalChanged =
      !existing ||
      rotationStrategy !== existingStrategy ||
      rotationIntervalSeconds !== existingInterval;
    nextRotationAt = !strategyOrIntervalChanged && existingNext
      ? existingNext
      : new Date(Date.now() + rotationIntervalSeconds * 1000).toISOString();
  }

  return {
    rotationStrategy,
    linkMode,
    scanMode,
    rotationIntervalSeconds,
    nextRotationAt,
    rotatingUrls,
    rotatingUrlIndex,
    viewEnabled
  };
}

/**
 * Rota el token/link activo de un QR, regenera su PNG, registra el historial y emite el evento SSE.
 */
export async function rotateQrItemLink(item, {
  reason = 'manual_rotate',
  newTargetUrl = null,
  previousScanUrl = null,
  incrementScanCount = false,
  extraMetadataPatch = {},
  publishEvent = true,
  baseUrl = config.publicBaseUrl
} = {}) {
  const metadata = parseMetadata(item.metadata);
  const oldToken = metadata.currentToken || 'initial';
  const nextToken = crypto.randomBytes(4).toString('hex');

  const rotatingUrls = Array.isArray(extraMetadataPatch.rotatingUrls)
    ? extraMetadataPatch.rotatingUrls
    : Array.isArray(metadata.rotatingUrls)
      ? metadata.rotatingUrls
      : [];

  let resolvedTargetUrl = newTargetUrl || item.target_url;
  let nextUrlIndex = Number(
    extraMetadataPatch.rotatingUrlIndex !== undefined
      ? extraMetadataPatch.rotatingUrlIndex
      : (metadata.rotatingUrlIndex || 0)
  );

  if (!newTargetUrl && rotatingUrls.length > 1) {
    nextUrlIndex = (nextUrlIndex + 1) % rotatingUrls.length;
    resolvedTargetUrl = rotatingUrls[nextUrlIndex];
  } else if (!newTargetUrl && rotatingUrls.length === 1 && !item.target_url) {
    resolvedTargetUrl = rotatingUrls[0];
  }

  const intervalSec = Number(
    extraMetadataPatch.rotationIntervalSeconds !== undefined
      ? extraMetadataPatch.rotationIntervalSeconds
      : (metadata.rotationIntervalSeconds || 0)
  );
  const nowIso = new Date().toISOString();

  metadata.currentToken = nextToken;
  metadata.qrBaseUrl = baseUrl;
  metadata.lastRotatedAt = nowIso;
  metadata.lastRotationReason = reason;
  metadata.rotationCount = Number(metadata.rotationCount || 0) + 1;
  metadata.rotatingUrlIndex = nextUrlIndex;
  Object.assign(metadata, extraMetadataPatch);

  if (intervalSec >= MIN_ROTATION_INTERVAL_SEC && !STATIC_STRATEGIES.has(item.rotation_strategy)) {
    metadata.nextRotationAt = new Date(Date.now() + intervalSec * 1000).toISOString();
  } else {
    metadata.nextRotationAt = null;
  }

  const nextScanUrl = buildScanUrl(item.id, nextToken, baseUrl);
  const prevUrlForHistory = previousScanUrl || buildScanUrl(item.id, oldToken, baseUrl);
  const newQrPng = await generateQrPngBuffer(nextScanUrl, {
    primary: item.color_primary,
    secondary: item.color_secondary
  });

  const nextScanCount = Number(item.scan_count || 0) + (incrementScanCount ? 1 : 0);

  await db.query(
    `UPDATE qr_items
     SET target_url = $1,
         scan_count = $2,
         current_qr_png = $3,
         metadata = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [resolvedTargetUrl, nextScanCount, newQrPng, JSON.stringify(metadata), item.id]
  );

  await db.query(
    `INSERT INTO qr_rotation_history (id, qr_id, previous_url, new_url, reason, rotated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [crypto.randomUUID(), item.id, prevUrlForHistory, nextScanUrl, reason]
  );

  const eventPayload = {
    type: 'qr_updated',
    qrId: item.id,
    reason,
    rotated: true,
    scanCount: nextScanCount,
    rotationCount: metadata.rotationCount,
    linkMode: getLinkMode(item.rotation_strategy, intervalSec),
    rotationStrategy: item.rotation_strategy,
    rotationIntervalSeconds: intervalSec,
    nextRotationAt: metadata.nextRotationAt,
    lastRotatedAt: nowIso,
    newQrImageUrl: `${baseUrl}/api/qr/${item.id}/image?t=${Date.now()}`,
    timestamp: Date.now()
  };

  if (publishEvent) {
    await eventBus.publish(`qr_events:${item.id}`, eventPayload);
  }

  return {
    targetUrl: resolvedTargetUrl,
    nextToken,
    nextScanUrl,
    newQrPng,
    scanCount: nextScanCount,
    metadata,
    eventPayload
  };
}

/**
 * Garantiza que la imagen PNG almacenada del QR esté generada con el baseUrl actual (p. ej. puerto 3100).
 */
export async function ensureQrPngForBaseUrl(item, baseUrl = config.publicBaseUrl) {
  const meta = parseMetadata(item.metadata);
  if (item.current_qr_png && meta.qrBaseUrl === baseUrl) {
    return item.current_qr_png;
  }

  const scanUrl = buildScanUrl(item.id, meta.currentToken || null, baseUrl);
  const freshPng = await generateQrPngBuffer(scanUrl, {
    primary: item.color_primary,
    secondary: item.color_secondary
  });
  meta.qrBaseUrl = baseUrl;

  await db.query(
    'UPDATE qr_items SET current_qr_png = $1, metadata = $2 WHERE id = $3',
    [freshPng, JSON.stringify(meta), item.id]
  );

  return freshPng;
}

/**
 * Serializa metadatos públicos de solo lectura para /view/:viewToken/meta (sin secretos ni info administrativa).
 */
export function getLocalDayWindow(referenceDate = new Date()) {
  const d = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const start = new Date(year, month, day, 0, 0, 0, 0);
  const end = new Date(year, month, day + 1, 0, 0, 0, 0);
  const todayDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    todayDate,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: start.toISOString().slice(0, 19).replace('T', ' '),
    endSql: end.toISOString().slice(0, 19).replace('T', ' ')
  };
}

export function parseUtcDbDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    const d = new Date(`${str.replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getDayQueryArgs(win) {
  const isSqlite = db.isFallback();
  return {
    boundStart: isSqlite ? win.startSql : win.startIso,
    boundEnd: isSqlite ? win.endSql : win.endIso,
    timeExpr: isSqlite ? "replace(substr(scanned_at, 1, 19), 'T', ' ')" : 'scanned_at'
  };
}

export async function getDailyStatsForQr(qrId, referenceDate = new Date()) {
  const win = getLocalDayWindow(referenceDate);
  const { boundStart, boundEnd, timeExpr } = getDayQueryArgs(win);
  const res = await db.query(
    `SELECT COUNT(*) AS daily_scans,
            COUNT(DISTINCT COALESCE(ip_address, 'unknown') || '|' || COALESCE(user_agent, 'unknown')) AS daily_visitors
     FROM scan_logs
     WHERE qr_id = $1 AND ${timeExpr} >= $2 AND ${timeExpr} < $3`,
    [qrId, boundStart, boundEnd]
  );
  const row = res.rows[0] || {};
  return {
    todayDate: win.todayDate,
    dailyScans: Number(row.daily_scans || 0),
    dailyUniqueVisitors: Number(row.daily_visitors || 0)
  };
}

export async function getDailyStatsMapByTenant(tenantId, referenceDate = new Date()) {
  return getDailyStatsMapScoped({ role: 'admin', tenantId }, referenceDate);
}

export async function getDailyStatsMapScoped(scope = {}, referenceDate = new Date()) {
  const role = scope.role || 'admin';
  const tenantId = scope.tenantId || null;
  const userId = scope.userId || null;
  const filterTenantId = scope.filterTenantId || null;

  const win = getLocalDayWindow(referenceDate);
  const { boundStart, boundEnd, timeExpr } = getDayQueryArgs(win);
  const exprSl = timeExpr.replace(/\bscanned_at\b/g, 'sl.scanned_at');

  const where = [`${exprSl} >= $1`, `${exprSl} < $2`];
  const params = [boundStart, boundEnd];
  let joinClause = '';

  if (role === 'superadmin') {
    if (filterTenantId) {
      params.push(filterTenantId);
      where.push(`sl.tenant_id = $${params.length}`);
    }
  } else if (role === 'user') {
    joinClause = 'INNER JOIN qr_items q ON q.id = sl.qr_id';
    params.push(tenantId);
    where.push(`q.tenant_id = $${params.length}`);
    params.push(userId);
    where.push(`q.owner_user_id = $${params.length}`);
  } else {
    params.push(tenantId);
    where.push(`sl.tenant_id = $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [perQrRes, totalRes] = await Promise.all([
    db.query(
      `SELECT sl.qr_id,
              COUNT(*) AS daily_scans,
              COUNT(DISTINCT COALESCE(sl.ip_address, 'unknown') || '|' || COALESCE(sl.user_agent, 'unknown')) AS daily_visitors
       FROM scan_logs sl
       ${joinClause}
       ${whereSql}
       GROUP BY sl.qr_id`,
      params
    ),
    db.query(
      `SELECT COUNT(*) AS total_daily_scans,
              COUNT(DISTINCT COALESCE(sl.ip_address, 'unknown') || '|' || COALESCE(sl.user_agent, 'unknown')) AS total_daily_visitors
       FROM scan_logs sl
       ${joinClause}
       ${whereSql}`,
      params
    )
  ]);

  const byQrId = new Map();
  for (const row of perQrRes.rows) {
    byQrId.set(row.qr_id, {
      todayDate: win.todayDate,
      dailyScans: Number(row.daily_scans || 0),
      dailyUniqueVisitors: Number(row.daily_visitors || 0)
    });
  }
  const totRow = totalRes.rows[0] || {};
  return {
    todayDate: win.todayDate,
    totalDailyScans: Number(totRow.total_daily_scans || 0),
    totalDailyUniqueVisitors: Number(totRow.total_daily_visitors || 0),
    byQrId
  };
}

export async function getDailyHistoryForQr(qrId, days = 14, referenceDate = new Date()) {
  const safeDays = Math.min(90, Math.max(1, parseInt(days, 10) || 14));
  const win = getLocalDayWindow(referenceDate);
  const dRef = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const earliestLocal = new Date(
    dRef.getFullYear(),
    dRef.getMonth(),
    dRef.getDate() - (safeDays - 1),
    0,
    0,
    0,
    0
  );
  const isSqlite = db.isFallback();
  const timeExpr = isSqlite ? "replace(substr(scanned_at, 1, 19), 'T', ' ')" : 'scanned_at';
  const boundStart = isSqlite
    ? earliestLocal.toISOString().slice(0, 19).replace('T', ' ')
    : earliestLocal.toISOString();
  const boundEnd = isSqlite ? win.endSql : win.endIso;

  const res = await db.query(
    `SELECT scanned_at, ip_address, user_agent
     FROM scan_logs
     WHERE qr_id = $1 AND ${timeExpr} >= $2 AND ${timeExpr} < $3
     ORDER BY scanned_at DESC`,
    [qrId, boundStart, boundEnd]
  );

  const buckets = new Map();
  buckets.set(win.todayDate, { date: win.todayDate, scans: 0, visitors: new Set() });

  for (const row of res.rows) {
    const dt = parseUtcDbDate(row.scanned_at);
    if (!dt) continue;
    const dateKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (!buckets.has(dateKey)) {
      buckets.set(dateKey, { date: dateKey, scans: 0, visitors: new Set() });
    }
    const bucket = buckets.get(dateKey);
    bucket.scans += 1;
    bucket.visitors.add(`${row.ip_address || 'unknown'}|${row.user_agent || 'unknown'}`);
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((b) => ({
      date: b.date,
      scans: b.scans,
      uniqueVisitors: b.visitors.size
    }));
}

export function serializePublicViewData(item, baseUrl = config.publicBaseUrl, dailyStats = null) {
  const meta = parseMetadata(item.metadata);
  const viewToken = item.view_token || meta.viewToken;
  const intervalSec = Number(meta.rotationIntervalSeconds || 0);
  const linkMode = getLinkMode(item.rotation_strategy, intervalSec);
  const viewEnabled = meta.viewEnabled !== false;
  const todayDate = dailyStats?.todayDate || getLocalDayWindow().todayDate;
  const effectiveViewerConfig = resolveEffectiveViewerConfig(
    meta.viewerConfig,
    item.tenant_default_viewer_config,
    meta.hasCustomViewerConfig
  );

  return {
    viewToken,
    viewUrl: buildViewUrl(viewToken, baseUrl),
    arViewUrl: `${baseUrl}/view/${viewToken}/ar`,
    scanMode: meta.scanMode === 'ar' ? 'ar' : 'redirect',
    title: item.title || 'Modelo 3D + QR',
    description: meta.description || '',
    isActive: Boolean(item.is_active),
    viewEnabled,
    linkMode,
    rotationStrategy: item.rotation_strategy,
    rotationIntervalSeconds: intervalSec,
    nextRotationAt: meta.nextRotationAt || null,
    lastRotatedAt: meta.lastRotatedAt || meta.createdAt || null,
    rotationCount: Number(meta.rotationCount || 0),
    scanCount: Number(item.scan_count || 0),
    dailyScans: Number(dailyStats?.dailyScans || 0),
    dailyUniqueVisitors: Number(dailyStats?.dailyUniqueVisitors || 0),
    todayDate,
    colors: {
      primary: item.color_primary,
      secondary: item.color_secondary
    },
    viewerConfig: effectiveViewerConfig,
    modelUrl: `${baseUrl}/view/${viewToken}/model`,
    arModelUrl: `${baseUrl}/view/${viewToken}/model?ar=1`,
    usdzUrl: `${baseUrl}/view/${viewToken}/model.usdz`,
    viewQrUrl: `${baseUrl}/view/${viewToken}/view-qr`,
    imageUrl: `${baseUrl}/view/${viewToken}/image`,
    matrixUrl: `${baseUrl}/view/${viewToken}/matrix`,
    eventsUrl: `${baseUrl}/view/${viewToken}/events`
  };
}

/**
 * Serializa un QR para respuestas autenticadas/administrativas de /api/qr*.
 */
export function serializeQrItem(item, baseUrl = config.publicBaseUrl, dailyStats = null) {
  const meta = parseMetadata(item.metadata);
  const viewToken = item.view_token || meta.viewToken;
  const intervalSec = Number(meta.rotationIntervalSeconds || 0);
  const linkMode = getLinkMode(item.rotation_strategy, intervalSec);
  const viewEnabled = meta.viewEnabled !== false;
  const todayDate = dailyStats?.todayDate || getLocalDayWindow().todayDate;
  const effectiveViewerConfig = resolveEffectiveViewerConfig(
    meta.viewerConfig,
    item.tenant_default_viewer_config,
    meta.hasCustomViewerConfig
  );

  return {
    id: item.id,
    tenant_id: item.tenant_id,
    tenant_name: item.tenant_name || undefined,
    owner_user_id: item.owner_user_id || null,
    owner_username: item.owner_username || undefined,
    owner_name: item.owner_name || undefined,
    title: item.title,
    description: meta.description || '',
    target_url: item.target_url,
    rotation_strategy: item.rotation_strategy,
    linkMode,
    rotationIntervalSeconds: intervalSec,
    nextRotationAt: meta.nextRotationAt || null,
    lastRotatedAt: meta.lastRotatedAt || null,
    rotationCount: Number(meta.rotationCount || 0),
    rotatingUrls: Array.isArray(meta.rotatingUrls) ? meta.rotatingUrls : [],
    scan_count: item.scan_count,
    dailyScans: Number(dailyStats?.dailyScans || 0),
    dailyUniqueVisitors: Number(dailyStats?.dailyUniqueVisitors || 0),
    todayDate,
    max_scans: item.max_scans,
    is_active: item.is_active,
    viewToken,
    viewUrl: buildViewUrl(viewToken, baseUrl),
    arViewUrl: `${baseUrl}/view/${viewToken}/ar`,
    scanMode: meta.scanMode === 'ar' ? 'ar' : 'redirect',
    viewEnabled,
    color_primary: item.color_primary,
    color_secondary: item.color_secondary,
    model_filename: item.model_filename,
    viewerConfig: effectiveViewerConfig,
    hasCustomViewerConfig: Boolean(meta.hasCustomViewerConfig),
    modelUrl: `${baseUrl}/api/qr/${item.id}/model`,
    arModelUrl: `${baseUrl}/api/qr/${item.id}/model?ar=1`,
    usdzUrl: `${baseUrl}/api/qr/${item.id}/model.usdz`,
    viewQrUrl: `${baseUrl}/api/qr/${item.id}/view-qr`,
    imageUrl: `${baseUrl}/api/qr/${item.id}/image`,
    scanUrl: buildScanUrl(item.id, null, baseUrl),
    created_at: item.created_at,
    updated_at: item.updated_at
  };
}
