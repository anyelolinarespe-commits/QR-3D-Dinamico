import crypto from 'crypto';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { zipSync, strToU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { computeSceneBounds } from './model3d.service.js';
import { ensureQrPngForBaseUrl, parseMetadata } from './qrLink.service.js';
import { resolveEffectiveViewerConfig } from './viewerConfig.service.js';

const AR_CACHE_LIMIT = 16;
const arAssetCache = new Map();

function createNodeIO() {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS);
}

function getCachedArAsset(key) {
  if (!arAssetCache.has(key)) return null;
  const val = arAssetCache.get(key);
  // Refrescar orden LRU
  arAssetCache.delete(key);
  arAssetCache.set(key, val);
  return val;
}

function setCachedArAsset(key, buffer) {
  if (arAssetCache.has(key)) {
    arAssetCache.delete(key);
  }
  arAssetCache.set(key, buffer);
  if (arAssetCache.size > AR_CACHE_LIMIT) {
    const oldestKey = arAssetCache.keys().next().value;
    arAssetCache.delete(oldestKey);
  }
}

function detachTotemNodes(doc) {
  const root = doc.getRoot();
  for (const node of root.listNodes()) {
    if (node.getName() === 'QR_Totem_Integrated') {
      const parent = node.getParentNode();
      if (parent) {
        parent.removeChild(node);
      } else {
        for (const scene of root.listScenes()) {
          scene.removeChild(node);
        }
      }
      node.dispose();
    }
  }
}

export function computeArNormalizationTransform(bounds, options = {}) {
  const {
    targetMaxSpan = 0.9,
    minSpanThreshold = 0.25,
    maxSpanThreshold = 1.6
  } = options;

  const spanX = bounds.max[0] - bounds.min[0];
  const spanY = bounds.max[1] - bounds.min[1];
  const spanZ = bounds.max[2] - bounds.min[2];
  const maxSpan = Math.max(spanX, spanY, spanZ, 0.001);

  const scale = (maxSpan > maxSpanThreshold || maxSpan < minSpanThreshold)
    ? targetMaxSpan / maxSpan
    : 1;

  const centerX = (bounds.min[0] + bounds.max[0]) * 0.5;
  const centerZ = (bounds.min[2] + bounds.max[2]) * 0.5;
  const minY = bounds.min[1];

  return {
    scale,
    translation: [-centerX * scale, -minY * scale, -centerZ * scale],
    maxSpan
  };
}

function applyLatestQrTexture(doc, qrPngBuffer) {
  if (!qrPngBuffer || qrPngBuffer.length === 0) return;
  const root = doc.getRoot();
  const qrMat = root.listMaterials().find((m) => {
    const n = (m.getName() || '').toLowerCase();
    return n.includes('qr') || n.includes('screen') || n.includes('display');
  });
  if (!qrMat) return;
  const tex = qrMat.getBaseColorTexture() || doc.createTexture('QR_Texture_Dynamic');
  tex.setImage(new Uint8Array(qrPngBuffer)).setMimeType('image/png');
  qrMat.setBaseColorTexture(tex);
}

/**
 * Normaliza un GLB para Realidad Aumentada: lo centra en X/Z, apoya su base en Y=0
 * y escala maquetas muy grandes (ej. 72m) o diminutas a tamaño maqueta (~0.9m).
 */
