import assert from 'assert';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { initDb, db } from '../src/db/pool.js';
import { eventBus } from '../src/config/redis.js';
import { qrRoutes } from '../src/routes/qr.routes.js';
import { scanRoutes } from '../src/routes/scan.routes.js';
import { tenantRoutes } from '../src/routes/tenant.routes.js';
import { config } from '../src/config/env.js';

async function runTests() {
  console.log('🧪 Iniciando Suite de Pruebas de la API 3D-QR...\n');

  // 1. Inicializar DB & EventBus
  await initDb();
  await eventBus.init();

  const app = Fastify({ bodyLimit: config.maxModelSizeMb * 1024 * 1024 });
  await app.register(multipart, {
    limits: { fileSize: config.maxModelSizeMb * 1024 * 1024 }
  });
  await app.register(qrRoutes);
  await app.register(scanRoutes);
  await app.register(tenantRoutes);
  await app.ready();

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

  console.log('\n🎉 ¡TODAS LAS PRUEBAS (11/11) PASARON SATISFACTORIAMENTE!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
