import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const TOTEM_BASE_HEIGHT = 2.85;
const TOTEM_FRONT_DEPTH = 0.105;

function createNodeIO() {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS);
}

function srgbToLinearChannel(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function readRawGlbGenerator(glbBuffer) {
  try {
    if (!glbBuffer || glbBuffer.length < 28) return null;
    if (glbBuffer.slice(0, 4).toString('ascii') !== 'glTF') return null;
    const jsonLen = glbBuffer.readUInt32LE(12);
    const jsonType = glbBuffer.slice(16, 20).toString('ascii');
    if (jsonType !== 'JSON' || 20 + jsonLen > glbBuffer.length) return null;
    const gltfJson = JSON.parse(glbBuffer.slice(20, 20 + jsonLen).toString('utf8'));
    return gltfJson?.asset?.generator || null;
  } catch {
    return null;
  }
}

/**
 * Calibra materiales exportados con valores sRGB crudos (p.ej. MuseoSipan3D-Generator)
 * al espacio lineal exigido por la especificación glTF 2.0, evitando tonos lavados en visores PBR.
 */
export function calibrateLegacySrgbMaterials(doc, rawGenerator = null) {
  const generator = rawGenerator || doc.getRoot().getAsset().generator;
  if (generator !== 'MuseoSipan3D-Generator') {
    return false;
  }

  for (const mat of doc.getRoot().listMaterials()) {
    const name = (mat.getName() || '').toLowerCase();
    if (!mat.getBaseColorTexture()) {
      const [r, g, b, a] = mat.getBaseColorFactor();
      mat.setBaseColorFactor([
        srgbToLinearChannel(r),
        srgbToLinearChannel(g),
        srgbToLinearChannel(b),
        a
      ]);
    } else if (name === 'truss_glass') {
      mat.setBaseColorFactor([0.62, 0.72, 0.82, 1.0]);
      mat.setMetallicFactor(0.12);
      mat.setRoughnessFactor(0.38);
    } else if (name.startsWith('plaque_')) {
      mat.setMetallicFactor(0.15);
      mat.setRoughnessFactor(0.45);
    }
  }

  return true;
}

/**
 * Convierte color hex '#RRGGBB' a arreglo normalizado [r, g, b, a] en espacio lineal para glTF
 */
export function hexToRgba(hex, alpha = 1.0) {
  const clean = (hex || '#1e293b').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return [0.12, 0.16, 0.23, alpha];
  }
  return [r, g, b, alpha];
}

function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14]
  ];
}

/**
 * Calcula la caja envolvente (AABB) global de todos los nodos con malla en la escena
 */
export function computeSceneBounds(doc) {
  const root = doc.getRoot();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const vec = [0, 0, 0];

  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const worldMatrix = node.getWorldMatrix();

    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute('POSITION');
      if (!posAttr || posAttr.getCount() === 0) continue;

      let pMin = posAttr.getMin([Infinity, Infinity, Infinity]);
      let pMax = posAttr.getMax([-Infinity, -Infinity, -Infinity]);
      if (!pMin.every(Number.isFinite) || !pMax.every(Number.isFinite)) {
        pMin = [Infinity, Infinity, Infinity];
        pMax = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < posAttr.getCount(); i++) {
          posAttr.getElement(i, vec);
          for (let k = 0; k < 3; k++) {
            if (vec[k] < pMin[k]) pMin[k] = vec[k];
            if (vec[k] > pMax[k]) pMax[k] = vec[k];
          }
        }
      }

      for (let ix = 0; ix < 2; ix++) {
        for (let iy = 0; iy < 2; iy++) {
          for (let iz = 0; iz < 2; iz++) {
            const [wx, wy, wz] = transformPoint(
              worldMatrix,
              ix ? pMax[0] : pMin[0],
              iy ? pMax[1] : pMin[1],
              iz ? pMax[2] : pMin[2]
            );
            if (wx < min[0]) min[0] = wx;
            if (wy < min[1]) min[1] = wy;
            if (wz < min[2]) min[2] = wz;
            if (wx > max[0]) max[0] = wx;
            if (wy > max[1]) max[1] = wy;
            if (wz > max[2]) max[2] = wz;
          }
        }
      }
    }
  }

  if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) {
    return { min: [-1, 0, -1], max: [1, 2, 1] };
  }
  return { min, max };
}

