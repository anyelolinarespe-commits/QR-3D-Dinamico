import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, refreshStartupStats } from '../db/pool.js';
import { config } from '../config/env.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { extractDominantColors } from '../services/color.service.js';
import { generateQrPngBuffer, generateQrMatrix } from '../services/qr.service.js';
import { process3dModel } from '../services/model3d.service.js';
import {
  resolveEffectiveViewerConfig,
  sanitizeOptionalHexColor,
  sanitizeTenantDefaultConfig,
  sanitizeViewerConfig,
  VIEWER_PRESETS
} from '../services/viewerConfig.service.js';
import { saveUploadedFile, getSavedFileById } from '../services/fileStorage.service.js';
import { eventBus } from '../config/redis.js';
import {
  buildScanUrl,
  buildViewUrl,
  ensureQrPngForBaseUrl,
  generateViewToken,
  getDailyHistoryForQr,
  getDailyStatsForQr,
  getDailyStatsMapScoped,
  parseBooleanFlag,
  parseMetadata,
  resolveLinkSettings,
  resolveRequestBaseUrl,
  resolveUniqueViewToken,
  rotateQrItemLink,
  sendCachedGlbModel,
  serializeQrItem,
  validateHttpUrl
} from '../services/qrLink.service.js';

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

async function parseQrRequestPayload(request, defaults = {}) {
  let fields = { ...defaults };
  let modelFile = null;
  let imageFile = null;
  const fieldPresence = new Set();

  if (request.isMultipart && request.isMultipart()) {
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const buf = await part.toBuffer();
        if (part.fieldname === 'model' && buf.length > 0 && part.filename) {
          const ext = part.filename.split('.').pop().toLowerCase();
          modelFile = {
            buffer: buf,
            filename: part.filename,
            mime: part.mimetype || 'model/gltf-binary',
            format: ext || 'glb'
          };
        } else if (part.fieldname === 'image' && buf.length > 0) {
          imageFile = {
            buffer: buf,
            filename: part.filename || 'imagen.png',
            mime: part.mimetype || 'image/png'
          };
        }
      } else {
        fieldPresence.add(part.fieldname);
        fields[part.fieldname] = part.value;
      }
    }
  } else if (request.body && typeof request.body === 'object') {
    for (const k of Object.keys(request.body)) {
      fieldPresence.add(k);
    }
    fields = { ...fields, ...request.body };
  }

  return { fields, modelFile, imageFile, fieldPresence };
}

async function resolveQrMediaInputs(fields, { modelFile, imageFile }, fileScope) {
  let modelBuffer = modelFile ? modelFile.buffer : null;
  let modelFilename = modelFile ? modelFile.filename : null;
  let modelFormat = modelFile ? modelFile.format : null;
  const modelMime = modelFile ? modelFile.mime : 'model/gltf-binary';
  const uploadedNewModel = Boolean(modelFile);

  let imageBuffer = imageFile ? imageFile.buffer : null;
  let imageFilename = imageFile ? imageFile.filename : null;
  let imageMime = imageFile ? imageFile.mime : null;
  const uploadedNewImage = Boolean(imageFile);

  if (!modelBuffer && fields.saved_model_id) {
    const savedModel = await getSavedFileById(String(fields.saved_model_id), fileScope);
    if (!savedModel) {
      const err = new Error(`Archivo 3D guardado no encontrado: ${fields.saved_model_id}`);
      err.statusCode = 404;
      throw err;
    }
    modelBuffer = savedModel.file_blob;
    modelFilename = savedModel.filename;
    modelFormat = savedModel.format || 'glb';
  }

  if (!imageBuffer && fields.saved_image_id) {
    const savedImage = await getSavedFileById(String(fields.saved_image_id), fileScope);
    if (!savedImage) {
      const err = new Error(`Imagen guardada no encontrada: ${fields.saved_image_id}`);
      err.statusCode = 404;
      throw err;
    }
    imageBuffer = savedImage.file_blob;
    imageFilename = savedImage.filename;
    imageMime = savedImage.mime_type || 'image/png';
  }

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
      const err = new Error(`Modelo preset no encontrado: ${safePresetName}`);
      err.statusCode = 400;
      throw err;
    }
  }

  return {
    modelBuffer,
    modelFilename,
    modelFormat,
    modelMime,
    uploadedNewModel,
    imageBuffer,
    imageFilename,
    imageMime,
    uploadedNewImage
  };
}

