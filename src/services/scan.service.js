import crypto from 'crypto';
import { db } from '../db/pool.js';
import { config } from '../config/env.js';
import { eventBus } from '../config/redis.js';
import { generateQrPngBuffer } from './qr.service.js';

/**
 * Procesa el escaneo público de un QR desechable
 * @param {string} qrId 
 * @param {string} token 
 * @param {object} reqInfo { ip, userAgent }
 * @returns {Promise<{ redirectUrl: string, expired: boolean, reason?: string }>}
 */
export async function processQrScan(qrId, token, reqInfo = {}) {
  const result = await db.query('SELECT * FROM qr_items WHERE id = $1', [qrId]);
  if (result.rows.length === 0) {
    return { expired: true, reason: 'Código QR no encontrado' };
  }

  const item = result.rows[0];
  const metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});

  if (!item.is_active) {
    return { expired: true, reason: 'Este código QR ha sido desactivado permanentemente' };
  }

  // Si tiene token desechable y no coincide con el activo
  if (metadata.currentToken && token && metadata.currentToken !== token) {
    return {
      expired: true,
      reason: 'Este código QR ya fue escaneado y descartado. Por favor use el nuevo código mostrado en pantalla.'
    };
  }

  const newScanCount = item.scan_count + 1;
  const isOneTime = item.rotation_strategy === 'one_time';
  let rotated = false;
  let nextToken = null;

  if (isOneTime) {
    rotated = true;
    nextToken = crypto.randomBytes(4).toString('hex');
    metadata.currentToken = nextToken;
    metadata.lastRotatedAt = new Date().toISOString();

    // Generar nuevo buffer de QR para el siguiente usuario
    const nextScanUrl = `${config.publicBaseUrl}/scan/${qrId}?token=${nextToken}`;
    const newQrPng = await generateQrPngBuffer(nextScanUrl, {
      primary: item.color_primary,
      secondary: item.color_secondary
    });

    // Actualizar en base de datos
    await db.query(
      `UPDATE qr_items 
       SET scan_count = scan_count + 1,
           current_qr_png = $1,
           metadata = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [newQrPng, JSON.stringify(metadata), qrId]
    );

    // Registrar en historial de rotación
    await db.query(
      `INSERT INTO qr_rotation_history (id, qr_id, previous_url, new_url, reason, rotated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        crypto.randomUUID(),
        qrId,
        `${config.publicBaseUrl}/scan/${qrId}?token=${token || 'initial'}`,
        nextScanUrl,
        'one_time_scan_consumed'
      ]
    );

    // Notificar en tiempo real al widget via Redis / EventBus
    await eventBus.publish(`qr_events:${qrId}`, {
      type: 'qr_updated',
      qrId,
      scanCount: newScanCount,
      rotated: true,
      newQrImageUrl: `${config.publicBaseUrl}/api/qr/${qrId}/image?t=${Date.now()}`,
      timestamp: Date.now()
    });
  } else {
    // Si no es desechable de 1 solo uso, solo incrementa el conteo
    await db.query(
      'UPDATE qr_items SET scan_count = scan_count + 1, updated_at = NOW() WHERE id = $1',
      [qrId]
    );

    await eventBus.publish(`qr_events:${qrId}`, {
      type: 'scan_count_updated',
      qrId,
      scanCount: newScanCount,
      timestamp: Date.now()
    });
  }

  // Registrar log de escaneo
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

  return {
    expired: false,
    redirectUrl: item.target_url,
    scanCount: newScanCount,
    rotated
  };
}