export async function normalizeGlbForAr(glbBuffer, options = {}) {
  const hideTotem = Boolean(options.hideTotem);
  const qrPngBuffer = options.qrPngBuffer ? Buffer.from(options.qrPngBuffer) : null;
  const rawBuf = Buffer.isBuffer(glbBuffer) ? glbBuffer : Buffer.from(glbBuffer);
  const sha = crypto.createHash('sha1').update(rawBuf).digest('hex');
  const qrSha = (!hideTotem && qrPngBuffer) ? crypto.createHash('sha1').update(qrPngBuffer).digest('hex').slice(0, 10) : 'none';
  const cacheKey = `glb_ar:${sha}:${hideTotem ? '1' : '0'}:${qrSha}`;
  const cached = getCachedArAsset(cacheKey);
  if (cached) return cached;

  const io = createNodeIO();
  const doc = await io.readBinary(new Uint8Array(rawBuf));
  if (hideTotem) {
    detachTotemNodes(doc);
  } else if (qrPngBuffer) {
    applyLatestQrTexture(doc, qrPngBuffer);
  }

  const bounds = computeSceneBounds(doc);
  const { scale, translation } = computeArNormalizationTransform(bounds, options);

  const root = doc.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];
  if (scene) {
    const existingChildren = scene.listChildren();
    if (existingChildren.length > 0) {
      const arRoot = doc.createNode('AR_Normalized_Root')
        .setScale([scale, scale, scale])
        .setTranslation(translation);
      for (const child of existingChildren) {
        scene.removeChild(child);
        arRoot.addChild(child);
      }
      scene.addChild(arRoot);
    }
  }

  const outUint8 = await io.writeBinary(doc);
  const outBuf = Buffer.from(outUint8);
  setCachedArAsset(cacheKey, outBuf);
  return outBuf;
}

function fmtFloat(n) {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return '0';
  return String(Number(n.toPrecision(7)));
}

function sanitizeUsdName(raw, fallback = 'Node') {
  let clean = String(raw || '').replace(/[^A-Za-z0-9_]/g, '_');
  if (!clean) clean = fallback;
  if (/^[0-9]/.test(clean)) clean = '_' + clean;
  return clean;
}

