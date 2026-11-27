import { db } from '../db/pool.js';
import { eventBus } from '../config/redis.js';
import {
  buildScanUrl,
  getDailyStatsForQr,
  parseMetadata,
  rotateQrItemLink
} from './qrLink.service.js';

/**
 * Procesa el escaneo público de un QR (estático, desechable 1-uso, por intervalo o dinámico)
 * @param {string} qrId 
 * @param {string} token 
 * @param {object} reqInfo { ip, userAgent }
 * @returns {Promise<{ redirectUrl?: string, expired: boolean, reason?: string, badgeLabel?: string }>}
 */
export async function processQrScan(qrId, token, reqInfo = {}) {
  const result = await db.query(
    `SELECT q.*, t.default_viewer_config AS tenant_default_viewer_config
     FROM qr_items q
     LEFT JOIN tenants t ON t.id = q.tenant_id
     WHERE q.id = $1`,
    [qrId]
  );
  if (result.rows.length === 0) {
    return {
      expired: true,
      badgeLabel: 'QR no encontrado',
      reason: 'Código QR no encontrado'
    };
  }

  const item = result.rows[0];
  const metadata = parseMetadata(item.metadata);

  if (!item.is_active) {
    return {
      expired: true,
      badgeLabel: 'QR desactivado',
      reason: 'Este código QR ha sido desactivado permanentemente'
    };
  }

  // Si tiene token activo y no coincide con el token escaneado
  if (metadata.currentToken && token && metadata.currentToken !== token) {
    const isTimed = item.rotation_strategy === 'timed';
    return {
      expired: true,
      badgeLabel: isTimed ? 'Código Dinámico Expirado' : 'Código de 1 solo uso',
      reason: isTimed
        ? 'Este código QR dinámico expiró porque su enlace rotó automáticamente. Mira la vista 3D para escanear el código activo.'
        : 'Este código QR ya fue escaneado y descartado. Por favor use el nuevo código mostrado en pantalla.'
    };
  }

  const shouldRotateOnScan =
    item.rotation_strategy === 'one_time' || item.rotation_strategy === 'dynamic';

  let newScanCount = Number(item.scan_count || 0) + 1;
  let rotated = false;
  let rotRes = null;

  if (shouldRotateOnScan) {
    rotated = true;
    rotRes = await rotateQrItemLink(item, {
      reason: 'one_time_scan_consumed',
      previousScanUrl: buildScanUrl(qrId, token || 'initial'),
      incrementScanCount: true,
      publishEvent: false
    });
    newScanCount = rotRes.scanCount;
  } else {
    // Estático / Continuo / Timed: incrementa el contador sin rotar por este escaneo
    await db.query(
      'UPDATE qr_items SET scan_count = scan_count + 1, updated_at = NOW() WHERE id = $1',
      [qrId]
    );
  }

  // Registrar log de escaneo antes de calcular estadísticas y emitir evento SSE
  await db.query(
    `INSERT INTO scan_logs (qr_id, tenant_id, ip_address, user_agent, rotated, target_url)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      qrId,
      item.tenant_id,
      reqInfo.ip || '127.0.0.1',
      reqInfo.userAgent || 'Unknown',
      rotated,
      item.target_url
    ]
  );

  const dailyStats = await getDailyStatsForQr(qrId);

  if (shouldRotateOnScan && rotRes?.eventPayload) {
    await eventBus.publish(`qr_events:${qrId}`, {
      ...rotRes.eventPayload,
      ...dailyStats
    });
  } else {
    await eventBus.publish(`qr_events:${qrId}`, {
      type: 'scan_count_updated',
      qrId,
      scanCount: newScanCount,
      ...dailyStats,
      timestamp: Date.now()
    });
  }

  return {
    expired: false,
    scanMode: metadata.scanMode === 'ar' ? 'ar' : 'redirect',
    redirectUrl: item.target_url,
    item: {
      ...item,
      scan_count: newScanCount,
      metadata: rotRes?.metadata || metadata
    },
    scanCount: newScanCount,
    ...dailyStats,
    rotated
  };
}