function createBoxNormals(faceNormals) {
  const normals = new Float32Array(faceNormals.length * 4 * 3);
  for (let f = 0; f < faceNormals.length; f++) {
    const [nx, ny, nz] = faceNormals[f];
    for (let v = 0; v < 4; v++) {
      const idx = (f * 4 + v) * 3;
      normals[idx] = nx;
      normals[idx + 1] = ny;
      normals[idx + 2] = nz;
    }
  }
  return normals;
}

function buildBoxGeometry(cx, cy, cz, hw, hh, hd) {
  const x0 = cx - hw, x1 = cx + hw;
  const y0 = cy - hh, y1 = cy + hh;
  const z0 = cz - hd, z1 = cz + hd;

  const positions = new Float32Array([
    // Front (+Z)
    x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1,
    // Back (-Z)
    x0, y0, z0,  x0, y1, z0,  x1, y1, z0,  x1, y0, z0,
    // Top (+Y)
    x0, y1, z0,  x0, y1, z1,  x1, y1, z1,  x1, y1, z0,
    // Bottom (-Y)
    x0, y0, z0,  x1, y0, z0,  x1, y0, z1,  x0, y0, z1,
    // Right (+X)
    x1, y0, z0,  x1, y1, z0,  x1, y1, z1,  x1, y0, z1,
    // Left (-X)
    x0, y0, z0,  x0, y0, z1,  x0, y1, z1,  x0, y1, z0
  ]);

  const normals = createBoxNormals([
    [0, 0, 1],
    [0, 0, -1],
    [0, 1, 0],
    [0, -1, 0],
    [1, 0, 0],
    [-1, 0, 0]
  ]);

  const indices = new Uint16Array(36);
  for (let i = 0; i < 6; i++) {
    const b = i * 4;
    const o = i * 6;
    indices[o] = b;
    indices[o + 1] = b + 1;
    indices[o + 2] = b + 2;
    indices[o + 3] = b;
    indices[o + 4] = b + 2;
    indices[o + 5] = b + 3;
  }

  return { positions, normals, indices };
}

/**
 * Añade un totem 3D con el QR texturizado dentro de un Document glTF existente
 */