function makeUniqueUsdName(raw, usedNames, fallback = 'Node') {
  const base = sanitizeUsdName(raw, fallback);
  let candidate = base;
  let n = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base}_${n++}`;
  }
  usedNames.add(candidate);
  return candidate;
}

function buildMatrix4dLiteral(m) {
  return `( (${fmtFloat(m[0])}, ${fmtFloat(m[1])}, ${fmtFloat(m[2])}, ${fmtFloat(m[3])}), (${fmtFloat(m[4])}, ${fmtFloat(m[5])}, ${fmtFloat(m[6])}, ${fmtFloat(m[7])}), (${fmtFloat(m[8])}, ${fmtFloat(m[9])}, ${fmtFloat(m[10])}, ${fmtFloat(m[11])}), (${fmtFloat(m[12])}, ${fmtFloat(m[13])}, ${fmtFloat(m[14])}, ${fmtFloat(m[15])}) )`;
}

function computeTriangleNormals(positions, indices, vertexCount) {
  const normals = new Float32Array(vertexCount * 3);
  const count = indices.length;
  for (let i = 0; i + 2 < count; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];
    const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
    const bx = positions[i1 * 3], by = positions[i1 * 3 + 1], bz = positions[i1 * 3 + 2];
    const cx = positions[i2 * 3], cy = positions[i2 * 3 + 1], cz = positions[i2 * 3 + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const idx of [i0, i1, i2]) {
      normals[idx * 3] += nx;
      normals[idx * 3 + 1] += ny;
      normals[idx * 3 + 2] += nz;
    }
  }
  for (let v = 0; v < vertexCount; v++) {
    const nx = normals[v * 3];
    const ny = normals[v * 3 + 1];
    const nz = normals[v * 3 + 2];
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-6) {
      normals[v * 3] /= len;
      normals[v * 3 + 1] /= len;
      normals[v * 3 + 2] /= len;
    } else {
      normals[v * 3] = 0;
      normals[v * 3 + 1] = 1;
      normals[v * 3 + 2] = 0;
    }
  }
  return normals;
}

function buildUsdMeshBlock({
  name,
  indent,
  primitive,
  materialPath
}) {
  const posAttr = primitive.getAttribute('POSITION');
  if (!posAttr || posAttr.getCount() === 0) return '';

  const vertexCount = posAttr.getCount();
  const posArr = new Float32Array(vertexCount * 3);
  const tmp3 = [0, 0, 0];
  for (let i = 0; i < vertexCount; i++) {
    posAttr.getElement(i, tmp3);
    posArr[i * 3] = tmp3[0];
    posArr[i * 3 + 1] = tmp3[1];
    posArr[i * 3 + 2] = tmp3[2];
  }

  const idxAttr = primitive.getIndices();
  let indices;
  if (idxAttr && idxAttr.getCount() >= 3) {
    indices = new Uint32Array(idxAttr.getCount());
    for (let i = 0; i < idxAttr.getCount(); i++) {
      indices[i] = idxAttr.getScalar(i);
    }
  } else {
    indices = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      indices[i] = i;
    }
  }

  const triCount = Math.floor(indices.length / 3);
  if (triCount === 0) return '';
  const usableIndicesCount = triCount * 3;

  const normAttr = primitive.getAttribute('NORMAL');
  let normArr;
  if (normAttr && normAttr.getCount() === vertexCount) {
    normArr = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      normAttr.getElement(i, tmp3);
      normArr[i * 3] = tmp3[0];
      normArr[i * 3 + 1] = tmp3[1];
      normArr[i * 3 + 2] = tmp3[2];
    }
  } else {
    normArr = computeTriangleNormals(posArr, indices.subarray(0, usableIndicesCount), vertexCount);
  }

  const pointsParts = new Array(vertexCount);
  const normalsParts = new Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    pointsParts[i] = `(${fmtFloat(posArr[i * 3])}, ${fmtFloat(posArr[i * 3 + 1])}, ${fmtFloat(posArr[i * 3 + 2])})`;
    normalsParts[i] = `(${fmtFloat(normArr[i * 3])}, ${fmtFloat(normArr[i * 3 + 1])}, ${fmtFloat(normArr[i * 3 + 2])})`;
  }

  const faceVertexCounts = new Array(triCount).fill('3').join(', ');
  const faceVertexIndicesParts = new Array(usableIndicesCount);
  for (let i = 0; i < usableIndicesCount; i++) {
    faceVertexIndicesParts[i] = String(indices[i]);
  }

  const lines = [];
  const p = '\t'.repeat(indent);
  const mat = primitive.getMaterial();
  const isDoubleSided = mat ? mat.getDoubleSided() : false;

  const apiSchemas = materialPath ? ' (\n' + `${p}\tprepend apiSchemas = ["MaterialBindingAPI"]\n` + `${p})` : '';
  lines.push(`${p}def Mesh "${name}"${apiSchemas}`);
  lines.push(`${p}{`);
  if (isDoubleSided) {
    lines.push(`${p}\tuniform bool doubleSided = 1`);
  }
  lines.push(`${p}\tint[] faceVertexCounts = [${faceVertexCounts}]`);
  lines.push(`${p}\tint[] faceVertexIndices = [${faceVertexIndicesParts.join(', ')}]`);
  lines.push(`${p}\tnormal3f[] normals = [${normalsParts.join(', ')}] (`);
  lines.push(`${p}\t\tinterpolation = "vertex"`);
  lines.push(`${p}\t)`);
  lines.push(`${p}\tpoint3f[] points = [${pointsParts.join(', ')}]`);

  const uvAttr = primitive.getAttribute('TEXCOORD_0');
  if (uvAttr && uvAttr.getCount() === vertexCount) {
    const tmp2 = [0, 0];
    const uvParts = new Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      uvAttr.getElement(i, tmp2);
      uvParts[i] = `(${fmtFloat(tmp2[0])}, ${fmtFloat(1 - tmp2[1])})`;
    }
    lines.push(`${p}\ttexCoord2f[] primvars:st = [${uvParts.join(', ')}] (`);
    lines.push(`${p}\t\tinterpolation = "vertex"`);
    lines.push(`${p}\t)`);
  }

  const colorAttr = primitive.getAttribute('COLOR_0');
  if (colorAttr && colorAttr.getCount() === vertexCount) {
    const itemSize = colorAttr.getElementSize();
    const tmpCol = new Array(itemSize).fill(1);
    const colParts = new Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      colorAttr.getElement(i, tmpCol);
      colParts[i] = `(${fmtFloat(tmpCol[0])}, ${fmtFloat(tmpCol[1])}, ${fmtFloat(tmpCol[2])})`;
    }
    lines.push(`${p}\tcolor3f[] primvars:displayColor = [${colParts.join(', ')}] (`);
    lines.push(`${p}\t\tinterpolation = "vertex"`);
    lines.push(`${p}\t)`);
  }

  lines.push(`${p}\tuniform token subdivisionScheme = "none"`);
  if (materialPath) {
    lines.push(`${p}\trel material:binding = <${materialPath}>`);
  }
  lines.push(`${p}}`);
  return lines.join('\n');
}

/**
 * Empaqueta archivos en formato USDZ sin compresión y con alineación exacta de 64 bytes
 * requerida por Apple AR Quick Look (mmap en iOS/macOS).
 */
export function buildAlignedUsdzZip(rawFiles) {
  const orderedEntries = [];
  if (rawFiles['model.usda']) {
    orderedEntries.push(['model.usda', rawFiles['model.usda']]);
  }
  for (const [name, data] of Object.entries(rawFiles)) {
    if (name !== 'model.usda') {
      orderedEntries.push([name, data]);
    }
  }

  const zipInput = {};
  let offset = 0;
  for (const [filename, data] of orderedEntries) {
    const nameByteLen = Buffer.byteLength(filename, 'utf8');
    const baseDataOffset = offset + 30 + nameByteLen;
    let entrySize = 30 + nameByteLen + data.length;

    if ((baseDataOffset & 63) !== 0) {
      const padLen = (64 - ((baseDataOffset + 4) & 63)) & 63;
      const padding = new Uint8Array(padLen);
      zipInput[filename] = [data, { extra: { 12345: padding } }];
      entrySize += 4 + padLen;
    } else {
      zipInput[filename] = data;
    }
    offset += entrySize;
  }

  return Buffer.from(zipSync(zipInput, { level: 0, mtime: new Date() }));
}

/**
 * Convierte un archivo GLB en USDZ compatible con Apple AR Quick Look (iOS/iPadOS),
 * normalizando escala a maqueta (~0.9m), conservando texturas (incluyendo QR) y colores PBR.
 */
export async function convertGlbToUsdz(glbBuffer, options = {}) {
  const hideTotem = Boolean(options.hideTotem);
  const qrPngBuffer = options.qrPngBuffer ? Buffer.from(options.qrPngBuffer) : null;
  const rawBuf = Buffer.isBuffer(glbBuffer) ? glbBuffer : Buffer.from(glbBuffer);
  const sha = crypto.createHash('sha1').update(rawBuf).digest('hex');
  const qrSha = (!hideTotem && qrPngBuffer) ? crypto.createHash('sha1').update(qrPngBuffer).digest('hex').slice(0, 10) : 'none';
  const cacheKey = `usdz:${sha}:${hideTotem ? '1' : '0'}:${qrSha}`;
  const cached = getCachedArAsset(cacheKey);
  if (cached) return cached;

  const io = createNodeIO();
  const doc = await io.readBinary(new Uint8Array(rawBuf));
  if (hideTotem) {
    detachTotemNodes(doc);
  } else if (qrPngBuffer) {
    applyLatestQrTexture(doc, qrPngBuffer);
  }

  const bounds = computeSceneBounds(doc);
  const { scale, translation } = computeArNormalizationTransform(bounds, options);

  const root = doc.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];

  const textureFileBySource = new Map();
  const files = { 'model.usda': new Uint8Array(0) };
  let texCounter = 0;

  async function ensureTextureFile(glTFTexture) {
    if (!glTFTexture) return null;
    if (textureFileBySource.has(glTFTexture)) {
      return textureFileBySource.get(glTFTexture);
    }
    const rawImg = glTFTexture.getImage();
    if (!rawImg || rawImg.length === 0) return null;

    const texFilename = `textures/Texture_${texCounter++}.png`;
    try {
      const pngBuffer = await sharp(Buffer.from(rawImg))
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 6 })
        .toBuffer();
      files[texFilename] = new Uint8Array(pngBuffer);
      textureFileBySource.set(glTFTexture, texFilename);
      return texFilename;
    } catch {
      return null;
    }
  }

  const materialVariants = new Map();
  let matCounter = 0;

  async function registerMaterialVariant(mat, hasVertexColor) {
    const matKey = mat ? `${root.listMaterials().indexOf(mat)}:${hasVertexColor ? 'vc' : 'flat'}` : `default:${hasVertexColor ? 'vc' : 'flat'}`;
    if (materialVariants.has(matKey)) {
      return materialVariants.get(matKey);
    }

    const usdMatName = `Material_${matCounter++}`;
    const usdMatPath = `/Materials/${usdMatName}`;
    const baseColor = mat ? mat.getBaseColorFactor() : [0.8, 0.8, 0.8, 1.0];
    const metallic = mat ? mat.getMetallicFactor() : 0.0;
    const roughness = mat ? mat.getRoughnessFactor() : 0.6;
    const emissive = mat ? mat.getEmissiveFactor() : [0, 0, 0];
    const alphaMode = mat ? mat.getAlphaMode() : 'OPAQUE';
    const alphaCutoff = mat ? mat.getAlphaCutoff() : 0.5;
    const baseTex = mat ? mat.getBaseColorTexture() : null;
    const texFile = baseTex ? await ensureTextureFile(baseTex) : null;

    const lines = [];
    lines.push(`\tdef Material "${usdMatName}"`);
    lines.push('\t{');
    lines.push(`\t\ttoken outputs:surface.connect = <${usdMatPath}/PreviewSurface.outputs:surface>`);
    lines.push('');
    lines.push('\t\tdef Shader "PreviewSurface"');
    lines.push('\t\t{');
    lines.push('\t\t\tuniform token info:id = "UsdPreviewSurface"');

    if (texFile) {
      lines.push(`\t\t\tcolor3f inputs:diffuseColor.connect = <${usdMatPath}/Texture_diffuse.outputs:rgb>`);
      if (alphaMode === 'BLEND') {
        lines.push(`\t\t\tfloat inputs:opacity.connect = <${usdMatPath}/Texture_diffuse.outputs:a>`);
      } else if (alphaMode === 'MASK') {
        lines.push(`\t\t\tfloat inputs:opacity.connect = <${usdMatPath}/Texture_diffuse.outputs:a>`);
        lines.push(`\t\t\tfloat inputs:opacityThreshold = ${fmtFloat(alphaCutoff)}`);
      }
    } else if (hasVertexColor) {
      lines.push(`\t\t\tcolor3f inputs:diffuseColor.connect = <${usdMatPath}/PrimvarReader_color.outputs:result>`);
      if (alphaMode === 'BLEND' || baseColor[3] < 0.99) {
        lines.push(`\t\t\tfloat inputs:opacity = ${fmtFloat(baseColor[3])}`);
      }
    } else {
      lines.push(`\t\t\tcolor3f inputs:diffuseColor = (${fmtFloat(baseColor[0])}, ${fmtFloat(baseColor[1])}, ${fmtFloat(baseColor[2])})`);
      if (alphaMode === 'BLEND' || baseColor[3] < 0.99) {
        lines.push(`\t\t\tfloat inputs:opacity = ${fmtFloat(baseColor[3])}`);
      }
    }

    lines.push(`\t\t\tfloat inputs:metallic = ${fmtFloat(metallic)}`);
    lines.push(`\t\t\tfloat inputs:roughness = ${fmtFloat(roughness)}`);
    if (emissive[0] > 0.001 || emissive[1] > 0.001 || emissive[2] > 0.001) {
      lines.push(`\t\t\tcolor3f inputs:emissiveColor = (${fmtFloat(emissive[0])}, ${fmtFloat(emissive[1])}, ${fmtFloat(emissive[2])})`);
    }
    lines.push('\t\t\tint inputs:useSpecularWorkflow = 0');
    lines.push('\t\t\ttoken outputs:surface');
    lines.push('\t\t}');

    if (texFile) {
      lines.push('');
      lines.push('\t\tdef Shader "PrimvarReader_st"');
      lines.push('\t\t{');
      lines.push('\t\t\tuniform token info:id = "UsdPrimvarReader_float2"');
      lines.push('\t\t\tfloat2 inputs:fallback = (0, 0)');
      lines.push('\t\t\tstring inputs:varname = "st"');
      lines.push('\t\t\tfloat2 outputs:result');
      lines.push('\t\t}');
      lines.push('');
      lines.push('\t\tdef Shader "Texture_diffuse"');
      lines.push('\t\t{');
      lines.push('\t\t\tuniform token info:id = "UsdUVTexture"');
      lines.push(`\t\t\tasset inputs:file = @${texFile}@`);
      lines.push(`\t\t\tfloat4 inputs:scale = (${fmtFloat(baseColor[0])}, ${fmtFloat(baseColor[1])}, ${fmtFloat(baseColor[2])}, ${fmtFloat(baseColor[3])})`);
      lines.push('\t\t\ttoken inputs:sourceColorSpace = "sRGB"');
      lines.push(`\t\t\tfloat2 inputs:st.connect = <${usdMatPath}/PrimvarReader_st.outputs:result>`);
      lines.push('\t\t\ttoken inputs:wrapS = "repeat"');
      lines.push('\t\t\ttoken inputs:wrapT = "repeat"');
      lines.push('\t\t\tfloat outputs:a');
      lines.push('\t\t\tfloat3 outputs:rgb');
      lines.push('\t\t}');
    } else if (hasVertexColor) {
      lines.push('');
      lines.push('\t\tdef Shader "PrimvarReader_color"');
      lines.push('\t\t{');
      lines.push('\t\t\tuniform token info:id = "UsdPrimvarReader_float3"');
      lines.push('\t\t\tfloat3 inputs:fallback = (1, 1, 1)');
      lines.push('\t\t\tstring inputs:varname = "displayColor"');
      lines.push('\t\t\tfloat3 outputs:result');
      lines.push('\t\t}');
    }

    lines.push('\t}');

    const entry = { path: usdMatPath, usdaBlock: lines.join('\n') };
    materialVariants.set(matKey, entry);
    return entry;
  }

  const sceneBodyBlocks = [];

  async function traverseGltfNode(glTFNode, indent, siblingNames) {
    const nodeName = makeUniqueUsdName(glTFNode.getName(), siblingNames, 'Node');
    const p = '\t'.repeat(indent);
    const localMat = glTFNode.getMatrix();
    const children = glTFNode.listChildren();
    const mesh = glTFNode.getMesh();

    const innerBlocks = [];
    innerBlocks.push(`${p}\tmatrix4d xformOp:transform = ${buildMatrix4dLiteral(localMat)}`);
    innerBlocks.push(`${p}\tuniform token[] xformOpOrder = ["xformOp:transform"]`);

    const childNames = new Set();
    if (mesh) {
      const prims = mesh.listPrimitives();
      for (let pi = 0; pi < prims.length; pi++) {
        const prim = prims[pi];
        if (prim.getMode() !== 4) continue;
        const hasVertexColor = Boolean(prim.getAttribute('COLOR_0'));
        const matInfo = await registerMaterialVariant(prim.getMaterial(), hasVertexColor);
        const primName = makeUniqueUsdName(`Prim_${pi}`, childNames, 'Mesh');
        const meshBlock = buildUsdMeshBlock({
          name: primName,
          indent: indent + 1,
          primitive: prim,
          materialPath: matInfo.path
        });
        if (meshBlock) {
          innerBlocks.push('');
          innerBlocks.push(meshBlock);
        }
      }
    }

    for (const child of children) {
      const childBlock = await traverseGltfNode(child, indent + 1, childNames);
      if (childBlock) {
        innerBlocks.push('');
        innerBlocks.push(childBlock);
      }
    }

    return `${p}def Xform "${nodeName}"\n${p}{\n${innerBlocks.join('\n')}\n${p}}`;
  }

  if (scene) {
    const topNames = new Set();
    for (const child of scene.listChildren()) {
      const block = await traverseGltfNode(child, 4, topNames);
      if (block) sceneBodyBlocks.push(block);
    }
  }

  const materialBlocks = Array.from(materialVariants.values()).map((m) => m.usdaBlock);

  const usda = [
    '#usda 1.0',
    '(',
    '\tcustomLayerData = {',
    '\t\tstring creator = "API-3DQR USDZ Converter"',
    '\t}',
    '\tdefaultPrim = "Root"',
    '\tmetersPerUnit = 1',
    '\tupAxis = "Y"',
    ')',
    '',
    'def Xform "Root"',
    '{',
    '\tdef Scope "Scenes" (',
    '\t\tkind = "sceneLibrary"',
    '\t)',
    '\t{',
    '\t\tdef Xform "Scene" (',
    '\t\t\tcustomData = {',
    '\t\t\t\tbool preliminary_collidesWithEnvironment = 0',
    '\t\t\t\tstring sceneName = "Scene"',
    '\t\t\t}',
    '\t\t\tsceneName = "Scene"',
    '\t\t)',
    '\t\t{',
    '\t\t\ttoken preliminary:anchoring:type = "plane"',
    '\t\t\ttoken preliminary:planeAnchoring:alignment = "horizontal"',
    '',
    '\t\t\tdef Xform "ModelRoot"',
    '\t\t\t{',
    `\t\t\t\tfloat3 xformOp:translate = (${fmtFloat(translation[0])}, ${fmtFloat(translation[1])}, ${fmtFloat(translation[2])})`,
    `\t\t\t\tfloat3 xformOp:scale = (${fmtFloat(scale)}, ${fmtFloat(scale)}, ${fmtFloat(scale)})`,
    '\t\t\t\tuniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]',
    '',
    sceneBodyBlocks.join('\n\n'),
    '\t\t\t}',
    '\t\t}',
    '\t}',
    '}',
    '',
    'def "Materials"',
    '{',
    materialBlocks.join('\n\n'),
    '}',
    ''
  ].join('\n');

  files['model.usda'] = strToU8(usda);
  const usdzBuf = buildAlignedUsdzZip(files);
  setCachedArAsset(cacheKey, usdzBuf);
  return usdzBuf;
}

/**
 * Resuelve la configuración efectiva de un QR y construye la versión AR (GLB normalizado o USDZ).
 */
export async function buildArModelForItem(item, { format = 'glb', query = {}, baseUrl } = {}) {
  const meta = parseMetadata(item.metadata);
  const viewerCfg = resolveEffectiveViewerConfig(
    meta.viewerConfig,
    item.tenant_default_viewer_config,
    meta.hasCustomViewerConfig
  );
  let hideTotem = viewerCfg.showTotem === false;
  const totemParam = query?.totem;
  if (totemParam !== undefined && totemParam !== null && totemParam !== '') {
    const norm = String(totemParam).trim().toLowerCase();
    if (norm === '0' || norm === 'false' || norm === 'no' || norm === 'off') hideTotem = true;
    else if (norm === '1' || norm === 'true' || norm === 'yes' || norm === 'on') hideTotem = false;
  }
  const qrPngBuffer = !hideTotem ? await ensureQrPngForBaseUrl(item, baseUrl) : null;
  if (format === 'usdz') {
    return await convertGlbToUsdz(item.model_blob, { hideTotem, qrPngBuffer });
  }
  return await normalizeGlbForAr(item.model_blob, { hideTotem, qrPngBuffer });
}
