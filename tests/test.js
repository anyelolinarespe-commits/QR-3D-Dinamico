import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { DatabaseSync } from 'node:sqlite';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { initDb, closeDb, db, setDbErrorForTest } from '../src/db/pool.js';
import { eventBus } from '../src/config/redis.js';
import { registerServiceHealthAndGuard } from '../src/middleware/serviceGuard.js';
import { qrRoutes } from '../src/routes/qr.routes.js';
import { filesRoutes } from '../src/routes/files.routes.js';
import { scanRoutes } from '../src/routes/scan.routes.js';
import { tenantRoutes } from '../src/routes/tenant.routes.js';
import { authRoutes } from '../src/routes/auth.routes.js';
import { usersRoutes } from '../src/routes/users.routes.js';
import { viewRoutes } from '../src/routes/view.routes.js';
import { runRotationTickNow, stopQrRotationScheduler } from '../src/services/qrScheduler.service.js';
import { generateQrMatrix, generateQrPngBuffer } from '../src/services/qr.service.js';
import { config } from '../src/config/env.js';

async function buildTestApp() {
  const app = Fastify({ bodyLimit: config.maxModelSizeMb * 1024 * 1024 });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });
  await app.register(multipart, {
    limits: { fileSize: config.maxModelSizeMb * 1024 * 1024 }
  });
  registerServiceHealthAndGuard(app);
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(qrRoutes);
  await app.register(filesRoutes);
  await app.register(scanRoutes);
  await app.register(tenantRoutes);
  await app.register(viewRoutes);
  await app.ready();
  return app;
}