export async function qrRoutes(fastify, options) {
  async function fetchTenantDefaultConfig(tenantId) {
    if (!tenantId) return {};
    const res = await db.query('SELECT default_viewer_config FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
    if (res.rows.length === 0) return {};
    return sanitizeTenantDefaultConfig(res.rows[0].default_viewer_config);
  }

  function getAccessScope(request) {
    const role = request.authUser?.role || (request.tenant?.is_master ? 'superadmin' : 'admin');
    return {
      role,
      tenantId: request.tenant?.is_master ? null : request.tenant?.id,
      userId: request.authUser?.id || null,
      filterTenantId: request.query?.tenant_id ? String(request.query.tenant_id) : null
    };
  }

  async function findOwnedQrItem(qrId, request, columns = '*') {
    const role = request.authUser?.role || (request.tenant?.is_master ? 'superadmin' : 'admin');
    if (role === 'superadmin' || request.tenant?.is_master) {
      const res = await db.query(`SELECT ${columns} FROM qr_items WHERE id = $1`, [qrId]);
      return res.rows[0] || null;
    }
    if (role === 'user') {
      const res = await db.query(
        `SELECT ${columns} FROM qr_items WHERE id = $1 AND tenant_id = $2 AND owner_user_id = $3`,
        [qrId, request.tenant.id, request.authUser.id]
      );
      return res.rows[0] || null;
    }
    const res = await db.query(`SELECT ${columns} FROM qr_items WHERE id = $1 AND tenant_id = $2`, [
      qrId,
      request.tenant.id
    ]);
    return res.rows[0] || null;
  }

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
  fastify.post('/api/qr', { preHandler: [requireAuth] }, async (request, reply) => {
    const { fields, modelFile, imageFile, fieldPresence } = await parseQrRequestPayload(request, {
      title: 'QR 3D Interactivo',
      max_scans: '1'
    });

    const scope = getAccessScope(request);
    let targetTenantId = request.tenant.id;
    if (scope.role === 'superadmin') {
      targetTenantId = String(fields.tenant_id || '').trim() || 'tenant_default';
      const tRes = await db.query('SELECT id FROM tenants WHERE id = $1', [targetTenantId]);
      if (tRes.rows.length === 0) {
        return reply.status(404).send({ error: 'El sitio web (tenant_id) especificado no existe' });
      }
    }

    let ownerUserId = request.authUser?.id || null;
    if ((scope.role === 'superadmin' || scope.role === 'admin') && fields.owner_user_id) {
      const requestedOwnerId = String(fields.owner_user_id).trim();
      const uRes = await db.query('SELECT id, tenant_id, role FROM users WHERE id = $1', [requestedOwnerId]);
      if (uRes.rows.length === 0) {
        return reply.status(404).send({ error: 'El usuario propietario especificado no existe' });
      }
      if (uRes.rows[0].role !== 'superadmin' && uRes.rows[0].tenant_id !== targetTenantId) {
        return reply.status(400).send({ error: 'El usuario propietario no pertenece a ese sitio web' });
      }
      ownerUserId = requestedOwnerId;
    }

    let linkSettings;
    let validatedTargetUrl;
    try {
      linkSettings = resolveLinkSettings(fields);
      const hasExplicitTarget =
        fieldPresence.has('target_url') &&
        fields.target_url !== undefined &&
        String(fields.target_url).trim() !== '';
      if (fieldPresence.has('target_url') && !hasExplicitTarget) {
        return reply.status(400).send({ error: 'target_url es requerido' });
      }
      const rawTarget = hasExplicitTarget
        ? fields.target_url
        : (linkSettings.rotatingUrls[0] || 'https://example.com');
      validatedTargetUrl = validateHttpUrl(rawTarget, 'target_url');
    } catch (err) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }

    let media;
    try {
      media = await resolveQrMediaInputs(fields, { modelFile, imageFile }, scope);
    } catch (err) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }

    let {
      modelBuffer,
      modelFilename,
      modelFormat,
      modelMime,
      uploadedNewModel,
      imageBuffer,
      imageFilename,
      imageMime,
      uploadedNewImage
    } = media;

    modelFilename = modelFilename || 'model.glb';
    modelFormat = modelFormat || 'glb';
    imageFilename = imageFilename || 'logo.png';
    imageMime = imageMime || 'image/png';

    // Persistir los archivos originales subidos en la tabla saved_files para futuros reinicios
    let savedModelMeta = null;
    if (uploadedNewModel && modelBuffer) {
      savedModelMeta = await saveUploadedFile({
        tenantId: targetTenantId,
        ownerUserId,
        fileKind: 'model',
        filename: modelFilename,
        mimeType: modelMime,
        format: modelFormat,
        buffer: modelBuffer
      });
    }

    let savedImageMeta = null;
    if (uploadedNewImage && imageBuffer) {
      savedImageMeta = await saveUploadedFile({
        tenantId: targetTenantId,
        ownerUserId,
        fileKind: 'image',
        filename: imageFilename,
        mimeType: imageMime,
        buffer: imageBuffer
      });
    }

    const qrId = 'qr_' + crypto.randomBytes(6).toString('hex');
    const customSlugInput = fields.view_slug !== undefined ? fields.view_slug : fields.view_token;
    let viewToken;
    try {
      viewToken = customSlugInput !== undefined && String(customSlugInput).trim() !== ''
        ? await resolveUniqueViewToken(String(customSlugInput))
        : generateViewToken();
    } catch (err) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }
    const initialToken = crypto.randomBytes(4).toString('hex');
    const tenantDefaults = await fetchTenantDefaultConfig(targetTenantId);

    // Extraer colores o aplicar colores explícitos / por defecto del tenant
    let colors = {
      primary: tenantDefaults.qrColorPrimary || '#1e293b',
      secondary: tenantDefaults.qrColorSecondary || '#ffffff',
      dominant: tenantDefaults.qrColorPrimary || '#1e293b'
    };
    if (imageBuffer && imageBuffer.length > 0) {
      try {
        colors = await extractDominantColors(imageBuffer);
      } catch (err) {
        console.warn('Fallo al extraer colores, usando paleta por defecto:', err.message);
      }
    }

    const explicitPrimary = sanitizeOptionalHexColor(fields.color_primary, null);
    const explicitSecondary = sanitizeOptionalHexColor(fields.color_secondary, null);
    if (explicitPrimary) {
      colors.primary = explicitPrimary;
      colors.dominant = explicitPrimary;
    }
    if (explicitSecondary) {
      colors.secondary = explicitSecondary;
    }
    if (!colors.palette || explicitPrimary) {
      colors.palette = [colors.dominant, colors.secondary];
    }

    // Generar QR PNG
    const baseUrl = resolveRequestBaseUrl(request);
    const scanUrl = buildScanUrl(qrId, initialToken, baseUrl);
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

    let rawViewerCfg = null;
    if (fields.viewer_config !== undefined && fields.viewer_config !== '') {
      rawViewerCfg = typeof fields.viewer_config === 'string'
        ? JSON.parse(fields.viewer_config)
        : fields.viewer_config;
    }
    const hasCustomViewerConfig = Boolean(
      rawViewerCfg &&
      typeof rawViewerCfg === 'object' &&
      Object.keys(rawViewerCfg).length > 0 &&
      rawViewerCfg.inheritTenant !== true
    );
    const storedViewerConfig = hasCustomViewerConfig ? sanitizeViewerConfig(rawViewerCfg) : null;
    const viewerConfig = resolveEffectiveViewerConfig(storedViewerConfig, tenantDefaults, hasCustomViewerConfig);
    const nowIso = new Date().toISOString();

    const metadata = {
      viewToken,
      viewEnabled: linkSettings.viewEnabled,
      currentToken: initialToken,
      qrBaseUrl: baseUrl,
      linkMode: linkSettings.linkMode,
      rotationIntervalSeconds: linkSettings.rotationIntervalSeconds,
      nextRotationAt: linkSettings.nextRotationAt,
      rotatingUrls: linkSettings.rotatingUrls,
      rotatingUrlIndex: linkSettings.rotatingUrlIndex,
      rotationCount: 0,
      lastRotatedAt: nowIso,
      description: typeof fields.description === 'string' ? fields.description.trim() : '',
      palette: colors.palette || [colors.dominant, '#FFFFFF'],
      hasCustomViewerConfig,
      viewerConfig: storedViewerConfig,
      createdAt: nowIso
    };

    // Guardar en Base de Datos
    await db.query(
      `INSERT INTO qr_items (
        id, tenant_id, owner_user_id, view_token, title, target_url, rotation_strategy,
        scan_count, max_scans, is_active, color_primary, color_secondary,
        model_blob, model_filename, model_format, image_blob, image_mime,
        current_qr_png, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        qrId,
        targetTenantId,
        ownerUserId,
        viewToken,
        fields.title,
        validatedTargetUrl,
        linkSettings.rotationStrategy,
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

    await refreshStartupStats();
    const viewUrl = buildViewUrl(viewToken, baseUrl);

    return reply.status(201).send({
      success: true,
      qr: {
        id: qrId,
        tenant_id: targetTenantId,
        owner_user_id: ownerUserId,
        viewToken,
        viewUrl,
        viewEnabled: linkSettings.viewEnabled,
        title: fields.title,
        description: metadata.description,
        target_url: validatedTargetUrl,
        scan_url: scanUrl,
        rotation_strategy: linkSettings.rotationStrategy,
        linkMode: linkSettings.linkMode,
        rotationIntervalSeconds: linkSettings.rotationIntervalSeconds,
        nextRotationAt: linkSettings.nextRotationAt,
        rotatingUrls: linkSettings.rotatingUrls,
        colors: {
          primary: colors.primary,
          secondary: colors.secondary,
          dominant: colors.dominant
        },
        modelUrl: `${baseUrl}/api/qr/${qrId}/model`,
        imageUrl: `${baseUrl}/api/qr/${qrId}/image`,
        viewerConfig,
        savedModelFile: savedModelMeta,
        savedImageFile: savedImageMeta,
        embedCode: `<script src="${baseUrl}/widget/3dqr-viewer.js" type="module"></script>\n<qr-3d-viewer qr-id="${qrId}" api-url="${baseUrl}"></qr-3d-viewer>`
      }
    });
  });

  // 1b. Presets visuales disponibles para el visor 3D (Automático y Manual)
  fastify.get('/api/viewer-presets', async (request, reply) => {
    return reply.send({ presets: VIEWER_PRESETS });
  });

  // 2. Listar QRs según rol (superadmin: todos; admin: sitio; user: propios)
  fastify.get('/api/qr', { preHandler: [requireAuth] }, async (request, reply) => {
    const baseUrl = resolveRequestBaseUrl(request);
    const scope = getAccessScope(request);
    const where = [];
    const params = [];

    if (scope.role === 'superadmin') {
      if (scope.filterTenantId) {
        params.push(scope.filterTenantId);
        where.push(`q.tenant_id = $${params.length}`);
      }
    } else if (scope.role === 'user') {
      params.push(scope.tenantId);
      where.push(`q.tenant_id = $${params.length}`);
      params.push(scope.userId);
      where.push(`q.owner_user_id = $${params.length}`);
    } else {
      params.push(scope.tenantId);
      where.push(`q.tenant_id = $${params.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [result, dailyMap] = await Promise.all([
      db.query(
        `SELECT q.id, q.tenant_id, q.owner_user_id, q.view_token, q.title, q.target_url, q.rotation_strategy,
                q.scan_count, q.max_scans, q.is_active, q.color_primary, q.color_secondary,
                q.model_filename, q.metadata, q.created_at, q.updated_at,
                t.name AS tenant_name,
                t.default_viewer_config AS tenant_default_viewer_config,
                u.username AS owner_username,
                u.full_name AS owner_name
         FROM qr_items q
         LEFT JOIN tenants t ON t.id = q.tenant_id
         LEFT JOIN users u ON u.id = q.owner_user_id
         ${whereClause}
         ORDER BY q.created_at DESC`,
        params
      ),
      getDailyStatsMapScoped(scope)
    ]);

    const items = result.rows.map((item) =>
      serializeQrItem(item, baseUrl, dailyMap.byQrId.get(item.id) || { todayDate: dailyMap.todayDate })
    );
    const totalScans = result.rows.reduce((acc, row) => acc + Number(row.scan_count || 0), 0);

    return reply.send({
      summary: {
        totalQrs: items.length,
        totalScans,
        dailyScans: dailyMap.totalDailyScans,
        dailyUniqueVisitors: dailyMap.totalDailyUniqueVisitors,
        todayDate: dailyMap.todayDate
      },
      items
    });
  });

  // 2b. Resumen diario global de ingresos y personas únicas
  fastify.get('/api/stats/daily', { preHandler: [requireAuth] }, async (request, reply) => {
    const dailyMap = await getDailyStatsMapScoped(getAccessScope(request));
    return reply.send({
      todayDate: dailyMap.todayDate,
      dailyScans: dailyMap.totalDailyScans,
      dailyUniqueVisitors: dailyMap.totalDailyUniqueVisitors
    });
  });

  // 3. Detalle de un QR
  fastify.get('/api/qr/:qrId', { preHandler: [optionalAuth] }, async (request, reply) => {
    const { qrId } = request.params;
    const baseUrl = resolveRequestBaseUrl(request);
    const result = await db.query(
      `SELECT q.id, q.tenant_id, q.owner_user_id, q.view_token, q.title, q.target_url, q.rotation_strategy, q.scan_count, q.max_scans,
              q.is_active, q.color_primary, q.color_secondary, q.model_filename, q.metadata, q.created_at, q.updated_at,
              t.default_viewer_config AS tenant_default_viewer_config
       FROM qr_items q
       LEFT JOIN tenants t ON t.id = q.tenant_id
       WHERE q.id = $1`,
      [qrId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }

    const item = result.rows[0];
    const dailyStats = await getDailyStatsForQr(item.id);
    return reply.send({
      ...item,
      ...serializeQrItem(item, baseUrl, dailyStats)
    });
  });

  // 3b. Obtener exclusivamente el link público de vista (sin acceso al panel admin)
  fastify.get('/api/qr/:qrId/view-link', { preHandler: [requireAuth] }, async (request, reply) => {
    const { qrId } = request.params;
    const baseUrl = resolveRequestBaseUrl(request);
    const item = await findOwnedQrItem(
      qrId,
      request,
      'id, tenant_id, owner_user_id, view_token, title, rotation_strategy, is_active, metadata'
    );

    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado o no pertenece a este tenant' });
    }

    const summary = serializeQrItem(item, baseUrl);
    return reply.send({
      success: true,
      qrId: summary.id,
      title: summary.title,
      viewToken: summary.viewToken,
      viewUrl: summary.viewUrl,
      viewEnabled: summary.viewEnabled,
      isActive: summary.is_active,
      linkMode: summary.linkMode,
      rotationStrategy: summary.rotation_strategy,
      rotationIntervalSeconds: summary.rotationIntervalSeconds,
      nextRotationAt: summary.nextRotationAt,
      modelUrl: summary.modelUrl,
      imageUrl: summary.imageUrl
    });
  });

  // 3c. Regenerar/revocar o asignar ruta personalizada al link público de vista
  async function handleUpdateViewLink(request, reply) {
    const { qrId } = request.params;
    const baseUrl = resolveRequestBaseUrl(request);
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const item = await findOwnedQrItem(qrId, request, 'id, tenant_id, owner_user_id, view_token, is_active, metadata');

    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado o no pertenece a este tenant' });
    }

    const rawCustom = body.view_slug !== undefined ? body.view_slug : body.view_token;
    const hasCustom = rawCustom !== undefined && String(rawCustom).trim() !== '';

    let newViewToken = item.view_token || parseMetadata(item.metadata).viewToken || generateViewToken();
    if (hasCustom) {
      try {
        newViewToken = await resolveUniqueViewToken(String(rawCustom), qrId);
      } catch (err) {
        return reply.status(err.statusCode || 400).send({ error: err.message });
      }
    } else if (request.method === 'POST') {
      newViewToken = generateViewToken();
    }

    const metadata = parseMetadata(item.metadata);
    const prevViewEnabled = metadata.viewEnabled !== false;
    const nextViewEnabled = body.view_enabled !== undefined
      ? parseBooleanFlag(body.view_enabled, prevViewEnabled)
      : prevViewEnabled;

    metadata.viewToken = newViewToken;
    metadata.viewEnabled = nextViewEnabled;
    if (newViewToken !== item.view_token) {
      metadata.viewTokenRotatedAt = new Date().toISOString();
    }

    await db.query(
      'UPDATE qr_items SET view_token = $1, metadata = $2, updated_at = NOW() WHERE id = $3',
      [newViewToken, JSON.stringify(metadata), qrId]
    );

    if (nextViewEnabled !== prevViewEnabled) {
      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'status_updated',
        qrId,
        isActive: Boolean(item.is_active),
        viewEnabled: nextViewEnabled,
        timestamp: Date.now()
      });
    }

    return reply.send({
      success: true,
      qrId,
      viewToken: newViewToken,
      viewUrl: buildViewUrl(newViewToken, baseUrl),
      viewEnabled: nextViewEnabled
    });
  }

  fastify.post('/api/qr/:qrId/view-link/rotate', { preHandler: [requireAuth] }, handleUpdateViewLink);
  fastify.patch('/api/qr/:qrId/view-link', { preHandler: [requireAuth] }, handleUpdateViewLink);
  fastify.put('/api/qr/:qrId/view-link', { preHandler: [requireAuth] }, handleUpdateViewLink);

  // 4. Descargar / Servir modelo 3D GLB
  fastify.get('/api/qr/:qrId/model', async (request, reply) => {
    const { qrId } = request.params;
    const result = await db.query('SELECT model_blob FROM qr_items WHERE id = $1', [qrId]);

    if (result.rows.length === 0 || !result.rows[0].model_blob) {
      return reply.status(404).send({ error: 'Modelo 3D no encontrado' });
    }

    return sendCachedGlbModel(
      request,
      reply,
      result.rows[0].model_blob,
      'public, max-age=300, must-revalidate'
    );
  });

  // 5. Servir la imagen activa del QR
  fastify.get('/api/qr/:qrId/image', async (request, reply) => {
    const { qrId } = request.params;
    const result = await db.query(
      'SELECT id, color_primary, color_secondary, current_qr_png, metadata FROM qr_items WHERE id = $1',
      [qrId]
    );

    if (result.rows.length === 0 || !result.rows[0].current_qr_png) {
      return reply.status(404).send({ error: 'Imagen QR no encontrada' });
    }

    const baseUrl = resolveRequestBaseUrl(request);
    const pngBuffer = await ensureQrPngForBaseUrl(result.rows[0], baseUrl);

    reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send(pngBuffer);
  });

  // 5b. Servir la matriz binaria activa del QR (para coloreado cromático en vista aérea)
  fastify.get('/api/qr/:qrId/matrix', async (request, reply) => {
    const { qrId } = request.params;
    const result = await db.query('SELECT id, metadata FROM qr_items WHERE id = $1', [qrId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }

    const row = result.rows[0];
    const metadata = parseMetadata(row.metadata);
    const baseUrl = resolveRequestBaseUrl(request);
    const scanUrl = buildScanUrl(qrId, metadata.currentToken || null, baseUrl);

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

    reply.hijack();
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
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      eventBus.unsubscribeChannel(channel, onEvent);
    });
  });

  // 7. Modificar QR / Editar información / Rotar manualmente / Guardar configuración visual 3D
  fastify.put('/api/qr/:qrId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { qrId } = request.params;
    const { fields, modelFile, imageFile } = await parseQrRequestPayload(request);

    const item = await findOwnedQrItem(qrId, request);
    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado o no pertenece a este tenant' });
    }
    const baseUrl = resolveRequestBaseUrl(request);
    const scope = getAccessScope(request);

    let media;
    try {
      media = await resolveQrMediaInputs(fields, { modelFile, imageFile }, scope);
    } catch (err) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }

    const rawTitle = typeof fields.title === 'string' ? fields.title.trim() : '';
    const newTitle = rawTitle || item.title;

    let newTargetUrl = item.target_url;
    let urlChanged = false;
    if (fields.target_url !== undefined) {
      const rawUrl = typeof fields.target_url === 'string' ? fields.target_url.trim() : '';
      if (!rawUrl) {
        return reply.status(400).send({ error: 'target_url no puede estar vacío' });
      }
      try {
        newTargetUrl = validateHttpUrl(rawUrl, 'target_url');
      } catch (err) {
        return reply.status(err.statusCode || 400).send({ error: err.message });
      }
      urlChanged = newTargetUrl !== item.target_url;
    }

    let linkSettings;
    try {
      linkSettings = resolveLinkSettings(fields, item);
    } catch (err) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }

    const newRotationStrategy = linkSettings.rotationStrategy;
    const parsedMaxScans = fields.max_scans !== undefined && fields.max_scans !== ''
      ? Math.max(1, parseInt(fields.max_scans, 10) || item.max_scans || 1)
      : item.max_scans;

    const newIsActive = parseBooleanFlag(fields.is_active, item.is_active);
    const shouldRotate = parseBooleanFlag(fields.rotate_now, false);

    const metadata = parseMetadata(item.metadata);
    const prevViewEnabled = metadata.viewEnabled !== false;
    const rawCustomSlug = fields.view_slug !== undefined ? fields.view_slug : fields.view_token;
    let viewToken = item.view_token || metadata.viewToken || generateViewToken();
    if (rawCustomSlug !== undefined && String(rawCustomSlug).trim() !== '') {
      try {
        viewToken = await resolveUniqueViewToken(String(rawCustomSlug), qrId);
      } catch (err) {
        return reply.status(err.statusCode || 400).send({ error: err.message });
      }
    }

    metadata.viewToken = viewToken;
    metadata.viewEnabled = linkSettings.viewEnabled;
    metadata.linkMode = linkSettings.linkMode;
    metadata.rotationIntervalSeconds = linkSettings.rotationIntervalSeconds;
    metadata.nextRotationAt = linkSettings.nextRotationAt;
    metadata.rotatingUrls = linkSettings.rotatingUrls;
    metadata.rotatingUrlIndex = linkSettings.rotatingUrlIndex;

    if (typeof fields.description === 'string') {
      metadata.description = fields.description.trim();
    }

    const tenantDefaults = await fetchTenantDefaultConfig(item.tenant_id);

    if (fields.viewer_config !== undefined) {
      let parsedCfg = null;
      if (fields.viewer_config !== null && fields.viewer_config !== '') {
        parsedCfg = typeof fields.viewer_config === 'string'
          ? JSON.parse(fields.viewer_config)
          : fields.viewer_config;
      }
      const wantsReset =
        parsedCfg === null ||
        (typeof parsedCfg === 'object' && (parsedCfg.inheritTenant === true || parsedCfg.reset === true));
      if (wantsReset) {
        metadata.hasCustomViewerConfig = false;
        metadata.viewerConfig = null;
      } else {
        metadata.hasCustomViewerConfig = true;
        metadata.viewerConfig = sanitizeViewerConfig(parsedCfg);
      }
      const effectiveCfg = resolveEffectiveViewerConfig(
        metadata.viewerConfig,
        tenantDefaults,
        metadata.hasCustomViewerConfig
      );
      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'viewer_config_updated',
        qrId,
        viewerConfig: effectiveCfg
      });
    }

    // Actualizar paleta e imagen si se subió o eligió una nueva o si se enviaron colores explícitos
    let colorPrimary = item.color_primary;
    let colorSecondary = item.color_secondary;
    let dominantColor = (metadata.palette && metadata.palette[0]) || item.color_primary || '#1e293b';
    let newImageBlob = item.image_blob;
    let newImageMime = item.image_mime;

    if (media.uploadedNewImage && media.imageBuffer) {
      await saveUploadedFile({
        tenantId: item.tenant_id,
        ownerUserId: item.owner_user_id || request.authUser?.id || null,
        fileKind: 'image',
        filename: media.imageFilename || 'imagen.png',
        mimeType: media.imageMime || 'image/png',
        buffer: media.imageBuffer
      });
    }

    if (media.imageBuffer && media.imageBuffer.length > 0) {
      newImageBlob = media.imageBuffer;
      newImageMime = media.imageMime || 'image/png';
      try {
        const colors = await extractDominantColors(media.imageBuffer);
        colorPrimary = colors.primary;
        colorSecondary = colors.secondary;
        dominantColor = colors.dominant;
        metadata.palette = colors.palette || [colors.dominant, '#FFFFFF'];
      } catch (err) {
        console.warn('Fallo al extraer colores en edición:', err.message);
      }
    }

    const explicitPrimary = sanitizeOptionalHexColor(fields.color_primary, null);
    const explicitSecondary = sanitizeOptionalHexColor(fields.color_secondary, null);
    if (explicitPrimary) {
      colorPrimary = explicitPrimary;
      dominantColor = explicitPrimary;
      metadata.palette = [explicitPrimary, explicitSecondary || colorSecondary || '#FFFFFF'];
    }
    if (explicitSecondary) {
      colorSecondary = explicitSecondary;
    }

    let newQrPng = item.current_qr_png;
    const imageChanged = Boolean(media.imageBuffer && media.imageBuffer.length > 0);
    const colorChanged = colorPrimary !== item.color_primary || colorSecondary !== item.color_secondary;
    if (shouldRotate || urlChanged || imageChanged || colorChanged) {
      const oldToken = metadata.currentToken || 'initial';
      const token = (shouldRotate || urlChanged || !metadata.currentToken)
        ? crypto.randomBytes(4).toString('hex')
        : metadata.currentToken;
      metadata.currentToken = token;
      metadata.qrBaseUrl = baseUrl;
      const nowIso = new Date().toISOString();
      if (shouldRotate || urlChanged) {
        metadata.lastRotatedAt = nowIso;
        metadata.rotationCount = Number(metadata.rotationCount || 0) + 1;
        metadata.lastRotationReason = urlChanged ? 'target_url_updated' : 'manual_rotate';
      }
      const newScanUrl = buildScanUrl(qrId, token, baseUrl);
      newQrPng = await generateQrPngBuffer(newScanUrl, {
        primary: colorPrimary,
        secondary: colorSecondary
      });

      if (shouldRotate || urlChanged) {
        await db.query(
          `INSERT INTO qr_rotation_history (id, qr_id, previous_url, new_url, reason, rotated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            crypto.randomUUID(),
            qrId,
            buildScanUrl(qrId, oldToken, baseUrl),
            newScanUrl,
            urlChanged ? 'target_url_updated' : 'manual_rotate'
          ]
        );
      }

      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'qr_updated',
        qrId,
        rotated: shouldRotate || urlChanged,
        rotationCount: Number(metadata.rotationCount || 0),
        linkMode: linkSettings.linkMode,
        rotationStrategy: newRotationStrategy,
        rotationIntervalSeconds: linkSettings.rotationIntervalSeconds,
        nextRotationAt: linkSettings.nextRotationAt,
        lastRotatedAt: metadata.lastRotatedAt || nowIso,
        newQrImageUrl: `${baseUrl}/api/qr/${qrId}/image?t=${Date.now()}`,
        timestamp: Date.now()
      });
    } else if (
      newRotationStrategy !== item.rotation_strategy ||
      linkSettings.rotationIntervalSeconds !== Number(parseMetadata(item.metadata).rotationIntervalSeconds || 0)
    ) {
      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'link_config_updated',
        qrId,
        linkMode: linkSettings.linkMode,
        rotationStrategy: newRotationStrategy,
        rotationIntervalSeconds: linkSettings.rotationIntervalSeconds,
        nextRotationAt: linkSettings.nextRotationAt,
        timestamp: Date.now()
      });
    }

    if (newIsActive !== Boolean(item.is_active) || linkSettings.viewEnabled !== prevViewEnabled) {
      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'status_updated',
        qrId,
        isActive: newIsActive,
        viewEnabled: linkSettings.viewEnabled,
        timestamp: Date.now()
      });
    }

    // Reemplazar modelo 3D solo si se subió o seleccionó uno nuevo
    let newModelBlob = item.model_blob;
    let newModelFilename = item.model_filename;
    let newModelFormat = item.model_format;

    if (media.uploadedNewModel && media.modelBuffer) {
      await saveUploadedFile({
        tenantId: item.tenant_id,
        ownerUserId: item.owner_user_id || request.authUser?.id || null,
        fileKind: 'model',
        filename: media.modelFilename || 'model.glb',
        mimeType: media.modelMime || 'model/gltf-binary',
        format: media.modelFormat || 'glb',
        buffer: media.modelBuffer
      });
    }

    if (media.modelBuffer) {
      newModelFilename = media.modelFilename || item.model_filename || 'model.glb';
      newModelFormat = media.modelFormat || 'glb';
      newModelBlob = await process3dModel({
        modelBuffer: media.modelBuffer,
        format: newModelFormat,
        qrPngBuffer: newQrPng,
        dominantColorHex: dominantColor,
        secondaryColorHex: colorSecondary
      });
    } else if ((imageChanged || colorChanged) && item.model_blob) {
      newModelBlob = await process3dModel({
        modelBuffer: item.model_blob,
        format: item.model_format || 'glb',
        qrPngBuffer: newQrPng,
        dominantColorHex: dominantColor,
        secondaryColorHex: colorSecondary
      });
    }

    await db.query(
      `UPDATE qr_items 
       SET target_url = $1,
           title = $2,
           rotation_strategy = $3,
           max_scans = $4,
           is_active = $5,
           color_primary = $6,
           color_secondary = $7,
           model_blob = $8,
           model_filename = $9,
           model_format = $10,
           image_blob = $11,
           image_mime = $12,
           current_qr_png = $13,
           metadata = $14,
           view_token = $15,
           updated_at = NOW()
       WHERE id = $16`,
      [
        newTargetUrl,
        newTitle,
        newRotationStrategy,
        parsedMaxScans,
        newIsActive,
        colorPrimary,
        colorSecondary,
        newModelBlob,
        newModelFilename,
        newModelFormat,
        newImageBlob,
        newImageMime,
        newQrPng,
        JSON.stringify(metadata),
        viewToken,
        qrId
      ]
    );

    await refreshStartupStats();

    const dailyStats = await getDailyStatsForQr(qrId);
    const serialized = serializeQrItem(
      {
        ...item,
        view_token: viewToken,
        title: newTitle,
        target_url: newTargetUrl,
        rotation_strategy: newRotationStrategy,
        max_scans: parsedMaxScans,
        is_active: newIsActive,
        color_primary: colorPrimary,
        color_secondary: colorSecondary,
        model_filename: newModelFilename,
        metadata,
        tenant_default_viewer_config: tenantDefaults
      },
      baseUrl,
      dailyStats
    );

    return reply.send({
      success: true,
      message: 'QR actualizado con éxito',
      viewerConfig: serialized.viewerConfig,
      qr: serialized
    });
  });

  // 7b. Actualizar comportamiento de link (estático vs dinámico) o destino vía API externa
  async function handleLinkUpdate(request, reply) {
    const { qrId } = request.params;
    const body = request.body && typeof request.body === 'object' ? request.body : {};

    const item = await findOwnedQrItem(qrId, request);
    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado o no pertenece a este tenant' });
    }
    const baseUrl = resolveRequestBaseUrl(request);

    let nextTargetUrl = item.target_url;
    let urlChanged = false;
    if (body.target_url !== undefined) {
      try {
        nextTargetUrl = validateHttpUrl(body.target_url, 'target_url');
      } catch (err) {
        return reply.status(err.statusCode || 400).send({ error: err.message });
      }
      urlChanged = nextTargetUrl !== item.target_url;
    }

    let linkSettings;
    try {
      linkSettings = resolveLinkSettings(body, item);
    } catch (err) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }

    const shouldRotate = parseBooleanFlag(body.rotate_now, false);
    const meta = parseMetadata(item.metadata);
    const prevViewEnabled = meta.viewEnabled !== false;
    const rawCustomSlug = body.view_slug !== undefined ? body.view_slug : body.view_token;
    let viewToken = item.view_token || meta.viewToken || generateViewToken();
    if (rawCustomSlug !== undefined && String(rawCustomSlug).trim() !== '') {
      try {
        viewToken = await resolveUniqueViewToken(String(rawCustomSlug), qrId);
      } catch (err) {
        return reply.status(err.statusCode || 400).send({ error: err.message });
      }
    }

    meta.viewToken = viewToken;
    meta.viewEnabled = linkSettings.viewEnabled;
    meta.linkMode = linkSettings.linkMode;
    meta.rotationIntervalSeconds = linkSettings.rotationIntervalSeconds;
    meta.nextRotationAt = linkSettings.nextRotationAt;
    meta.rotatingUrls = linkSettings.rotatingUrls;
    meta.rotatingUrlIndex = linkSettings.rotatingUrlIndex;

    await db.query(
      `UPDATE qr_items
       SET rotation_strategy = $1,
           view_token = $2,
           metadata = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [linkSettings.rotationStrategy, viewToken, JSON.stringify(meta), qrId]
    );

    const updatedRow = {
      ...item,
      view_token: viewToken,
      rotation_strategy: linkSettings.rotationStrategy,
      metadata: meta
    };

    if (shouldRotate || urlChanged) {
      await rotateQrItemLink(updatedRow, {
        reason: urlChanged ? 'api_target_updated' : 'api_manual_rotate',
        newTargetUrl: nextTargetUrl,
        baseUrl
      });
    } else {
      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'link_config_updated',
        qrId,
        linkMode: linkSettings.linkMode,
        rotationStrategy: linkSettings.rotationStrategy,
        rotationIntervalSeconds: linkSettings.rotationIntervalSeconds,
        nextRotationAt: linkSettings.nextRotationAt,
        timestamp: Date.now()
      });
    }

    if (linkSettings.viewEnabled !== prevViewEnabled) {
      await eventBus.publish(`qr_events:${qrId}`, {
        type: 'status_updated',
        qrId,
        isActive: Boolean(item.is_active),
        viewEnabled: linkSettings.viewEnabled,
        timestamp: Date.now()
      });
    }

    const [refreshed, dailyStats, tenantDefaults] = await Promise.all([
      findOwnedQrItem(
        qrId,
        request,
        'id, tenant_id, owner_user_id, view_token, title, target_url, rotation_strategy, scan_count, max_scans, is_active, color_primary, color_secondary, model_filename, metadata, created_at, updated_at'
      ),
      getDailyStatsForQr(qrId),
      fetchTenantDefaultConfig(item.tenant_id)
    ]);

    return reply.send({
      success: true,
      qr: serializeQrItem({ ...refreshed, tenant_default_viewer_config: tenantDefaults }, baseUrl, dailyStats)
    });
  }

  fastify.patch('/api/qr/:qrId/link', { preHandler: [requireAuth] }, handleLinkUpdate);
  fastify.put('/api/qr/:qrId/link', { preHandler: [requireAuth] }, handleLinkUpdate);

  // 7c. Rotación inmediata del enlace QR
  fastify.post('/api/qr/:qrId/rotate', { preHandler: [requireAuth] }, async (request, reply) => {
    const { qrId } = request.params;
    const baseUrl = resolveRequestBaseUrl(request);
    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const item = await findOwnedQrItem(qrId, request);

    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado o no pertenece a este tenant' });
    }

    let nextTargetUrl = null;
    if (body.target_url !== undefined) {
      try {
        nextTargetUrl = validateHttpUrl(body.target_url, 'target_url');
      } catch (err) {
        return reply.status(err.statusCode || 400).send({ error: err.message });
      }
    }

    await rotateQrItemLink(item, {
      reason: nextTargetUrl ? 'api_target_updated' : 'api_manual_rotate',
      newTargetUrl: nextTargetUrl,
      baseUrl
    });

    const [refreshed, dailyStats, tenantDefaults] = await Promise.all([
      findOwnedQrItem(
        qrId,
        request,
        'id, tenant_id, owner_user_id, view_token, title, target_url, rotation_strategy, scan_count, max_scans, is_active, color_primary, color_secondary, model_filename, metadata, created_at, updated_at'
      ),
      getDailyStatsForQr(qrId),
      fetchTenantDefaultConfig(item.tenant_id)
    ]);
    return reply.send({
      success: true,
      qr: serializeQrItem({ ...refreshed, tenant_default_viewer_config: tenantDefaults }, baseUrl, dailyStats)
    });
  });

  // 7d. Historial de rotaciones de enlace
  fastify.get('/api/qr/:qrId/rotation-history', { preHandler: [requireAuth] }, async (request, reply) => {
    const { qrId } = request.params;
    const item = await findOwnedQrItem(qrId, request, 'id');
    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }
    const result = await db.query(
      'SELECT id, previous_url, new_url, reason, rotated_at FROM qr_rotation_history WHERE qr_id = $1 ORDER BY rotated_at DESC LIMIT 100',
      [qrId]
    );
    return reply.send({ history: result.rows });
  });

  // 8a. Estadísticas diarias e historial por día (ingresos al link y personas únicas)
  fastify.get('/api/qr/:qrId/daily-stats', { preHandler: [requireAuth] }, async (request, reply) => {
    const { qrId } = request.params;
    const item = await findOwnedQrItem(qrId, request, 'id, title, scan_count');
    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }
    const requestedDays = request.query?.days;
    const [dailyStats, days] = await Promise.all([
      getDailyStatsForQr(qrId),
      getDailyHistoryForQr(qrId, requestedDays)
    ]);
    return reply.send({
      qrId,
      title: item.title || 'Sin título',
      totalScans: Number(item.scan_count || 0),
      ...dailyStats,
      days
    });
  });

  // 8. Logs de escaneo
  fastify.get('/api/qr/:qrId/logs', { preHandler: [requireAuth] }, async (request, reply) => {
    const { qrId } = request.params;
    const item = await findOwnedQrItem(qrId, request, 'id, scan_count');
    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }
    const [result, daily] = await Promise.all([
      db.query(
        'SELECT id, scanned_at, ip_address, user_agent, rotated, target_url FROM scan_logs WHERE qr_id = $1 ORDER BY scanned_at DESC LIMIT 100',
        [qrId]
      ),
      getDailyStatsForQr(qrId)
    ]);
    return reply.send({ daily, totalScans: Number(item.scan_count || 0), logs: result.rows });
  });

  // 9. Eliminar QR
  fastify.delete('/api/qr/:qrId', { preHandler: [requireAuth] }, async (request, reply) => {
    const { qrId } = request.params;
    const item = await findOwnedQrItem(qrId, request, 'id');
    if (!item) {
      return reply.status(404).send({ error: 'QR no encontrado' });
    }

    await db.query('DELETE FROM qr_items WHERE id = $1', [qrId]);
    await refreshStartupStats();
    return reply.send({ success: true, message: 'QR eliminado correctamente' });
  });
}
