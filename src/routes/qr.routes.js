import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/pool.js';
import { config } from '../config/env.js';
import { requireApiKey, optionalApiKey } from '../middleware/auth.js';
import { extractDominantColors } from '../services/color.service.js';
import { generateQrPngBuffer, generateQrMatrix } from '../services/qr.service.js';
import { process3dModel } from '../services/model3d.service.js';
import { sanitizeViewerConfig, VIEWER_PRESETS } from '../services/viewerConfig.service.js';
import { eventBus } from '../config/redis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODELS_DIR = path.resolve(__dirname, '../../example-project/models');

const MODEL_CATALOG_META = {
  'museo_tumbas_reales_sipan.glb': {
    name: 'Museo Tumbas Reales de Sipán (Integrado)',
    description: 'Maqueta arquitectónica PBR fiel con 5 frisos Moche, lucernario en celosía y rampa ceremonial (389 KB).',
    viewerUrl: '/example/sipan-nuevo.html'
  },
  'sipan_v2.glb': {
    name: 'Museo Sipán — Ejemplo 2 (HD+)',
    description: 'Versión arquitectónica extendida con pilastras y patio ceremonial cuadrilátero.',
    viewerUrl: '/example/sipan-ejemplo2.html'
  },
  'museo_sipan.glb': {
    name: 'Museo Sipán — Ejemplo 1 (V1 PBR)',
    description: 'Modelo base en pirámide truncada con frisos dorados y fachada terracota.',
    viewerUrl: '/example/museo-sipan.html'
  }
};