function appendTotemToScene(doc, scene, qrTexture, dominantColorHex = '#1e293b', options = {}) {
  const {
    scale = 1,
    translation = [0, 0, 0],
    nodeName = 'Totem_Root'
  } = options;

  const buffer = doc.getRoot().listBuffers()[0] || doc.createBuffer();

  const qrMaterial = doc.createMaterial('QR_Display_Material')
    .setBaseColorFactor([1, 1, 1, 1])
    .setBaseColorTexture(qrTexture)
    .setRoughnessFactor(0.18)
    .setMetallicFactor(0.0);

  const frameMaterial = doc.createMaterial('Structure_Frame_Material')
    .setBaseColorFactor(hexToRgba(dominantColorHex, 1.0))
    .setRoughnessFactor(0.28)
    .setMetallicFactor(0.25);

  const baseMaterial = doc.createMaterial('Pedestal_Material')
    .setBaseColorFactor([0.15, 0.17, 0.2, 1.0])
    .setRoughnessFactor(0.35)
    .setMetallicFactor(0.7);

  // Pantalla frontal (+Z) y trasera (-Z) del QR con UVs exactas [0..1]
  const qrHalf = 1.0;
  const qrCenterY = 1.6;
  const qrZ = TOTEM_FRONT_DEPTH;
  const qrPositions = new Float32Array([
    // Frontal (+Z)
    -qrHalf, -qrHalf + qrCenterY,  qrZ,
     qrHalf, -qrHalf + qrCenterY,  qrZ,
     qrHalf,  qrHalf + qrCenterY,  qrZ,
    -qrHalf,  qrHalf + qrCenterY,  qrZ,
    // Trasera (-Z, sin espejado)
     qrHalf, -qrHalf + qrCenterY, -qrZ,
    -qrHalf, -qrHalf + qrCenterY, -qrZ,
    -qrHalf,  qrHalf + qrCenterY, -qrZ,
     qrHalf,  qrHalf + qrCenterY, -qrZ
  ]);
  const qrNormals = new Float32Array([
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1
  ]);
  const qrUvs = new Float32Array([
    0, 1,  1, 1,  1, 0,  0, 0,
    0, 1,  1, 1,  1, 0,  0, 0
  ]);
  const qrIndices = new Uint16Array([
    0, 1, 2,  0, 2, 3,
    4, 5, 6,  4, 6, 7
  ]);

  const qrPrim = doc.createPrimitive()
    .setMaterial(qrMaterial)
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(qrIndices).setBuffer(buffer))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(qrPositions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(qrNormals).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(qrUvs).setBuffer(buffer));

  // Chasis del totem
  const frameBox = buildBoxGeometry(0, qrCenterY, 0, 1.15, 1.25, 0.1);
  const framePrim = doc.createPrimitive()
    .setMaterial(frameMaterial)
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(frameBox.indices).setBuffer(buffer))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(frameBox.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(frameBox.normals).setBuffer(buffer));

  // Columna conectora + Pedestal inferior apoyado en Y = 0
  const stemBox = buildBoxGeometry(0, 0.275, 0, 0.28, 0.08, 0.09);
  const stemPrim = doc.createPrimitive()
    .setMaterial(baseMaterial)
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(stemBox.indices).setBuffer(buffer))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(stemBox.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(stemBox.normals).setBuffer(buffer));

  const baseBox = buildBoxGeometry(0, 0.1, 0, 0.85, 0.1, 0.75);
  const basePrim = doc.createPrimitive()
    .setMaterial(baseMaterial)
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(baseBox.indices).setBuffer(buffer))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(baseBox.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(baseBox.normals).setBuffer(buffer));

  const totemMesh = doc.createMesh(`${nodeName}_Mesh`);
  totemMesh.addPrimitive(framePrim);
  totemMesh.addPrimitive(qrPrim);
  totemMesh.addPrimitive(stemPrim);
  totemMesh.addPrimitive(basePrim);

  const totemNode = doc.createNode(nodeName)
    .setMesh(totemMesh)
    .setTranslation(translation)
    .setScale([scale, scale, scale]);

  scene.addChild(totemNode);
  return totemNode;
}

/**
 * Modifica un archivo GLB existente incrustando el QR como textura PBR.
 * - Si el modelo ya define un material llamado 'qr', 'screen' o 'display', reemplaza su textura en sitio.
 * - Si es un modelo arquitectónico o genérico (sin ranura QR), conserva intactos todos sus materiales y
 *   adjunta un totem/placa QR 3D proporcional frente al modelo.
 * @param {Buffer} glbBuffer
 * @param {Buffer} qrPngBuffer
 * @param {string} dominantColorHex
 * @returns {Promise<Buffer>}
 */
