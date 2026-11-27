import { db } from '../db/pool.js';
import {
  isTimedStrategy,
  parseMetadata,
  rotateQrItemLink
} from './qrLink.service.js';

let schedulerTimer = null;
let isTicking = false;

/**
 * Ejecuta un ciclo de revisión para rotar automáticamente los QRs configurados con intervalo de tiempo.
 * @returns {Promise<number>} Cantidad de QRs rotados en este ciclo
 */
export async function runRotationTickNow() {
  if (isTicking || !db.isReady()) return 0;
  isTicking = true;
  let rotatedCount = 0;

  try {
    const res = await db.query(
      `SELECT id, tenant_id, title, target_url, rotation_strategy, scan_count, max_scans,
              is_active, color_primary, color_secondary, view_token, metadata
       FROM qr_items
       WHERE is_active = $1`,
      [true]
    );

    const nowMs = Date.now();
    for (const item of res.rows) {
      const meta = parseMetadata(item.metadata);
      const intervalSec = Number(meta.rotationIntervalSeconds || 0);
      if (!isTimedStrategy(item.rotation_strategy, intervalSec)) {
        continue;
      }

      const nextMs = meta.nextRotationAt ? Date.parse(meta.nextRotationAt) : NaN;
      if (Number.isNaN(nextMs) || nowMs >= nextMs) {
        try {
          await rotateQrItemLink(item, { reason: 'auto_interval' });
          rotatedCount++;
        } catch (err) {
          console.warn(`[WARN] Fallo al rotar automáticamente QR ${item.id}:`, err.message);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'DB_SERVICE_INACTIVE') {
      console.warn('[WARN] Error en el planificador de rotación de QRs:', err.message);
    }
  } finally {
    isTicking = false;
  }

  return rotatedCount;
}

export function startQrRotationScheduler(pollMs = 1000) {
  stopQrRotationScheduler();
  const safePoll = Math.max(250, Number(pollMs) || 1000);
  schedulerTimer = setInterval(() => {
    runRotationTickNow().catch(() => {});
  }, safePoll);
  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }
  return schedulerTimer;
}

export function stopQrRotationScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
