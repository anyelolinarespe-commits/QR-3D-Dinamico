import { processQrScan } from '../services/scan.service.js';
import { resolveRequestBaseUrl, serializePublicViewData } from '../services/qrLink.service.js';
import { renderScannerArPage } from './view.routes.js';
import { renderIcon } from '../../widget/icons.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function scanRoutes(fastify, options) {
  fastify.get('/scan/:qrId', async (request, reply) => {
    const { qrId } = request.params;
    const { token } = request.query;

    const reqInfo = {
      ip: request.ip || request.headers['x-forwarded-for'] || '127.0.0.1',
      userAgent: request.headers['user-agent'] || 'Unknown'
    };

    const result = await processQrScan(qrId, token, reqInfo);

    if (result.expired) {
      const badgeLabel = escapeHtml(result.badgeLabel || 'Código de 1 solo uso');
      const reasonText = escapeHtml(
        result.reason ||
          'Este código QR desechable ya fue escaneado por otro usuario. Mira la pantalla interactiva para ver el nuevo código generado.'
      );
      reply.type('text/html').send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código QR Expirado</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 420px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .icon { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 16px; background: rgba(239, 68, 68, 0.14); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); margin: 0 auto 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #f87171; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
    .badge { display: inline-block; background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; border: 1px solid rgba(239, 68, 68, 0.3); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${renderIcon('hourglass', { size: 32 })}</div>
    <span class="badge">${badgeLabel}</span>
    <h1 style="margin-top: 16px;">QR Ya Utilizado o Expirado</h1>
    <p>${reasonText}</p>
  </div>
</body>
</html>`);
      return;
    }

    // Si el QR está configurado para abrir la experiencia 3D + AR al escanear, renderizarla directo para el visitante
    if (result.scanMode === 'ar' && result.item && request.query?.redirect !== '1') {
      const baseUrl = resolveRequestBaseUrl(request);
      const viewData = serializePublicViewData(result.item, baseUrl, result);
      return reply
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .type('text/html')
        .send(
          renderScannerArPage(viewData, {
            targetUrl: result.redirectUrl,
            query: request.query || {}
          })
        );
    }

    // Redirección inmediata al destino real
    return reply.redirect(result.redirectUrl, 302);
  });
}