export async function embedQrIntoGlb(glbBuffer, qrPngBuffer, dominantColorHex = '#1e293b') {
  const rawGenerator = readRawGlbGenerator(glbBuffer);
  const io = createNodeIO();
  const doc = await io.readBinary(new Uint8Array(glbBuffer));
  const root = doc.getRoot();

  calibrateLegacySrgbMaterials(doc, rawGenerator);

  const qrTexture = doc.createTexture('QR_Texture_Dynamic')
    .setImage(new Uint8Array(qrPngBuffer))
    .setMimeType('image/png');

  const materials = root.listMaterials();
  const explicitQrMat = materials.find(m => {
    const name = (m.getName() || '').toLowerCase();
    return name.includes('qr') || name.includes('screen') || name.includes('display');
  });

  if (explicitQrMat) {
    explicitQrMat.setBaseColorFactor([1, 1, 1, 1]);
    explicitQrMat.setBaseColorTexture(qrTexture);
    explicitQrMat.setRoughnessFactor(0.2);
    explicitQrMat.setMetallicFactor(0.05);

    // Solo recolorar un material de marco en totems dedicados o materiales explícitos de marco
    const explicitFrameMat = materials.find(m => {
      if (m === explicitQrMat) return false;
      const name = (m.getName() || '').toLowerCase();
      return name.includes('frame') || name.includes('marco') || materials.length <= 3;
    });
    if (explicitFrameMat && dominantColorHex) {
      explicitFrameMat.setBaseColorFactor(hexToRgba(dominantColorHex, 1.0));
    }
  } else {
    // Modelo general/arquitectónico: preservar sus materiales intactos y montar un totem QR proporcional al frente
    let scene = root.getDefaultScene() || root.listScenes()[0];
    if (!scene) {
      scene = doc.createScene('Scene_3DQR');
      root.setDefaultScene(scene);
    }

    const bounds = computeSceneBounds(doc);
    const spanX = bounds.max[0] - bounds.min[0];
    const spanY = bounds.max[1] - bounds.min[1];
    const spanZ = bounds.max[2] - bounds.min[2];
    const maxSpan = Math.max(spanX, spanY, spanZ, 1);

    const targetHeight = Math.min(Math.max(spanY * 0.5, maxSpan * 0.14), maxSpan * 0.45);
    const totemScale = Math.max(0.4, targetHeight / TOTEM_BASE_HEIGHT);

    const centerX = (bounds.min[0] + bounds.max[0]) * 0.5;
    const baseY = bounds.min[1];
    const marginZ = Math.max(0.6, totemScale * 1.35);
    const frontZ = bounds.max[2] + marginZ;

    appendTotemToScene(doc, scene, qrTexture, dominantColorHex, {
      scale: totemScale,
      translation: [centerX, baseY, frontZ],
      nodeName: 'QR_Totem_Integrated'
    });
  }

  const outputGlbUint8 = await io.writeBinary(doc);
  return Buffer.from(outputGlbUint8);
}

/**
 * Genera un modelo 3D moderno (Totem / Stand interactivo) en GLB nativo con el QR texturizado
 * @param {Buffer} qrPngBuffer
 * @param {string} dominantColorHex
 * @param {string} secondaryColorHex
 * @returns {Promise<Buffer>}
 */
export async function generateDefault3dTotemGlb(qrPngBuffer, dominantColorHex = '#1e293b', secondaryColorHex = '#ffffff') {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene('Scene_3DQR');
  doc.getRoot().setDefaultScene(scene);

  const qrTexture = doc.createTexture('QR_Texture')
    .setImage(new Uint8Array(qrPngBuffer))
    .setMimeType('image/png');

  appendTotemToScene(doc, scene, qrTexture, dominantColorHex, {
    scale: 1,
    translation: [0, 0, 0],
    nodeName: 'Totem_Root'
  });

  const io = createNodeIO();
  const glbUint8 = await io.writeBinary(doc);
  return Buffer.from(glbUint8);
}

/**
 * Procesa el modelo 3D: convierte/incrusta el QR en el modelo recibido o genera el totem 3D adaptativo
 */
export async function process3dModel({
  modelBuffer,
  format = 'glb',
  qrPngBuffer,
  dominantColorHex = '#1e293b',
  secondaryColorHex = '#ffffff'
}) {
  if (modelBuffer && modelBuffer.length > 20) {
    const magic = modelBuffer.slice(0, 4).toString('ascii');
    if (magic === 'glTF' || format.toLowerCase() === 'glb') {
      try {
        return await embedQrIntoGlb(modelBuffer, qrPngBuffer, dominantColorHex);
      } catch (err) {
        console.warn('Advertencia al incrustar en GLB subido, generando modelo fallback estilizado:', err.message);
      }
    }
  }

  return await generateDefault3dTotemGlb(qrPngBuffer, dominantColorHex, secondaryColorHex);
}