async function runTests() {
  console.log('🧪 Iniciando Suite de Pruebas de la API 3D-QR...\n');

  const testSqlitePath = path.join(os.tmpdir(), `qr3d_test_${process.pid}_${Date.now()}.sqlite`);
  let app = null;

  try {
    // 1. Inicializar DB SQLite persistente aislada & EventBus
    await initDb({ sqlitePath: testSqlitePath, dbEngine: 'sqlite' });
    await eventBus.init();
    assert.ok(db.isReady(), 'La base de datos debe quedar lista al iniciar');

    app = await buildTestApp();

  const validKey = config.devTenantKey;
  let createdQrId = null;
  let initialToken = null;

  // Test 1: Autenticación rechaza peticiones sin API Key
  console.log('Test 1: Verificando rechazo sin API Key...');
  const resNoAuth = await app.inject({
    method: 'GET',
    url: '/api/qr'
  });
  assert.strictEqual(resNoAuth.statusCode, 401, 'Debe retornar 401 Unauthorized sin API key');
  console.log('✅ 401 Unauthorized verificado correctamente.');

  // Test 2: Crear QR 3D con imagen de prueba (extracción de color y síntesis 3D)
  console.log('\nTest 2: Creación de QR 3D con síntesis PBR y colores...');
  
  // Generar imagen de prueba en memoria (cuadrado color púrpura #7c3aed)
  const testImgBuffer = await sharp({
    create: {
      width: 120,
      height: 120,
      channels: 4,
      background: { r: 124, g: 58, b: 237, alpha: 1 }
    }
  }).png().toBuffer();

  // Construir multipart body manual
  const boundary = '----WebKitFormBoundaryTest123';
  const parts = [];

  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nTest VIP 3D QR`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="target_url"\r\n\r\nhttps://google.com/destination-test`);
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="rotation_strategy"\r\n\r\none_time`);
  
  const headerImg = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="logo.png"\r\nContent-Type: image/png\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(parts.join('\r\n') + '\r\n'),
    Buffer.from(headerImg),
    testImgBuffer,
    Buffer.from(footer)
  ]);

  const resCreate = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: {
      'x-api-key': validKey,
      'content-type': `multipart/form-data; boundary=${boundary}`
    },
    payload: bodyBuffer
  });

  assert.strictEqual(resCreate.statusCode, 201, `Creación debe retornar 201: ${resCreate.body}`);
  const createdData = JSON.parse(resCreate.body);
  assert.ok(createdData.success, 'Respuesta debe indicar success: true');
  assert.ok(createdData.qr.id.startsWith('qr_'), 'El ID debe tener formato qr_xxx');
  assert.ok(createdData.qr.colors.primary, 'Debe haber extraído el color primario');

  createdQrId = createdData.qr.id;
  console.log(`✅ QR 3D generado con ID: ${createdQrId}`);
  console.log(`   Color extraído: ${createdData.qr.colors.primary} (Dominante: ${createdData.qr.colors.dominant})`);

  // Extraer token de la scan_url
  const scanUrlObj = new URL(createdData.qr.scan_url);
  initialToken = scanUrlObj.searchParams.get('token');
  assert.ok(initialToken, 'Debe contener un token inicial de un solo uso');

  // Test 3: Descarga de Modelo 3D GLB binario
  console.log('\nTest 3: Verificando descarga y formato de modelo 3D GLB...');
  const resModel = await app.inject({
    method: 'GET',
    url: `/api/qr/${createdQrId}/model`
  });
  assert.strictEqual(resModel.statusCode, 200);
  assert.strictEqual(resModel.headers['content-type'], 'model/gltf-binary');
  const magic = resModel.rawPayload.slice(0, 4).toString('ascii');
  assert.strictEqual(magic, 'glTF', 'El archivo debe tener la cabecera mágica binaria glTF');
  console.log(`✅ Modelo GLB válido verificado (${resModel.rawPayload.length} bytes con cabecera glTF).`);

  // Test 4: Descarga de imagen activa de QR PNG
  console.log('\nTest 4: Verificando servicio de imagen PNG del QR...');
  const resImg = await app.inject({
    method: 'GET',
    url: `/api/qr/${createdQrId}/image`
  });
  assert.strictEqual(resImg.statusCode, 200);
  assert.strictEqual(resImg.headers['content-type'], 'image/png');
  console.log(`✅ Imagen QR PNG activa servida correctamente (${resImg.rawPayload.length} bytes).`);

  // Test 5: Escaneo válido de 1er uso -> Redirección 302 y rotación
  console.log('\nTest 5: Simulando escaneo móvil con token válido (1-time scan)...');
  const resScanValid = await app.inject({
    method: 'GET',
    url: `/scan/${createdQrId}?token=${initialToken}`
  });
  assert.strictEqual(resScanValid.statusCode, 302, 'Debe redirigir con HTTP 302 Found');
  assert.strictEqual(resScanValid.headers.location, 'https://google.com/destination-test');
  console.log('✅ Redirección 302 hacia el destino exitosa.');

  // Test 6: Re-escaneo del MISMO código descartado -> Debe fallar / mostrar pantalla expirada
  console.log('\nTest 6: Verificando descarte del código usado (One-time protection)...');
  const resScanExpired = await app.inject({
    method: 'GET',
    url: `/scan/${createdQrId}?token=${initialToken}`
  });
  assert.strictEqual(resScanExpired.statusCode, 200);
  assert.ok(resScanExpired.body.includes('Código de 1 solo uso') || resScanExpired.body.includes('QR Ya Utilizado'),
    'Debe informar al usuario que el código ya fue descartado');
  console.log('✅ Código de un solo uso descartado y protegido correctamente.');

  // Test 7: Listar QRs del inquilino y verificar conteo de escaneos incrementado
  console.log('\nTest 7: Comprobando métricas de escaneos e items del tenant...');
  const resList = await app.inject({
    method: 'GET',
    url: '/api/qr',
    headers: { 'x-api-key': validKey }
  });
  assert.strictEqual(resList.statusCode, 200);
  const listData = JSON.parse(resList.body);
  const found = listData.items.find(i => i.id === createdQrId);
  assert.ok(found, 'El QR creado debe estar en la lista');
  assert.strictEqual(found.scan_count, 1, 'El contador de escaneos debe haberse incrementado a 1');
  console.log(`✅ Métricas verificadas: scan_count = ${found.scan_count}.`);

  // Test 8: Subida simultánea de Imagen Y Modelo 3D personalizado
  console.log('\nTest 8: Creación con subida simultánea de Imagen Y Modelo GLB...');
  const boundary2 = '----WebKitFormBoundaryTest456';
  const parts2 = [];

  parts2.push(`--${boundary2}\r\nContent-Disposition: form-data; name="title"\r\n\r\nCustom 3D + Logo QR`);
  parts2.push(`--${boundary2}\r\nContent-Disposition: form-data; name="target_url"\r\n\r\nhttps://google.com/dual-test`);

  const headerImg2 = `--${boundary2}\r\nContent-Disposition: form-data; name="image"; filename="logo2.png"\r\nContent-Type: image/png\r\n\r\n`;
  const headerModel = `\r\n--${boundary2}\r\nContent-Disposition: form-data; name="model"; filename="custom.glb"\r\nContent-Type: model/gltf-binary\r\n\r\n`;
  const footer2 = `\r\n--${boundary2}--\r\n`;

  // Reutilizamos resModel.rawPayload como modelo GLB de entrada
  const dualBody = Buffer.concat([
    Buffer.from(parts2.join('\r\n') + '\r\n'),
    Buffer.from(headerImg2),
    testImgBuffer,
    Buffer.from(headerModel),
    resModel.rawPayload,
    Buffer.from(footer2)
  ]);

  const resDual = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: {
      'x-api-key': validKey,
      'content-type': `multipart/form-data; boundary=${boundary2}`
    },
    payload: dualBody
  });

  assert.strictEqual(resDual.statusCode, 201, `Dual upload debe retornar 201: ${resDual.body}`);
  const dualData = JSON.parse(resDual.body);
  assert.ok(dualData.success);
  console.log(`✅ Subida dual (Imagen + Modelo 3D) completada exitosamente con ID: ${dualData.qr.id}`);

  // Test 9: Catálogo de modelos integrados incluye museo_tumbas_reales_sipan.glb
  console.log('\nTest 9: Verificando catálogo /api/models...');
  const resModels = await app.inject({
    method: 'GET',
    url: '/api/models'
  });
  assert.strictEqual(resModels.statusCode, 200);
  const modelsData = JSON.parse(resModels.body);
  const sipanCatalogEntry = modelsData.models.find(m => m.filename === 'museo_tumbas_reales_sipan.glb');
  assert.ok(sipanCatalogEntry, 'museo_tumbas_reales_sipan.glb debe estar listado en /api/models');
  console.log(`✅ Catálogo verificado: ${sipanCatalogEntry.name} (${sipanCatalogEntry.sizeFormatted})`);

  // Test 10: Integración de museo_tumbas_reales_sipan.glb preservando materiales + Totem QR integrado
  console.log('\nTest 10: Integrando museo_tumbas_reales_sipan.glb via upload y model_preset...');
  const sipanGlbPath = path.resolve('example-project/models/museo_tumbas_reales_sipan.glb');
  const sipanGlbBuffer = fs.readFileSync(sipanGlbPath);
  const boundary3 = '----WebKitFormBoundarySipan789';
  const sipanParts = [
    `--${boundary3}\r\nContent-Disposition: form-data; name="title"\r\n\r\nMuseo Sipan Upload`,
    `--${boundary3}\r\nContent-Disposition: form-data; name="target_url"\r\n\r\nhttps://example.com/sipan`
  ];
  const headerSipan = `--${boundary3}\r\nContent-Disposition: form-data; name="model"; filename="museo_tumbas_reales_sipan.glb"\r\nContent-Type: model/gltf-binary\r\n\r\n`;
  const footer3 = `\r\n--${boundary3}--\r\n`;
  const sipanMultipart = Buffer.concat([
    Buffer.from(sipanParts.join('\r\n') + '\r\n'),
    Buffer.from(headerSipan),
    sipanGlbBuffer,
    Buffer.from(footer3)
  ]);

  const resSipanUpload = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: {
      'x-api-key': validKey,
      'content-type': `multipart/form-data; boundary=${boundary3}`
    },
    payload: sipanMultipart
  });
  assert.strictEqual(resSipanUpload.statusCode, 201, `Upload de museo_tumbas_reales_sipan.glb debe retornar 201: ${resSipanUpload.body}`);
  const sipanQrId = JSON.parse(resSipanUpload.body).qr.id;

  const resSipanGlb = await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/model` });
  assert.strictEqual(resSipanGlb.statusCode, 200);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(resSipanGlb.rawPayload));
  const root = doc.getRoot();
  const terracottaMat = root.listMaterials().find(m => m.getName() === 'terracotta');
  assert.ok(terracottaMat, 'Debe conservar el material original terracotta');
  assert.strictEqual(terracottaMat.getBaseColorTexture(), null, 'No debe sobrescribir la textura del material terracotta');
  const qrDisplayMat = root.listMaterials().find(m => m.getName() === 'QR_Display_Material');
  assert.ok(qrDisplayMat && qrDisplayMat.getBaseColorTexture(), 'Debe adjuntar material QR_Display_Material con textura QR');
  const totemNode = root.listNodes().find(n => n.getName() === 'QR_Totem_Integrated');
  assert.ok(totemNode, 'Debe incluir el nodo QR_Totem_Integrated en la escena');

  const resSipanPreset = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: {
      'x-api-key': validKey,
      'content-type': 'application/json'
    },
    payload: JSON.stringify({
      title: 'Museo Sipan Preset',
      target_url: 'https://example.com/sipan-preset',
      model_preset: 'museo_tumbas_reales_sipan.glb'
    })
  });
  assert.strictEqual(resSipanPreset.statusCode, 201, `Preset JSON debe retornar 201: ${resSipanPreset.body}`);
  console.log('✅ Integración de museo_tumbas_reales_sipan.glb verificada (materiales intactos + Totem QR + preset JSON).');

  // Test 11: Rotación manual actualiza la imagen PNG activa del QR y su matriz binaria
  console.log('\nTest 11: Verificando rotación manual y endpoint /api/qr/:qrId/matrix...');
  const imgBefore = await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/image` });
  const matBefore = await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/matrix` });
  assert.strictEqual(matBefore.statusCode, 200);
  const matBeforeJson = JSON.parse(matBefore.body);
  assert.ok(matBeforeJson.size >= 21 && matBeforeJson.modules.length === matBeforeJson.size * matBeforeJson.size, 'La matriz QR debe ser cuadrada');

  const resRotate = await app.inject({
    method: 'PUT',
    url: `/api/qr/${sipanQrId}`,
    headers: {
      'x-api-key': validKey,
      'content-type': 'application/json'
    },
    payload: JSON.stringify({ rotate_now: true })
  });
  assert.strictEqual(resRotate.statusCode, 200);
  const imgAfter = await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/image` });
  const matAfter = await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/matrix` });
  const matAfterJson = JSON.parse(matAfter.body);
  assert.notStrictEqual(Buffer.compare(imgBefore.rawPayload, imgAfter.rawPayload), 0, 'La imagen PNG del QR debe rotar tras PUT rotate_now');
  assert.notStrictEqual(matBeforeJson.scanUrl, matAfterJson.scanUrl, 'La URL de escaneo en /matrix debe rotar tras PUT rotate_now');
  console.log('✅ Rotación de imagen PNG y matriz QR verificadas correctamente.');

  // Test 12: Presets visuales y configuración automática por defecto
  console.log('\nTest 12: Verificando presets visuales /api/viewer-presets y configuración automática...');
  const resPresets = await app.inject({ method: 'GET', url: '/api/viewer-presets' });
  assert.strictEqual(resPresets.statusCode, 200);
  const presetsJson = JSON.parse(resPresets.body);
  assert.ok(presetsJson.presets.auto && presetsJson.presets.archaeological, 'Debe incluir presets auto y archaeological');

  const resDefaultDetail = await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}` });
  assert.strictEqual(resDefaultDetail.statusCode, 200);
  const defaultDetail = JSON.parse(resDefaultDetail.body);
  assert.strictEqual(defaultDetail.viewerConfig.mode, 'auto', 'El modo por defecto debe ser auto');
  assert.strictEqual(defaultDetail.viewerConfig.edgeMode, 'smart', 'El modo de aristas por defecto debe ser smart');
  assert.strictEqual(defaultDetail.viewerConfig.cameraMode, 'smooth', 'El modo de cámara por defecto debe ser smooth');

  // Guardar cámara directa y autoRotate: false manteniendo modo auto debe preservar ambas preferencias
  const resAutoCamPut = await app.inject({
    method: 'PUT',
    url: `/api/qr/${sipanQrId}`,
    headers: {
      'x-api-key': validKey,
      'content-type': 'application/json'
    },
    payload: JSON.stringify({ viewer_config: { mode: 'auto', cameraMode: 'direct', autoRotate: false } })
  });
  assert.strictEqual(resAutoCamPut.statusCode, 200);
  const autoCamPutJson = JSON.parse(resAutoCamPut.body);
  assert.strictEqual(autoCamPutJson.viewerConfig.mode, 'auto');
  assert.strictEqual(autoCamPutJson.viewerConfig.cameraMode, 'direct');
  assert.strictEqual(autoCamPutJson.viewerConfig.autoRotate, false);
  console.log('✅ Presets y configuración automática verificados.');

  // Test 13: Actualización manual de viewer_config sin rotar el código QR
  console.log('\nTest 13: Verificando guardado de configuración manual sin rotar QR...');
  const matPreConfig = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/matrix` })).body);
  const manualPayload = {
    mode: 'manual',
    preset: 'custom',
    sunAzimuth: -95,
    sunElevation: 34,
    sunIntensity: 1.7,
    exposure: 0.9,
    ambientIntensity: 0.12,
    colorBoost: 1.25,
    fixSrgb: 'on',
    edgeMode: 'off',
    backgroundPreset: 'custom',
    backgroundColor: '#211a14',
    showTotem: false,
    autoRotate: false,
    cameraMode: 'direct',
    cameraPose: { position: [10, 8, 14], target: [0, 2, 0], pivotRotY: 0.4 }
  };

  const resManualPut = await app.inject({
    method: 'PUT',
    url: `/api/qr/${sipanQrId}`,
    headers: {
      'x-api-key': validKey,
      'content-type': 'application/json'
    },
    payload: JSON.stringify({ viewer_config: manualPayload })
  });
  assert.strictEqual(resManualPut.statusCode, 200);
  const manualPutJson = JSON.parse(resManualPut.body);
  assert.strictEqual(manualPutJson.viewerConfig.mode, 'manual');
  assert.strictEqual(manualPutJson.viewerConfig.sunAzimuth, -95);
  assert.strictEqual(manualPutJson.viewerConfig.fixSrgb, 'on');
  assert.strictEqual(manualPutJson.viewerConfig.showTotem, false);
  assert.strictEqual(manualPutJson.viewerConfig.cameraMode, 'direct');

  const detailAfterManual = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}` })).body);
  assert.strictEqual(detailAfterManual.viewerConfig.edgeMode, 'off');
  assert.strictEqual(detailAfterManual.viewerConfig.cameraMode, 'direct');
  assert.deepStrictEqual(detailAfterManual.viewerConfig.cameraPose, manualPayload.cameraPose);

  const matPostConfig = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/matrix` })).body);
  assert.strictEqual(matPostConfig.scanUrl, matPreConfig.scanUrl, 'Guardar estilo visual no debe rotar el token del QR');
  console.log('✅ Configuración manual persistida y validada sin rotar el QR.');

  // Test 14: Subida directa a /api/files y reutilización mediante saved_model_id
  console.log('\nTest 14: Subida directa a /api/files y reutilización en POST /api/qr...');
  const boundaryFile = '----WebKitFormBoundaryFile777';
  const fileHeader = `--${boundaryFile}\r\nContent-Disposition: form-data; name="file"; filename="tucume_test.glb"\r\nContent-Type: model/gltf-binary\r\n\r\n`;
  const fileFooter = `\r\n--${boundaryFile}--\r\n`;
  const fileUploadBody = Buffer.concat([
    Buffer.from(fileHeader),
    sipanGlbBuffer,
    Buffer.from(fileFooter)
  ]);

  const resFileUpload = await app.inject({
    method: 'POST',
    url: '/api/files',
    headers: {
      'x-api-key': validKey,
      'content-type': `multipart/form-data; boundary=${boundaryFile}`
    },
    payload: fileUploadBody
  });
  assert.ok([200, 201].includes(resFileUpload.statusCode), `Subida de archivo debe responder 200/201: ${resFileUpload.body}`);
  const uploadedFileMeta = JSON.parse(resFileUpload.body).file;
  assert.ok(uploadedFileMeta.id.startsWith('file_'), 'El archivo guardado debe tener id file_xxx');

  const resReuse = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: {
      'x-api-key': validKey,
      'content-type': 'application/json'
    },
    payload: JSON.stringify({
      title: 'QR con modelo reutilizado de BD',
      target_url: 'https://example.com/reused',
      saved_model_id: uploadedFileMeta.id
    })
  });
  assert.strictEqual(resReuse.statusCode, 201, `Reutilizar saved_model_id debe crear QR: ${resReuse.body}`);
  console.log(`✅ Archivo persistido (${uploadedFileMeta.id}) y reutilizado exitosamente.`);

  // Test 15: Persistencia real al cerrar y reiniciar la API desde la base de datos SQLite
  console.log('\nTest 15: Simulando reinicio completo de la API y verificando recarga de archivos...');
  await app.close();
  await closeDb();

  const restartStatus = await initDb({ sqlitePath: testSqlitePath, dbEngine: 'sqlite' });
  assert.strictEqual(restartStatus.ready, true, 'La BD debe reactivarse desde disco');
  assert.ok(restartStatus.startupStats.savedFiles >= 2, 'Al reiniciar debe cargar los archivos anteriormente guardados');
  assert.ok(restartStatus.startupStats.qrItems >= 4, 'Al reiniciar debe cargar los QRs anteriormente creados');

  app = await buildTestApp();
  const resHealthAfterRestart = await app.inject({ method: 'GET', url: '/health' });
  assert.strictEqual(resHealthAfterRestart.statusCode, 200);
  const healthJson = JSON.parse(resHealthAfterRestart.body);
  assert.strictEqual(healthJson.serviceActive, true);
  assert.strictEqual(healthJson.databaseEngine, 'sqlite');
  assert.ok(healthJson.preloadedFilesCount >= 2);

  const resFilesAfterRestart = await app.inject({
    method: 'GET',
    url: '/api/files',
    headers: { 'x-api-key': validKey }
  });
  assert.strictEqual(resFilesAfterRestart.statusCode, 200);
  const filesAfterJson = JSON.parse(resFilesAfterRestart.body);
  assert.ok(filesAfterJson.files.some((f) => f.id === uploadedFileMeta.id), 'El archivo subido debe seguir disponible tras reiniciar');

  const resDownloadAfterRestart = await app.inject({
    method: 'GET',
    url: `/api/files/${uploadedFileMeta.id}/download`,
    headers: { 'x-api-key': validKey }
  });
  assert.strictEqual(resDownloadAfterRestart.statusCode, 200);
  assert.strictEqual(Buffer.compare(resDownloadAfterRestart.rawPayload, sipanGlbBuffer), 0, 'El binario descargado tras reiniciar debe ser idéntico al subido');
  console.log('✅ Persistencia total verificada tras reiniciar la API.');

  // Test 16: Edición completa de información del QR (título, descripción, estrategia, estado, URL sin rotación espuria)
  console.log('\nTest 16: Verificando edición completa de información en PUT /api/qr/:qrId...');
  const detailBeforeEdit = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}` })).body);
  const matBeforeEdit = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/matrix` })).body);

  const resEditMeta = await app.inject({
    method: 'PUT',
    url: `/api/qr/${sipanQrId}`,
    headers: {
      'x-api-key': validKey,
      'content-type': 'application/json'
    },
    payload: JSON.stringify({
      title: 'Huaca Túcume Editada',
      description: 'Maqueta 3D actualizada con información arqueológica',
      target_url: detailBeforeEdit.target_url,
      rotation_strategy: 'continuous',
      is_active: false,
      rotate_now: false
    })
  });
  assert.strictEqual(resEditMeta.statusCode, 200, `Edición debe retornar 200: ${resEditMeta.body}`);
  const editMetaJson = JSON.parse(resEditMeta.body);
  assert.strictEqual(editMetaJson.qr.title, 'Huaca Túcume Editada');
  assert.strictEqual(editMetaJson.qr.description, 'Maqueta 3D actualizada con información arqueológica');
  assert.strictEqual(editMetaJson.qr.rotation_strategy, 'continuous');
  assert.strictEqual(editMetaJson.qr.is_active, false);

  const matAfterSameUrl = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/matrix` })).body);
  assert.strictEqual(matAfterSameUrl.scanUrl, matBeforeEdit.scanUrl, 'Guardar la misma URL no debe rotar el token del QR');

  const listAfterEdit = JSON.parse((await app.inject({
    method: 'GET',
    url: '/api/qr',
    headers: { 'x-api-key': validKey }
  })).body);
  const editedItem = listAfterEdit.items.find((i) => i.id === sipanQrId);
  assert.strictEqual(editedItem.title, 'Huaca Túcume Editada');
  assert.strictEqual(editedItem.description, 'Maqueta 3D actualizada con información arqueológica');
  assert.strictEqual(editedItem.rotation_strategy, 'continuous');
  assert.strictEqual(editedItem.is_active, false);

  const boundaryEdit = '----WebKitFormBoundaryEdit999';
  const editParts = [
    `--${boundaryEdit}\r\nContent-Disposition: form-data; name="title"\r\n\r\nHuaca Túcume Activa`,
    `--${boundaryEdit}\r\nContent-Disposition: form-data; name="target_url"\r\n\r\nhttps://example.com/tucume-v2`,
    `--${boundaryEdit}\r\nContent-Disposition: form-data; name="is_active"\r\n\r\ntrue`
  ];
  const editImgHeader = `--${boundaryEdit}\r\nContent-Disposition: form-data; name="image"; filename="edit_logo.png"\r\nContent-Type: image/png\r\n\r\n`;
  const editFooter = `\r\n--${boundaryEdit}--\r\n`;
  const editMultipartBody = Buffer.concat([
    Buffer.from(editParts.join('\r\n') + '\r\n'),
    Buffer.from(editImgHeader),
    testImgBuffer,
    Buffer.from(editFooter)
  ]);

  const resEditMultipart = await app.inject({
    method: 'PUT',
    url: `/api/qr/${sipanQrId}`,
    headers: {
      'x-api-key': validKey,
      'content-type': `multipart/form-data; boundary=${boundaryEdit}`
    },
    payload: editMultipartBody
  });
  assert.strictEqual(resEditMultipart.statusCode, 200, `Edición multipart debe retornar 200: ${resEditMultipart.body}`);
  const editMultipartJson = JSON.parse(resEditMultipart.body);
  assert.strictEqual(editMultipartJson.qr.title, 'Huaca Túcume Activa');
  assert.strictEqual(editMultipartJson.qr.target_url, 'https://example.com/tucume-v2');
  assert.strictEqual(editMultipartJson.qr.is_active, true);
  console.log('✅ Edición de información (JSON + multipart + estado + URL) verificada correctamente.');

  // Test 17: Vista Pública Unida (Modelo 3D + QR) aislada del panel administrativo
  console.log('\nTest 17: Verificando vista pública aislada /view/:viewToken y /api/qr/:qrId/view-link...');
  const resViewLink = await app.inject({
    method: 'GET',
    url: `/api/qr/${sipanQrId}/view-link`,
    headers: { 'x-api-key': validKey, host: 'localhost:3100' }
  });
  assert.strictEqual(resViewLink.statusCode, 200);
  const viewLinkJson = JSON.parse(resViewLink.body);
  assert.ok(viewLinkJson.viewToken && viewLinkJson.viewToken.startsWith('vw_'), 'Debe generar viewToken vw_xxx');
  assert.strictEqual(viewLinkJson.viewUrl, `http://localhost:3100/view/${viewLinkJson.viewToken}`, 'viewUrl debe respetar el host/puerto real');

  const resViewLinkNoAuth = await app.inject({
    method: 'GET',
    url: `/api/qr/${sipanQrId}/view-link`
  });
  assert.strictEqual(resViewLinkNoAuth.statusCode, 401, 'Solicitar el view-link por API requiere API Key');

  const viewToken = viewLinkJson.viewToken;
  const resViewHtml = await app.inject({
    method: 'GET',
    url: `/view/${viewToken}`
  });
  assert.strictEqual(resViewHtml.statusCode, 200);
  assert.ok(resViewHtml.headers['content-type'].includes('text/html'));
  assert.strictEqual(resViewHtml.headers['x-frame-options'], undefined, 'La vista pública debe permitir incrustación en iframe sin X-Frame-Options');
  assert.ok(resViewHtml.body.includes(`view-token="${viewToken}"`), 'La vista debe unir el visor 3D mediante view-token');
  assert.ok(resViewHtml.body.includes('id="dock-qr-img"'), 'La vista debe incluir el código QR unido junto al modelo');
  assert.ok(!resViewHtml.body.includes('/admin'), 'La vista pública no debe enlazar al panel administrativo');
  assert.ok(!resViewHtml.body.includes(validKey), 'La vista pública no debe exponer API keys');
  assert.ok(!resViewHtml.body.includes(sipanQrId), 'La vista pública no debe exponer el qrId interno');

  const resViewMeta = await app.inject({ method: 'GET', url: `/view/${viewToken}/meta` });
  assert.strictEqual(resViewMeta.statusCode, 200);
  const viewMetaJson = JSON.parse(resViewMeta.body);
  assert.strictEqual(viewMetaJson.target_url, undefined, 'Meta pública no debe filtrar target_url');
  assert.strictEqual(viewMetaJson.tenant_id, undefined, 'Meta pública no debe filtrar tenant_id');
  assert.strictEqual(viewMetaJson.id, undefined, 'Meta pública no debe filtrar qrId');
  assert.strictEqual(viewMetaJson.isActive, true);
  assert.strictEqual(viewMetaJson.viewerConfig.mode, 'manual', 'La vista pública debe conservar el modo visual guardado');
  assert.strictEqual(viewMetaJson.viewerConfig.sunAzimuth, -95, 'La vista pública debe conservar la iluminación solar guardada');
  assert.strictEqual(viewMetaJson.viewerConfig.colorBoost, 1.25, 'La vista pública debe conservar el realce de color guardado');
  assert.strictEqual(viewMetaJson.viewerConfig.fixSrgb, 'on', 'La vista pública debe conservar la calibración sRGB guardada');
  assert.strictEqual(viewMetaJson.viewerConfig.backgroundColor, '#211a14', 'La vista pública debe conservar el fondo guardado');
  assert.deepStrictEqual(viewMetaJson.viewerConfig.cameraPose, manualPayload.cameraPose, 'La vista pública debe conservar la pose de cámara guardada');
  assert.ok(resViewHtml.body.includes('viewer-config='), 'El HTML de la vista pública debe hidratar viewer-config desde el primer render');

  const resViewModel = await app.inject({ method: 'GET', url: `/view/${viewToken}/model` });
  assert.strictEqual(resViewModel.statusCode, 200);
  assert.strictEqual(resViewModel.rawPayload.slice(0, 4).toString('ascii'), 'glTF');

  const resViewImg = await app.inject({
    method: 'GET',
    url: `/view/${viewToken}/image`,
    headers: { host: 'localhost:3100' }
  });
  assert.strictEqual(resViewImg.statusCode, 200);
  assert.strictEqual(resViewImg.headers['content-type'], 'image/png');

  const resViewMatrix = await app.inject({
    method: 'GET',
    url: `/view/${viewToken}/matrix`,
    headers: { host: 'localhost:3100' }
  });
  assert.strictEqual(resViewMatrix.statusCode, 200);
  const viewMatrixJson = JSON.parse(resViewMatrix.body);
  assert.strictEqual(viewMatrixJson.scanUrl, undefined, 'Matriz pública no debe exponer scanUrl ni token');
  assert.ok(viewMatrixJson.size >= 21 && Array.isArray(viewMatrixJson.modules));

  // Verificar que el PNG y matriz en /view/:viewToken codifican el puerto actual (3100) y no 3000
  const sipanAdminMatrix = JSON.parse(
    (await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/matrix`, headers: { host: 'localhost:3100' } })).body
  );
  assert.ok(sipanAdminMatrix.scanUrl.startsWith('http://localhost:3100/scan/'), 'El enlace dentro del QR debe usar el puerto 3100');
  const expectedMatrix3100 = generateQrMatrix(sipanAdminMatrix.scanUrl);
  assert.deepStrictEqual(viewMatrixJson.modules, expectedMatrix3100.modules, 'La matriz pública debe coincidir con la URL en puerto 3100');
  const sipanDetailRow = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}` })).body);
  const expectedPng3100 = await generateQrPngBuffer(sipanAdminMatrix.scanUrl, {
    primary: sipanDetailRow.color_primary,
    secondary: sipanDetailRow.color_secondary
  });
  assert.strictEqual(Buffer.compare(resViewImg.rawPayload, expectedPng3100), 0, 'El PNG servido en /view/:viewToken/image debe codificar el enlace en puerto 3100');
  console.log('✅ Vista pública unida (Modelo + QR) verificada sin exposición administrativa.');

  // Test 18: QRs Estáticos vs Dinámicos con rotación automática por intervalo + URLs rotativas
  console.log('\nTest 18: Verificando QRs estáticos vs dinámicos (rotación automática y API link)...');
  const resCreateStatic = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({
      title: 'Museo Estático Fijo',
      target_url: 'https://example.com/static-exhibit',
      link_mode: 'static'
    })
  });
  assert.strictEqual(resCreateStatic.statusCode, 201);
  const staticQr = JSON.parse(resCreateStatic.body).qr;
  assert.strictEqual(staticQr.linkMode, 'static');
  assert.strictEqual(staticQr.rotation_strategy, 'static');
  assert.strictEqual(staticQr.rotationIntervalSeconds, 0);

  const staticImg1 = (await app.inject({ method: 'GET', url: `/view/${staticQr.viewToken}/image` })).rawPayload;
  const staticToken = new URL(staticQr.scan_url).searchParams.get('token');
  const staticScan1 = await app.inject({ method: 'GET', url: `/scan/${staticQr.id}?token=${staticToken}` });
  const staticScan2 = await app.inject({ method: 'GET', url: `/scan/${staticQr.id}?token=${staticToken}` });
  assert.strictEqual(staticScan1.statusCode, 302);
  assert.strictEqual(staticScan2.statusCode, 302);
  assert.strictEqual(staticScan2.headers.location, 'https://example.com/static-exhibit');
  await runRotationTickNow();
  const staticImg2 = (await app.inject({ method: 'GET', url: `/view/${staticQr.viewToken}/image` })).rawPayload;
  assert.strictEqual(Buffer.compare(staticImg1, staticImg2), 0, 'Un QR estático no debe rotar al escanear ni en ciclos del scheduler');

  const resCreateTimed = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({
      title: 'Acceso Dinámico Cambiante',
      target_url: 'https://example.com/promo-a',
      rotation_strategy: 'timed',
      rotation_interval_seconds: 2,
      rotating_urls: ['https://example.com/promo-a', 'https://example.com/promo-b']
    })
  });
  assert.strictEqual(resCreateTimed.statusCode, 201);
  const timedQr = JSON.parse(resCreateTimed.body).qr;
  assert.strictEqual(timedQr.linkMode, 'dynamic');
  assert.strictEqual(timedQr.rotation_strategy, 'timed');
  assert.strictEqual(timedQr.rotationIntervalSeconds, 2);

  const timedToken1 = new URL(timedQr.scan_url).searchParams.get('token');
  const timedImg1 = (await app.inject({ method: 'GET', url: `/view/${timedQr.viewToken}/image` })).rawPayload;
  const timedScanBeforeTick = await app.inject({ method: 'GET', url: `/scan/${timedQr.id}?token=${timedToken1}` });
  assert.strictEqual(timedScanBeforeTick.statusCode, 302);
  assert.strictEqual(timedScanBeforeTick.headers.location, 'https://example.com/promo-a');

  await new Promise((r) => setTimeout(r, 2150));
  const rotatedNow = await runRotationTickNow();
  assert.ok(rotatedNow >= 1, 'El planificador debe rotar el QR dinámico al cumplirse el intervalo');

  const timedImg2 = (await app.inject({ method: 'GET', url: `/view/${timedQr.viewToken}/image` })).rawPayload;
  assert.notStrictEqual(Buffer.compare(timedImg1, timedImg2), 0, 'La imagen QR debe actualizarse automáticamente');

  const timedExpiredScan = await app.inject({ method: 'GET', url: `/scan/${timedQr.id}?token=${timedToken1}` });
  assert.strictEqual(timedExpiredScan.statusCode, 200);
  assert.ok(timedExpiredScan.body.includes('Código Dinámico Expirado'), 'El token anterior debe expirar tras la rotación automática');

  const timedMat2 = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${timedQr.id}/matrix` })).body);
  const timedToken2 = new URL(timedMat2.scanUrl).searchParams.get('token');
  const timedScan2 = await app.inject({ method: 'GET', url: `/scan/${timedQr.id}?token=${timedToken2}` });
  assert.strictEqual(timedScan2.statusCode, 302);
  assert.strictEqual(timedScan2.headers.location, 'https://example.com/promo-b', 'Debe ciclar a la segunda URL rotativa');

  const resPatchLink = await app.inject({
    method: 'PATCH',
    url: `/api/qr/${timedQr.id}/link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ target_url: 'https://example.com/promo-live-api', rotate_now: true })
  });
  assert.strictEqual(resPatchLink.statusCode, 200);
  const patchedQr = JSON.parse(resPatchLink.body).qr;
  assert.strictEqual(patchedQr.target_url, 'https://example.com/promo-live-api');

  const resHistory = await app.inject({
    method: 'GET',
    url: `/api/qr/${timedQr.id}/rotation-history`,
    headers: { 'x-api-key': validKey }
  });
  assert.strictEqual(resHistory.statusCode, 200);
  const historyJson = JSON.parse(resHistory.body);
  assert.ok(historyJson.history.some((h) => h.reason === 'auto_interval'));
  console.log('✅ Estático vs Dinámico (intervalo automático, URLs rotativas y PATCH /link) verificado.');

  // Test 19: Control de acceso al Link de Vista (deshabilitar y regenerar token)
  console.log('\nTest 19: Verificando desactivación y rotación del viewToken...');
  const resDisableView = await app.inject({
    method: 'PATCH',
    url: `/api/qr/${timedQr.id}/link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ view_enabled: false })
  });
  assert.strictEqual(resDisableView.statusCode, 200);
  const resDisabledPage = await app.inject({ method: 'GET', url: `/view/${timedQr.viewToken}` });
  assert.strictEqual(resDisabledPage.statusCode, 410);

  await app.inject({
    method: 'PATCH',
    url: `/api/qr/${timedQr.id}/link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ view_enabled: true })
  });
  const resReenabledPage = await app.inject({ method: 'GET', url: `/view/${timedQr.viewToken}` });
  assert.strictEqual(resReenabledPage.statusCode, 200);

  const resRotateViewToken = await app.inject({
    method: 'POST',
    url: `/api/qr/${timedQr.id}/view-link/rotate`,
    headers: { 'x-api-key': validKey }
  });
  assert.strictEqual(resRotateViewToken.statusCode, 200);
  const rotatedViewData = JSON.parse(resRotateViewToken.body);
  assert.notStrictEqual(rotatedViewData.viewToken, timedQr.viewToken);
  const resOldView = await app.inject({ method: 'GET', url: `/view/${timedQr.viewToken}` });
  assert.strictEqual(resOldView.statusCode, 404, 'El link anterior debe quedar revocado');
  const resNewView = await app.inject({ method: 'GET', url: `/view/${rotatedViewData.viewToken}` });
  assert.strictEqual(resNewView.statusCode, 200, 'El nuevo link regenerado debe funcionar');
  console.log('✅ Desactivación y revocación/rotación de viewToken verificadas.');

  // Test 20: Migración automática de base de datos SQLite antigua sin columna view_token
  console.log('\nTest 20: Verificando migración segura de SQLite legado sin view_token...');
  const legacySqlitePath = path.join(os.tmpdir(), `qr3d_legacy_${process.pid}_${Date.now()}.sqlite`);
  try {
    const legacyDb = new DatabaseSync(legacySqlitePath);
    legacyDb.exec(`
      CREATE TABLE tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        api_key_hash TEXT NOT NULL UNIQUE,
        api_key_prefix TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        rate_limit_rpm INTEGER DEFAULT 120,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE qr_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
      INSERT INTO tenants (id, name, api_key_hash, api_key_prefix) VALUES ('t_leg', 'Legacy', 'hash_leg', 'tk_leg');
      INSERT INTO qr_items (id, tenant_id, title, target_url) VALUES ('qr_legacy_1', 't_leg', 'Legacy Item', 'https://example.com/legacy');
    `);
    legacyDb.close();

    await initDb({ sqlitePath: legacySqlitePath, dbEngine: 'sqlite' });
    const migratedRow = await db.query('SELECT view_token, metadata FROM qr_items WHERE id = $1', ['qr_legacy_1']);
    assert.strictEqual(migratedRow.rows.length, 1);
    assert.ok(migratedRow.rows[0].view_token && migratedRow.rows[0].view_token.startsWith('vw_'), 'Debe asignar view_token automáticamente a QRs antiguos');
  } finally {
    await closeDb();
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${legacySqlitePath}${suffix}`, { force: true });
    }
    await initDb({ sqlitePath: testSqlitePath, dbEngine: 'sqlite' });
  }
  console.log('✅ Migración segura y backfill de view_token verificados.');

  // Test 21: Edición de ruta pública (/view/<ruta>) y cambio de URL/ruta destino
  console.log('\nTest 21: Verificando edición de ruta pública personalizada y enlace/ruta destino...');
  const resCustomSlug = await app.inject({
    method: 'PATCH',
    url: `/api/qr/${staticQr.id}/view-link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ view_slug: 'museo-ruta-propia' })
  });
  assert.strictEqual(resCustomSlug.statusCode, 200);
  const customSlugJson = JSON.parse(resCustomSlug.body);
  assert.strictEqual(customSlugJson.viewToken, 'museo-ruta-propia');
  assert.ok(customSlugJson.viewUrl.endsWith('/view/museo-ruta-propia'));

  const resCustomView = await app.inject({ method: 'GET', url: '/view/museo-ruta-propia' });
  assert.strictEqual(resCustomView.statusCode, 200, 'La nueva ruta pública personalizada debe cargar correctamente');
  const resReplacedView = await app.inject({ method: 'GET', url: `/view/${staticQr.viewToken}` });
  assert.strictEqual(resReplacedView.statusCode, 404, 'La ruta pública anterior debe dejar de responder al cambiarla');

  const resInvalidSlug = await app.inject({
    method: 'PATCH',
    url: `/api/qr/${staticQr.id}/view-link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ view_slug: 'ab' })
  });
  assert.strictEqual(resInvalidSlug.statusCode, 400, 'Una ruta demasiado corta debe rechazarse con 400');

  const resDuplicateSlug = await app.inject({
    method: 'PATCH',
    url: `/api/qr/${timedQr.id}/view-link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ view_slug: 'museo-ruta-propia' })
  });
  assert.strictEqual(resDuplicateSlug.statusCode, 409, 'Una ruta ya ocupada por otro QR debe devolver 409');

  const resChangeTargetHttp = await app.inject({
    method: 'PATCH',
    url: `/api/qr/${staticQr.id}/link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ target_url: 'https://example.com/nueva-pagina' })
  });
  assert.strictEqual(resChangeTargetHttp.statusCode, 200);
  const staticMatAfterHttp = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${staticQr.id}/matrix` })).body);
  const staticTokAfterHttp = new URL(staticMatAfterHttp.scanUrl).searchParams.get('token');
  const scanAfterHttp = await app.inject({ method: 'GET', url: `/scan/${staticQr.id}?token=${staticTokAfterHttp}` });
  assert.strictEqual(scanAfterHttp.statusCode, 302);
  assert.strictEqual(scanAfterHttp.headers.location, 'https://example.com/nueva-pagina');

  const resChangeTargetRel = await app.inject({
    method: 'PATCH',
    url: `/api/qr/${staticQr.id}/link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ target_url: '/example/sipan-nuevo.html' })
  });
  assert.strictEqual(resChangeTargetRel.statusCode, 200);
  const changedRelQr = JSON.parse(resChangeTargetRel.body).qr;
  assert.strictEqual(changedRelQr.target_url, '/example/sipan-nuevo.html');
  const staticMatAfterRel = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${staticQr.id}/matrix` })).body);
  const staticTokAfterRel = new URL(staticMatAfterRel.scanUrl).searchParams.get('token');
  const scanAfterRel = await app.inject({ method: 'GET', url: `/scan/${staticQr.id}?token=${staticTokAfterRel}` });
  assert.strictEqual(scanAfterRel.statusCode, 302);
  assert.strictEqual(scanAfterRel.headers.location, '/example/sipan-nuevo.html');

  const resInvalidScheme = await app.inject({
    method: 'PATCH',
    url: `/api/qr/${staticQr.id}/link`,
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({ target_url: 'javascript:alert(1)' })
  });
  assert.strictEqual(resInvalidScheme.statusCode, 400, 'Esquemas inseguros en target_url deben rechazarse con 400');
  console.log('✅ Edición de ruta pública (/view/<ruta>) y cambio de URL/ruta destino verificados.');

  // Test 22: Contador diario de ingresos al link y personas únicas (excluyendo días previos y expirados)
  console.log('\nTest 22: Verificando contador diario de escaneos/ingresos y personas únicas...');
  const resDailyQr = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({
      title: 'Contador Diario Test',
      target_url: 'https://example.com/contador-diario',
      link_mode: 'static'
    })
  });
  assert.strictEqual(resDailyQr.statusCode, 201);
  const dailyQr = JSON.parse(resDailyQr.body).qr;
  const dailyMat = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${dailyQr.id}/matrix` })).body);
  const dailyTok = new URL(dailyMat.scanUrl).searchParams.get('token');

  // Insertar 1 registro de ayer en scan_logs para validar que NO se suma al día de hoy
  const dailyTenantRes = await db.query('SELECT tenant_id FROM qr_items WHERE id = $1', [dailyQr.id]);
  const dailyTenantId = dailyTenantRes.rows[0].tenant_id;
  const yesterdayUtcSql = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  await db.query(
    `INSERT INTO scan_logs (qr_id, tenant_id, scanned_at, ip_address, user_agent, rotated, target_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [dailyQr.id, dailyTenantId, yesterdayUtcSql, '10.10.10.99', 'Visitor-Yesterday', false, dailyQr.target_url]
  );

  // Hoy debe iniciar en 0 ingresos y 0 personas
  const initialDailyRes = await app.inject({
    method: 'GET',
    url: `/api/qr/${dailyQr.id}/daily-stats`,
    headers: { 'x-api-key': validKey }
  });
  assert.strictEqual(initialDailyRes.statusCode, 200);
  const initialDailyJson = JSON.parse(initialDailyRes.body);
  assert.strictEqual(initialDailyJson.dailyScans, 0);
  assert.strictEqual(initialDailyJson.dailyUniqueVisitors, 0);

  // 2 ingresos de Persona 1 + 1 ingreso de Persona 2 = 3 ingresos hoy, 2 personas únicas
  for (const ua of ['Visitor-Phone-1', 'Visitor-Phone-1', 'Visitor-Phone-2']) {
    const s = await app.inject({
      method: 'GET',
      url: `/scan/${dailyQr.id}?token=${dailyTok}`,
      headers: { 'user-agent': ua }
    });
    assert.strictEqual(s.statusCode, 302);
  }

  const afterDailyRes = await app.inject({
    method: 'GET',
    url: `/api/qr/${dailyQr.id}/daily-stats`,
    headers: { 'x-api-key': validKey }
  });
  assert.strictEqual(afterDailyRes.statusCode, 200);
  const afterDailyJson = JSON.parse(afterDailyRes.body);
  assert.strictEqual(afterDailyJson.dailyScans, 3, 'Debe contar exactamente los 3 ingresos exitosos de hoy');
  assert.strictEqual(afterDailyJson.dailyUniqueVisitors, 2, 'Debe contar 2 personas únicas hoy');
  assert.ok(afterDailyJson.days.length >= 2, 'El historial diario debe incluir hoy y el registro de ayer');
  assert.strictEqual(afterDailyJson.days[0].date, afterDailyJson.todayDate);
  assert.strictEqual(afterDailyJson.days[0].scans, 3);
  assert.strictEqual(afterDailyJson.days[0].uniqueVisitors, 2);
  assert.strictEqual(afterDailyJson.days[1].scans, 1, 'El día de ayer debe mantenerse separado con 1 ingreso');

  // Vista pública /view/:viewToken y /meta deben reflejar el contador diario exacto
  const resDailyViewHtml = await app.inject({ method: 'GET', url: `/view/${dailyQr.viewToken}` });
  assert.strictEqual(resDailyViewHtml.statusCode, 200);
  assert.ok(resDailyViewHtml.body.includes('id="meta-daily-scans"'));
  assert.ok(resDailyViewHtml.body.includes('id="meta-daily-visitors"'));
  const resDailyViewMeta = await app.inject({ method: 'GET', url: `/view/${dailyQr.viewToken}/meta` });
  assert.strictEqual(resDailyViewMeta.statusCode, 200);
  const dailyViewMeta = JSON.parse(resDailyViewMeta.body);
  assert.strictEqual(dailyViewMeta.dailyScans, 3);
  assert.strictEqual(dailyViewMeta.dailyUniqueVisitors, 2);

  // Un intento rechazado (token one_time expirado) NO debe incrementar el contador diario de ingresos reales
  const resOneTimeDaily = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: { 'x-api-key': validKey, 'content-type': 'application/json' },
    payload: JSON.stringify({
      title: 'Diario 1-Uso',
      target_url: 'https://example.com/one-time-daily',
      rotation_strategy: 'one_time'
    })
  });
  const otDailyQr = JSON.parse(resOneTimeDaily.body).qr;
  const otTok = new URL(otDailyQr.scan_url).searchParams.get('token');
  const otOkScan = await app.inject({ method: 'GET', url: `/scan/${otDailyQr.id}?token=${otTok}`, headers: { 'user-agent': 'Ot-User' } });
  assert.strictEqual(otOkScan.statusCode, 302);
  const otExpiredScan = await app.inject({ method: 'GET', url: `/scan/${otDailyQr.id}?token=${otTok}`, headers: { 'user-agent': 'Ot-User-2' } });
  assert.strictEqual(otExpiredScan.statusCode, 200);
  const otStats = JSON.parse((await app.inject({ method: 'GET', url: `/api/qr/${otDailyQr.id}/daily-stats`, headers: { 'x-api-key': validKey } })).body);
  assert.strictEqual(otStats.dailyScans, 1, 'El escaneo expirado no debe sumarse al contador diario de ingresos');
  assert.strictEqual(otStats.dailyUniqueVisitors, 1);

  // Endpoint global /api/stats/daily y summary de /api/qr
  const globalDailyRes = await app.inject({ method: 'GET', url: '/api/stats/daily', headers: { 'x-api-key': validKey } });
  assert.strictEqual(globalDailyRes.statusCode, 200);
  const globalDailyJson = JSON.parse(globalDailyRes.body);
  assert.ok(globalDailyJson.dailyScans >= 4);
  assert.ok(globalDailyJson.dailyUniqueVisitors >= 2);
  console.log('✅ Contador diario (ingresos hoy, personas únicas hoy, historial y exclusión de expirados) verificado.');

  // Test 23: Caché ETag (304 Not Modified) en modelos 3D GLB y soporte Realidad Aumentada en vista pública
  console.log('\nTest 23: Verificando caché ETag de modelos GLB y botón AR en vista pública...');
  const resModelFirst = await app.inject({ method: 'GET', url: `/view/${viewToken}/model` });
  assert.strictEqual(resModelFirst.statusCode, 200);
  const modelEtag = resModelFirst.headers.etag;
  assert.ok(modelEtag && modelEtag.startsWith('"glb-'), 'El modelo debe exponer ETag fuerte');

  const resModel304 = await app.inject({
    method: 'GET',
    url: `/view/${viewToken}/model`,
    headers: { 'if-none-match': modelEtag }
  });
  assert.strictEqual(resModel304.statusCode, 304, 'Revalidación con ETag debe responder 304 Not Modified');

  const resApiModelFirst = await app.inject({ method: 'GET', url: `/api/qr/${sipanQrId}/model` });
  assert.strictEqual(resApiModelFirst.statusCode, 200);
  const resApiModel304 = await app.inject({
    method: 'GET',
    url: `/api/qr/${sipanQrId}/model`,
    headers: { 'if-none-match': resApiModelFirst.headers.etag }
  });
  assert.strictEqual(resApiModel304.statusCode, 304);

  const resArViewHtml = await app.inject({ method: 'GET', url: `/view/${viewToken}` });
  assert.ok(resArViewHtml.body.includes('id="btn-view-ar"'), 'La vista pública debe incluir botón de Realidad Aumentada');
  console.log('✅ Caché ETag/304 de modelos GLB y botón AR verificados correctamente.');

  // Test 24: Login Superadmin, creación de Sitios Web + Administradores y vista global
  console.log('\nTest 24: Verificando Login de Superadmin, creación de Sitios Web + Administradores...');
  const resBadLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ identifier: config.superadminUsername, password: 'wrong_password' })
  });
  assert.strictEqual(resBadLogin.statusCode, 401);

  const resSuperLogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ identifier: config.superadminUsername, password: config.superadminPassword })
  });
  assert.strictEqual(resSuperLogin.statusCode, 200);
  const superLoginJson = JSON.parse(resSuperLogin.body);
  assert.ok(superLoginJson.token && superLoginJson.token.startsWith('qr3dses_'));
  assert.strictEqual(superLoginJson.user.role, 'superadmin');
  assert.ok(String(resSuperLogin.headers['set-cookie'] || '').includes('qr3d_session='));
  const superBearer = `Bearer ${superLoginJson.token}`;

  const resCreateSiteA = await app.inject({
    method: 'POST',
    url: '/api/tenants',
    headers: { authorization: superBearer, 'content-type': 'application/json' },
    payload: JSON.stringify({
      name: 'Museo Larco Web',
      website_url: 'https://museolarco.org',
      admin_user: {
        username: 'admin_larco',
        email: 'admin@museolarco.org',
        full_name: 'Admin Larco',
        password: 'LarcoPass2026!'
      }
    })
  });
  assert.strictEqual(resCreateSiteA.statusCode, 201, resCreateSiteA.body);
  const siteAJson = JSON.parse(resCreateSiteA.body);
  assert.strictEqual(siteAJson.adminUser.role, 'admin');
  assert.strictEqual(siteAJson.adminUser.tenant_id, siteAJson.tenant.id);
  const siteAId = siteAJson.tenant.id;
  const siteAInitialKey = siteAJson.tenant.apiKey;

  const resCreateSiteB = await app.inject({
    method: 'POST',
    url: '/api/tenants',
    headers: { authorization: superBearer, 'content-type': 'application/json' },
    payload: JSON.stringify({
      name: 'Galería Lima Web',
      website_url: 'https://galerialima.pe',
      admin_user: { username: 'admin_lima', password: 'LimaPass2026!' }
    })
  });
  assert.strictEqual(resCreateSiteB.statusCode, 201);

  const resListTenants = await app.inject({
    method: 'GET',
    url: '/api/tenants',
    headers: { authorization: superBearer }
  });
  assert.strictEqual(resListTenants.statusCode, 200);
  const tenantsListJson = JSON.parse(resListTenants.body);
  assert.ok(tenantsListJson.tenants.length >= 3, 'Superadmin debe ver todos los sitios web');
  console.log('✅ Superadmin autenticado y sitios web con administradores creados.');

  // Test 25: Administrador de sitio gestiona API Key y Usuarios 3D aislados
  console.log('\nTest 25: Verificando permisos de Administrador de sitio y aislamiento de Usuarios 3D...');
  const resAdminALogin = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ identifier: 'admin_larco', password: 'LarcoPass2026!' })
  });
  assert.strictEqual(resAdminALogin.statusCode, 200);
  const adminABearer = `Bearer ${JSON.parse(resAdminALogin.body).token}`;

  // Admin de sitio NO puede listar todos los tenants ni crear otro admin
  const resAdminListTenants = await app.inject({
    method: 'GET',
    url: '/api/tenants',
    headers: { authorization: adminABearer }
  });
  assert.strictEqual(resAdminListTenants.statusCode, 403);

  const resAdminCreateAdmin = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { authorization: adminABearer, 'content-type': 'application/json' },
    payload: JSON.stringify({ username: 'hack_admin', role: 'admin', password: 'Password123' })
  });
  assert.strictEqual(resAdminCreateAdmin.statusCode, 403);

  // Admin de sitio puede rotar la API Key de su sitio (invalidando la anterior)
  const resRotateSiteA = await app.inject({
    method: 'POST',
    url: '/api/tenants/me/rotate-key',
    headers: { authorization: adminABearer }
  });
  assert.strictEqual(resRotateSiteA.statusCode, 200);
  const newSiteAKey = JSON.parse(resRotateSiteA.body).apiKey;
  assert.notStrictEqual(newSiteAKey, siteAInitialKey);

  const resOldKey = await app.inject({ method: 'GET', url: '/api/qr', headers: { 'x-api-key': siteAInitialKey } });
  assert.strictEqual(resOldKey.statusCode, 403, 'API Key anterior debe quedar revocada tras rotar');
  const resNewKey = await app.inject({ method: 'GET', url: '/api/qr', headers: { 'x-api-key': newSiteAKey } });
  assert.strictEqual(resNewKey.statusCode, 200);

  // Admin crea dos usuarios 3D dentro de su sitio
  const resCreateUser1 = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { authorization: adminABearer, 'content-type': 'application/json' },
    payload: JSON.stringify({
      username: 'creador_larco_1',
      full_name: 'Creador 1',
      role: 'user',
      generate_password: true
    })
  });
  assert.strictEqual(resCreateUser1.statusCode, 201);
  const user1Json = JSON.parse(resCreateUser1.body);
  assert.ok(user1Json.generatedPassword && user1Json.generatedPassword.length >= 6);

  const resCreateUser2 = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: { authorization: adminABearer, 'content-type': 'application/json' },
    payload: JSON.stringify({
      username: 'creador_larco_2',
      full_name: 'Creador 2',
      role: 'user',
      password: 'UserTwo2026!'
    })
  });
  assert.strictEqual(resCreateUser2.statusCode, 201);

  const user1Login = JSON.parse((await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ identifier: 'creador_larco_1', password: user1Json.generatedPassword })
  })).body);
  const user1Bearer = `Bearer ${user1Login.token}`;

  const user2Login = JSON.parse((await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ identifier: 'creador_larco_2', password: 'UserTwo2026!' })
  })).body);
  const user2Bearer = `Bearer ${user2Login.token}`;

  // User 1 crea su propio QR 3D
  const resUser1Qr = await app.inject({
    method: 'POST',
    url: '/api/qr',
    headers: { authorization: user1Bearer, 'content-type': 'application/json' },
    payload: JSON.stringify({
      title: 'Huaco Retrato User 1',
      target_url: 'https://museolarco.org/huaco-1'
    })
  });
  assert.strictEqual(resUser1Qr.statusCode, 201);
  const user1QrId = JSON.parse(resUser1Qr.body).qr.id;

  // User 1 lo ve; User 2 NO lo ve y no puede editarlo/borrarlo ni gestionar usuarios/API key
  const user1List = JSON.parse((await app.inject({ method: 'GET', url: '/api/qr', headers: { authorization: user1Bearer } })).body);
  assert.strictEqual(user1List.items.length, 1);
  assert.strictEqual(user1List.items[0].id, user1QrId);

  const user2List = JSON.parse((await app.inject({ method: 'GET', url: '/api/qr', headers: { authorization: user2Bearer } })).body);
  assert.strictEqual(user2List.items.length, 0, 'User 2 no debe ver los QRs de User 1');

  const user2DelUser1 = await app.inject({ method: 'DELETE', url: `/api/qr/${user1QrId}`, headers: { authorization: user2Bearer } });
  assert.strictEqual(user2DelUser1.statusCode, 404);

  const user2ListUsers = await app.inject({ method: 'GET', url: '/api/users', headers: { authorization: user2Bearer } });
  assert.strictEqual(user2ListUsers.statusCode, 403);

  const user2RotateKey = await app.inject({ method: 'POST', url: '/api/tenants/me/rotate-key', headers: { authorization: user2Bearer } });
  assert.strictEqual(user2RotateKey.statusCode, 403);

  // Admin del sitio sí ve el QR de User 1, pero Admin del sitio B NO ve nada del sitio A
  const adminAList = JSON.parse((await app.inject({ method: 'GET', url: '/api/qr', headers: { authorization: adminABearer } })).body);
  assert.ok(adminAList.items.some((q) => q.id === user1QrId && q.owner_username === 'creador_larco_1'));

  const adminBLogin = JSON.parse((await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ identifier: 'admin_lima', password: 'LimaPass2026!' })
  })).body);
  const adminBList = JSON.parse((await app.inject({ method: 'GET', url: '/api/qr', headers: { authorization: `Bearer ${adminBLogin.token}` } })).body);
  assert.strictEqual(adminBList.items.length, 0);

  // Superadmin ve TODOS los QRs (de tenant_default y de Site A)
  const superAllQrs = JSON.parse((await app.inject({ method: 'GET', url: '/api/qr', headers: { authorization: superBearer } })).body);
  assert.ok(superAllQrs.items.some((q) => q.id === user1QrId));
  assert.ok(superAllQrs.items.some((q) => q.id === sipanQrId));
  console.log('✅ Aislamiento entre Superadmin, Admin de sitio y Usuarios 3D verificado.');

  // Test 26: Cambio de contraseña, logout y desactivación revocan sesiones inmediatamente
  console.log('\nTest 26: Verificando cambio de contraseña, logout y desactivación de usuario/sitio...');
  const resChangePwd = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: { authorization: user1Bearer, 'content-type': 'application/json' },
    payload: JSON.stringify({
      current_password: user1Json.generatedPassword,
      new_password: 'NewUser1Pass2026!'
    })
  });
  assert.strictEqual(resChangePwd.statusCode, 200);

  const resLogout = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { authorization: user1Bearer }
  });
  assert.strictEqual(resLogout.statusCode, 200);

  const resAfterLogout = await app.inject({ method: 'GET', url: '/api/qr', headers: { authorization: user1Bearer } });
  assert.strictEqual(resAfterLogout.statusCode, 401, 'Token cerrado con logout debe quedar inválido');

  const user1Relogin = JSON.parse((await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ identifier: 'creador_larco_1', password: 'NewUser1Pass2026!' })
  })).body);
  assert.ok(user1Relogin.token);

  // Admin desactiva a User 1 -> su sesión activa se revoca al instante
  const resDeactUser = await app.inject({
    method: 'PATCH',
    url: `/api/users/${user1Json.user.id}`,
    headers: { authorization: adminABearer, 'content-type': 'application/json' },
    payload: JSON.stringify({ is_active: false })
  });
  assert.strictEqual(resDeactUser.statusCode, 200);

  const resDeactSession = await app.inject({
    method: 'GET',
    url: '/api/qr',
    headers: { authorization: `Bearer ${user1Relogin.token}` }
  });
  assert.strictEqual(resDeactSession.statusCode, 401);

  // Superadmin suspende Sitio A -> Admin A pierde acceso inmediatamente
  const resDeactSite = await app.inject({
    method: 'PATCH',
    url: `/api/tenants/${siteAId}`,
    headers: { authorization: superBearer, 'content-type': 'application/json' },
    payload: JSON.stringify({ is_active: false })
  });
  assert.strictEqual(resDeactSite.statusCode, 200);

  const resAdminAfterSiteSuspend = await app.inject({
    method: 'GET',
    url: '/api/qr',
    headers: { authorization: adminABearer }
  });
  assert.strictEqual(resAdminAfterSiteSuspend.statusCode, 401);
  console.log('✅ Cambio de contraseña, logout y revocación inmediata por suspensión verificados.');

  // Test 27: Respuesta explícita 503 cuando el servicio / base de datos no se activó
  console.log('\nTest 27: Verificando bloqueo y mensaje de error 503 si el servicio no se activó...');
  setDbErrorForTest('Fallo simulado de base de datos');

  const resHealthDown = await app.inject({ method: 'GET', url: '/health' });
  assert.strictEqual(resHealthDown.statusCode, 503);
  const healthDownJson = JSON.parse(resHealthDown.body);
  assert.strictEqual(healthDownJson.serviceActive, false);
  assert.ok(healthDownJson.error.includes('El servicio no se activó'));

  const resApiDown = await app.inject({
    method: 'GET',
    url: '/api/files',
    headers: { 'x-api-key': validKey }
  });
  assert.strictEqual(resApiDown.statusCode, 503);
  const apiDownJson = JSON.parse(resApiDown.body);
  assert.strictEqual(apiDownJson.error, 'SERVICE_INACTIVE');
  assert.strictEqual(apiDownJson.serviceActive, false);
  assert.ok(apiDownJson.message.includes('El servicio no se activó'));

  const resViewDown = await app.inject({ method: 'GET', url: `/view/${viewToken}` });
  assert.strictEqual(resViewDown.statusCode, 503);
  console.log('✅ Estado inactivo (503 SERVICE_INACTIVE) verificado correctamente.');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS (27/27) PASARON SATISFACTORIAMENTE!\n');
  } finally {
    stopQrRotationScheduler();
    if (app) await app.close().catch(() => {});
    await closeDb();
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${testSqlitePath}${suffix}`, { force: true });
    }
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