export async function qrRoutes(fastify, options) {
  // 0. Catálogo de modelos 3D integrados disponibles en el sistema
  fastify.get('/api/models', async (request, reply) => {
    try {
      if (!fs.existsSync(MODELS_DIR)) {
        return reply.send({ models: [] });
      }
      const files = await fs.promises.readdir(MODELS_DIR);
      const glbFiles = files.filter(f => f.toLowerCase().endsWith('.glb'));
      const models = [];

      for (const filename of glbFiles) {
        const fullPath = path.join(MODELS_DIR, filename);
        const stat = await fs.promises.stat(fullPath);
        const meta = MODEL_CATALOG_META[filename] || {
          name: filename,
          description: 'Modelo 3D GLB disponible en el sistema.',
          viewerUrl: null
        };
        models.push({
          id: filename,
          filename,
          name: meta.name,
          description: meta.description,
          sizeBytes: stat.size,
          sizeFormatted: stat.size >= 1024 * 1024
            ? `${(stat.size / (1024 * 1024)).toFixed(2)} MB`
            : `${(stat.size / 1024).toFixed(1)} KB`,
          downloadUrl: `${config.publicBaseUrl}/example/models/${filename}`,
          viewerUrl: meta.viewerUrl
        });
      }

      // Priorizar el modelo integrado oficial primero
      models.sort((a, b) => {
        if (a.filename === 'museo_tumbas_reales_sipan.glb') return -1;
        if (b.filename === 'museo_tumbas_reales_sipan.glb') return 1;
        return a.filename.localeCompare(b.filename);
      });

      return reply.send({ models });
    } catch (err) {
      return reply.status(500).send({ error: 'No se pudo listar los modelos integrados' });
    }
  });

  // 1. Crear nuevo QR 3D
  fastify.post('/api/qr', { preHandler: [requireApiKey] }, async (request, reply) => {
    let fields = {
      title: 'QR 3D Interactivo',
      target_url: 'https://example.com',
      rotation_strategy: 'one_time',
      max_scans: '1'
    };
    let modelBuffer = null;
    let modelFilename = 'model.glb';
    let modelFormat = 'glb';
    let imageBuffer = null;
    let imageMime = 'image/png';

    if (request.isMultipart && request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const buf = await part.toBuffer();
          if (part.fieldname === 'model' && buf.length > 0 && part.filename) {
            modelBuffer = buf;
            modelFilename = part.filename;
            const ext = part.filename.split('.').pop().toLowerCase();
            modelFormat = ext || 'glb';
          } else if (part.fieldname === 'image' && buf.length > 0) {
            imageBuffer = buf;
            imageMime = part.mimetype || 'image/png';
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    } else if (request.body && typeof request.body === 'object') {
      fields = { ...fields, ...request.body };
    }

    // Permitir seleccionar un modelo ya integrado en el sistema mediante model_preset
    if (!modelBuffer && fields.model_preset) {
      const safePresetName = path.basename(String(fields.model_preset));
      const presetPath = path.resolve(MODELS_DIR, safePresetName);
      if (
        safePresetName.toLowerCase().endsWith('.glb') &&
        presetPath.startsWith(MODELS_DIR + path.sep) &&
        fs.existsSync(presetPath)
      ) {
        modelBuffer = await fs.promises.readFile(presetPath);
        modelFilename = safePresetName;
        modelFormat = 'glb';
      } else {
        return reply.status(400).send({ error: `Modelo preset no encontrado: ${safePresetName}` });
      }
    }

    if (!fields.target_url) {
      return reply.status(400).send({ error: 'target_url es requerido' });
    }

    const qrId = 'qr_' + crypto.randomBytes(6).toString('hex');
    const initialToken = crypto.randomBytes(4).toString('hex');

    // Extraer colores
    let colors = { primary: '#1e293b', secondary: '#ffffff', dominant: '#1e293b' };
    if (imageBuffer && imageBuffer.length > 0) {
      try {
        colors = await extractDominantColors(imageBuffer);
      } catch (err) {
        console.warn('Fallo al extraer colores, usando paleta por defecto:', err.message);
      }
    }

    // Generar QR PNG
    const scanUrl = `${config.publicBaseUrl}/scan/${qrId}?token=${initialToken}`;
    const qrPngBuffer = await generateQrPngBuffer(scanUrl, {
      primary: colors.primary,
      secondary: colors.secondary
    });

    // Procesar modelo 3D con textura QR
    const finalGlbBuffer = await process3dModel({
      modelBuffer,
      format: modelFormat,
      qrPngBuffer,
      dominantColorHex: colors.dominant,
      secondaryColorHex: colors.secondary
    });

    const viewerConfig = sanitizeViewerConfig(fields.viewer_config);

    const metadata = {
      currentToken: initialToken,
      palette: colors.palette || [colors.dominant, '#FFFFFF'],
      viewerConfig,
      createdAt: new Date().toISOString()
    };

    // Guardar en Base de Datos
    await db.query(
      `INSERT INTO qr_items (
        id, tenant_id, title, target_url, rotation_strategy,
        scan_count, max_scans, is_active, color_primary, color_secondary,
        model_blob, model_filename, model_format, image_blob, image_mime,
        current_qr_png, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        qrId,
        request.tenant.id,
        fields.title,
        fields.target_url,
        fields.rotation_strategy || 'one_time',
        0,
        parseInt(fields.max_scans || '1', 10),
        true,
        colors.primary,
        colors.secondary,
        finalGlbBuffer,
        modelFilename,
        modelFormat,
        imageBuffer,
        imageMime,
        qrPngBuffer,
        JSON.stringify(metadata)
      ]
    );

    return reply.status(201).send({
      success: true,
      qr: {
        id: qrId,
        title: fields.title,
        target_url: fields.target_url,
        scan_url: scanUrl,
        rotation_strategy: fields.rotation_strategy,
        colors: {
          primary: colors.primary,
          secondary: colors.secondary,
          dominant: colors.dominant
        },
        modelUrl: `${config.publicBaseUrl}/api/qr/${qrId}/model`,
        imageUrl: `${config.publicBaseUrl}/api/qr/${qrId}/image`,
        viewerConfig,
        embedCode: `<script src="${config.publicBaseUrl}/widget/3dqr-viewer.js" type="module"></script>\n<qr-3d-viewer qr-id="${qrId}" api-url="${config.publicBaseUrl}"></qr-3d-viewer>`
      }
    });
  });

  // 1b. Presets visuales disponibles para el visor 3D (Automático y Manual)
  fastify.get('/api/viewer-presets', async (request, reply) => {
    return reply.send({ presets: VIEWER_PRESETS });
  });

  // 2. Listar QRs del inquilino
  fastify.get('/api/qr', { preHandler: [requireApiKey] }, async (request, reply) => {
    const result = await db.query(
      `SELECT id, title, target_url, rotation_strategy, scan_count, max_scans,
              is_active, color_primary, color_secondary, metadata, created_at, updated_at
       FROM qr_items
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [request.tenant.id]
    );

    return reply.send({
      items: result.rows.map(item => {
        const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});
        const { metadata: _rawMeta, ...rest } = item;
        return {
          ...rest,
          viewerConfig: sanitizeViewerConfig(meta.viewerConfig),
          modelUrl: `${config.publicBaseUrl}/api/qr/${item.id}/model`,
          imageUrl: `${config.publicBaseUrl}/api/qr/${item.id}/image`,
          scanUrl: `${config.publicBaseUrl}/scan/${item.id}`
        };
      })
    });
  });

  // 3. Detalle de un QR
  fastify.get('/api/qr/:qrId', { preHandler: [optionalApiKey] }, async (request, reply) => {
    const { qrId } = request.params;
    const result = await db.query(
      `SELECT id, tenant_id, title, target_url, rotation_strategy, scan_count, max_scans,
              is_active, color_primary, color_secondary, metadata, created_at, updated_at
       FROM qr_items WHERE id = $1`,
      [qrId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }

    const item = result.rows[0];
    const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});
    return reply.send({
      ...item,
      viewerConfig: sanitizeViewerConfig(meta.viewerConfig),
      modelUrl: `${config.publicBaseUrl}/api/qr/${item.id}/model`,
      imageUrl: `${config.publicBaseUrl}/api/qr/${item.id}/image`,
      scanUrl: `${config.publicBaseUrl}/scan/${item.id}`
    });
  });

  // 4. Descargar / Servir modelo 3D GLB
  fastify.get('/api/qr/:qrId/model', async (request, reply) => {
    const { qrId } = request.params;
    const result = await db.query('SELECT model_blob FROM qr_items WHERE id = $1', [qrId]);

    if (result.rows.length === 0 || !result.rows[0].model_blob) {
      return reply.status(404).send({ error: 'Modelo 3D no encontrado' });
    }

    reply
      .header('Content-Type', 'model/gltf-binary')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(result.rows[0].model_blob);
  });

  // 5. Servir la imagen activa del QR
  fastify.get('/api/qr/:qrId/image', async (request, reply) => {
    const { qrId } = request.params;
    const result = await db.query('SELECT current_qr_png FROM qr_items WHERE id = $1', [qrId]);

    if (result.rows.length === 0 || !result.rows[0].current_qr_png) {
      return reply.status(404).send({ error: 'Imagen QR no encontrada' });
    }

    reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send(result.rows[0].current_qr_png);
  });

  // 5b. Servir la matriz binaria activa del QR (para coloreado cromático en vista aérea)
  fastify.get('/api/qr/:qrId/matrix', async (request, reply) => {
    const { qrId } = request.params;
    const result = await db.query('SELECT id, metadata FROM qr_items WHERE id = $1', [qrId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }

    const row = result.rows[0];
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    const scanUrl = metadata.currentToken
      ? `${config.publicBaseUrl}/scan/${qrId}?token=${metadata.currentToken}`
      : `${config.publicBaseUrl}/scan/${qrId}`;

    const matrix = generateQrMatrix(scanUrl);
    reply
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send({
        qrId,
        scanUrl,
        size: matrix.size,
        modules: matrix.modules
      });
  });

  // 6. SSE Stream para actualización en tiempo real sin recargar página
  fastify.get('/api/qr/:qrId/events', async (request, reply) => {
    const { qrId } = request.params;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', qrId })}\n\n`);

    const channel = `qr_events:${qrId}`;
    const onEvent = (eventData) => {
      reply.raw.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    await eventBus.subscribeChannel(channel, onEvent);

    // Heartbeat para mantener conexión viva
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      eventBus.unsubscribeChannel(channel, onEvent);
    });
  });

  // 7. Modificar QR / Rotar manualmente / Guardar configuración visual 3D
  fastify.put('/api/qr/:qrId', { preHandler: [requireApiKey] }, async (request, reply) => {
    const { qrId } = request.params;
    const { target_url, title, is_active, rotate_now, viewer_config } = request.body || {};

    const existing = await db.query('SELECT * FROM qr_items WHERE id = $1 AND tenant_id = $2', [
      qrId,
      request.tenant.id
    ]);

    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'QR no encontrado o no pertenece a este tenant' });
    }

    const item = existing.rows[0];
    const newTargetUrl = target_url || item.target_url;
    let newQrPng = item.current_qr_png;
    const metadata = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});

    if (viewer_config !== undefined) {
      metadata.viewerConfig = sanitizeViewerConfig(viewer_config);
      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'viewer_config_updated',
        qrId,
        viewerConfig: metadata.viewerConfig
      });
    }

    if (rotate_now || target_url) {
      const nextToken = crypto.randomBytes(4).toString('hex');
      metadata.currentToken = nextToken;
      metadata.lastRotatedAt = new Date().toISOString();

      const newScanUrl = `${config.publicBaseUrl}/scan/${qrId}?token=${nextToken}`;
      newQrPng = await generateQrPngBuffer(newScanUrl, {
        primary: item.color_primary,
        secondary: item.color_secondary
      });

      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'qr_updated',
        qrId,
        rotated: true,
        newQrImageUrl: `${config.publicBaseUrl}/api/qr/${qrId}/image?t=${Date.now()}`
      });
    }

    await db.query(
      `UPDATE qr_items 
       SET target_url = $1,
           title = $2,
           is_active = $3,
           current_qr_png = $4,
           metadata = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        newTargetUrl,
        title || item.title,
        is_active ?? item.is_active,
        newQrPng,
        JSON.stringify(metadata),
        qrId
      ]
    );

    return reply.send({
      success: true,
      message: 'QR actualizado con éxito',
      viewerConfig: sanitizeViewerConfig(metadata.viewerConfig)
    });
  });

  // 8. Logs de escaneo
  fastify.get('/api/qr/:qrId/logs', { preHandler: [requireApiKey] }, async (request, reply) => {
    const { qrId } = request.params;
    const result = await db.query(
      'SELECT id, scanned_at, ip_address, user_agent, rotated FROM scan_logs WHERE qr_id = $1 ORDER BY scanned_at DESC LIMIT 100',
      [qrId]
    );
    return reply.send({ logs: result.rows });
  });

  // 9. Eliminar QR
  fastify.delete('/api/qr/:qrId', { preHandler: [requireApiKey] }, async (request, reply) => {
    const { qrId } = request.params;
    const res = await db.query('DELETE FROM qr_items WHERE id = $1 AND tenant_id = $2', [
      qrId,
      request.tenant.id
    ]);

    if (res.rowCount === 0) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }

    return reply.send({ success: true, message: 'QR eliminado correctamente' });
  });
}
