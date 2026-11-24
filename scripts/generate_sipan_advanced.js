/**
 * Generador Avanzado 3D del Museo Tumbas Reales de Sipán
 * Arquitectura de alta fidelidad, texturas PBR procedurales con Canvas y mapas de relieve
 * Ejecutado en Puppeteer con Three.js y GLTFExporter
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export async function generateAdvancedModel() {
  console.log('🚀 Iniciando pipeline de reconstrucción 3D avanzada del Museo Tumbas Reales de Sipán...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Exponer console.log desde la página hacia Node
  page.on('console', (msg) => console.log('  [Browser]', msg.text()));

  const glbBase64 = await page.evaluate(async () => {
    // 1. Cargar Three.js y GLTFExporter
    await new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });

    await new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });

    console.log('Three.js y GLTFExporter cargados correctamente en el entorno de render');

    // =========================================================================
    // 2. GENERADOR DE TEXTURAS PROCEDURALES CANVAS (PBR)
    // =========================================================================
    function createNoiseData(ctx, width, height, opacity = 0.08) {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 255 * opacity;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // A. Textura de Terracota / Adobe Mochica
    const canvasTerracotta = document.createElement('canvas');
    canvasTerracotta.width = 512;
    canvasTerracotta.height = 512;
    const ctxT = canvasTerracotta.getContext('2d');
    const gradT = ctxT.createLinearGradient(0, 0, 512, 512);
    gradT.addColorStop(0, '#982f1f');
    gradT.addColorStop(0.5, '#912a1c');
    gradT.addColorStop(1, '#872417');
    ctxT.fillStyle = gradT;
    ctxT.fillRect(0, 0, 512, 512);
    createNoiseData(ctxT, 512, 512, 0.12);

    const texTerracotta = new THREE.CanvasTexture(canvasTerracotta);
    texTerracotta.wrapS = THREE.RepeatWrapping;
    texTerracotta.wrapT = THREE.RepeatWrapping;
    texTerracotta.repeat.set(4, 4);

    // B. Textura de Travertino / Piedra de la Plaza
    const canvasPlaza = document.createElement('canvas');
    canvasPlaza.width = 512;
    canvasPlaza.height = 512;
    const ctxP = canvasPlaza.getContext('2d');
    ctxP.fillStyle = '#d5cab9';
    ctxP.fillRect(0, 0, 512, 512);
    // Cuadrícula de juntas de losas
    ctxP.strokeStyle = '#baa892';
    ctxP.lineWidth = 4;
    for (let x = 0; x <= 512; x += 128) {
      ctxP.beginPath(); ctxP.moveTo(x, 0); ctxP.lineTo(x, 512); ctxP.stroke();
    }
    for (let y = 0; y <= 512; y += 128) {
      ctxP.beginPath(); ctxP.moveTo(0, y); ctxP.lineTo(512, y); ctxP.stroke();
    }
    createNoiseData(ctxP, 512, 512, 0.08);

    const texPlaza = new THREE.CanvasTexture(canvasPlaza);
    texPlaza.wrapS = THREE.RepeatWrapping;
    texPlaza.wrapT = THREE.RepeatWrapping;
    texPlaza.repeat.set(6, 4);

    // C. Textura de Celosía Romboidal de Vidrio Azul
    const canvasLattice = document.createElement('canvas');
    canvasLattice.width = 256;
    canvasLattice.height = 256;
    const ctxL = canvasLattice.getContext('2d');
    // Fondo azul cobalto translúcido
    ctxL.fillStyle = 'rgba(14, 76, 138, 0.85)';
    ctxL.fillRect(0, 0, 256, 256);
    // Estructura de rombos oscuros
    ctxL.strokeStyle = '#121d28';
    ctxL.lineWidth = 8;
    for (let i = -256; i <= 512; i += 64) {
      ctxL.beginPath(); ctxL.moveTo(i, 0); ctxL.lineTo(i + 256, 256); ctxL.stroke();
      ctxL.beginPath(); ctxL.moveTo(i, 256); ctxL.lineTo(i + 256, 0); ctxL.stroke();
    }
    const texLattice = new THREE.CanvasTexture(canvasLattice);
    texLattice.wrapS = THREE.RepeatWrapping;
    texLattice.wrapT = THREE.RepeatWrapping;
    texLattice.repeat.set(2, 2);

    // D. Texturas para los 5 Frisos Iconográficos Moches
    function createFriezeTexture(iconType) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 384;
      const ctx = c.getContext('2d');

      // Fondo oro martillado
      const gradGold = ctx.createRadialGradient(256, 192, 40, 256, 192, 280);
      gradGold.addColorStop(0, '#f2ca62');
      gradGold.addColorStop(0.6, '#ddb446');
      gradGold.addColorStop(1, '#b88c28');
      ctx.fillStyle = gradGold;
      ctx.fillRect(0, 0, 512, 384);

      // Marco perimetral con grecas mochicas
      ctx.strokeStyle = '#8e6b18';
      ctx.lineWidth = 14;
      ctx.strokeRect(16, 16, 480, 352);

      ctx.fillStyle = '#6e510f';

      if (iconType === 0) {
        // Naylamp / Señor de Sipán: Gran tocado semilunar ceremonial y cetro
        // Tocado semilunar
        ctx.beginPath();
        ctx.arc(256, 150, 110, Math.PI, 0, false);
        ctx.lineWidth = 26;
        ctx.strokeStyle = '#7c5b12';
        ctx.stroke();

        // Rostro y orejeras circulares
        ctx.beginPath();
        ctx.arc(256, 175, 42, 0, Math.PI * 2);
        ctx.fill();

        // Orejera izquierda y derecha
        ctx.beginPath(); ctx.arc(180, 185, 24, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(332, 185, 24, 0, Math.PI * 2); ctx.fill();

        // Pectoral y faldellín
        ctx.fillRect(206, 225, 100, 95);

        // Brazos ceremoniales alzados
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(206, 240); ctx.lineTo(150, 210); ctx.lineTo(140, 160);
        ctx.moveTo(306, 240); ctx.lineTo(362, 210); ctx.lineTo(372, 160);
        ctx.stroke();

      } else if (iconType === 1) {
        // El Gran Medallón Solar de Ai Apaec
        ctx.beginPath();
        ctx.arc(256, 192, 115, 0, Math.PI * 2);
        ctx.lineWidth = 22;
        ctx.strokeStyle = '#7c5b12';
        ctx.stroke();

        // Rayos solares serpentiformes
        for (let a = 0; a < 12; a++) {
          const ang = (a * Math.PI) / 6;
          const rx1 = 256 + Math.cos(ang) * 115;
          const ry1 = 192 + Math.sin(ang) * 115;
          const rx2 = 256 + Math.cos(ang) * 155;
          const ry2 = 192 + Math.sin(ang) * 155;
          ctx.beginPath();
          ctx.moveTo(rx1, ry1);
          ctx.lineTo(rx2, ry2);
          ctx.lineWidth = 12;
          ctx.stroke();
        }

        // Rostro del dios felínico
        ctx.beginPath();
        ctx.arc(256, 192, 55, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Cuatro sacerdotes y deidades acompañantes
        for (let qx = 0; qx < 2; qx++) {
          for (let qy = 0; qy < 2; qy++) {
            const cx = 160 + qx * 192;
            const cy = 120 + qy * 144;

            // Mini figura moche
            ctx.beginPath();
            ctx.arc(cx, cy - 25, 30, Math.PI, 0, false);
            ctx.lineWidth = 10;
            ctx.strokeStyle = '#7c5b12';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy, 18, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillRect(cx - 20, cy + 20, 40, 45);
          }
        }
      }

      createNoiseData(ctx, 512, 384, 0.08);
      return new THREE.CanvasTexture(c);
    }

    const texFrieze0 = createFriezeTexture(0);
    const texFrieze1 = createFriezeTexture(1);
    const texFrieze2 = createFriezeTexture(2);

    // E. Textura del Gran Emblema Circular del Señor de Sipán
    const canvasEmblem = document.createElement('canvas');
    canvasEmblem.width = 512;
    canvasEmblem.height = 512;
    const ctxE = canvasEmblem.getContext('2d');

    const gradE = ctxE.createRadialGradient(256, 256, 40, 256, 256, 250);
    gradE.addColorStop(0, '#f9dc7a');
    gradE.addColorStop(0.5, '#ddb446');
    gradE.addColorStop(1, '#9e7314');
    ctxE.fillStyle = gradE;
    ctxE.fillRect(0, 0, 512, 512);

    // Círculos concéntricos de oro y turquesa
    ctxE.strokeStyle = '#1b747d'; // Color turquesa precolombino
    ctxE.lineWidth = 20;
    ctxE.beginPath(); ctxE.arc(256, 256, 220, 0, Math.PI * 2); ctxE.stroke();

    ctxE.strokeStyle = '#7c5b12';
    ctxE.lineWidth = 14;
    ctxE.beginPath(); ctxE.arc(256, 256, 185, 0, Math.PI * 2); ctxE.stroke();

    // Figura central del guerrero mochica
    ctxE.fillStyle = '#634407';
    // Tocado semilunar con corona
    ctxE.beginPath();
    ctxE.arc(256, 200, 85, Math.PI, 0, false);
    ctxE.lineWidth = 18;
    ctxE.stroke();

    ctxE.beginPath(); ctxE.arc(256, 220, 36, 0, Math.PI * 2); ctxE.fill();
    ctxE.fillRect(216, 260, 80, 85);
    // Cetro de mando y escudo
    ctxE.fillRect(170, 210, 16, 140);
    ctxE.beginPath(); ctxE.arc(330, 280, 30, 0, Math.PI * 2); ctxE.fill();

    createNoiseData(ctxE, 512, 512, 0.08);
    const texEmblem = new THREE.CanvasTexture(canvasEmblem);

    // =========================================================================
    // 3. MATERIALES PBR PROFESIONALES
    // =========================================================================
    const matTerracotta = new THREE.MeshStandardMaterial({
      color: 0x942d1f,
      map: texTerracotta,
      roughness: 0.82,
      metalness: 0.04,
      name: 'Mochica_Terracotta_PBR'
    });

    const matTerracottaDark = new THREE.MeshStandardMaterial({
      color: 0x6e1d12,
      roughness: 0.88,
      metalness: 0.04,
      name: 'Mochica_Terracotta_Dark'
    });

    const matYellowAccent = new THREE.MeshStandardMaterial({
      color: 0xdfa634,
      roughness: 0.42,
      metalness: 0.30,
      name: 'Moche_Yellow_Accent'
    });

    const matGoldBase = new THREE.MeshStandardMaterial({
      color: 0xddb446,
      roughness: 0.24,
      metalness: 0.90,
      name: 'Moche_Gold_Base'
    });

    const matBlueGlass = new THREE.MeshStandardMaterial({
      color: 0x0e5395,
      map: texLattice,
      roughness: 0.10,
      metalness: 0.25,
      opacity: 0.85,
      transparent: true,
      name: 'Blue_Tinted_Glass'
    });

    const matGlassFrame = new THREE.MeshStandardMaterial({
      color: 0x14202c,
      roughness: 0.40,
      metalness: 0.75,
      name: 'Glass_Frame_Dark'
    });

    const matTravertine = new THREE.MeshStandardMaterial({
      color: 0xd5cab9,
      map: texPlaza,
      roughness: 0.88,
      metalness: 0.02,
      name: 'Plaza_Travertine_PBR'
    });

    const matTravertinePaving = new THREE.MeshStandardMaterial({
      color: 0xbfb39e,
      roughness: 0.90,
      metalness: 0.02,
      name: 'Plaza_Paving_Accent'
    });

    const matGrass = new THREE.MeshStandardMaterial({
      color: 0x517237,
      roughness: 0.95,
      metalness: 0.0,
      name: 'Surrounding_Grass'
    });

    const matRampDeck = new THREE.MeshStandardMaterial({
      color: 0xdcd3c3,
      roughness: 0.86,
      metalness: 0.02,
      name: 'Ramp_Walkway_Deck'
    });

    const matMetalRail = new THREE.MeshStandardMaterial({
      color: 0xdcdcdc,
      roughness: 0.18,
      metalness: 0.94,
      name: 'Handrail_Metal'
    });

    // =========================================================================
    // 4. CONSTRUCCIÓN GEOMÉTRICA DE ALTA PRECISIÓN
    // =========================================================================
    const rootGroup = new THREE.Group();
    rootGroup.name = 'Museo_Tumbas_Reales_Sipan';

    // A. Base y Plataforma de Travertino
    const baseGroup = new THREE.Group();
    baseGroup.name = 'Base_Plaza';

    const grassGeo = new THREE.BoxGeometry(110, 0.2, 95);
    const grassMesh = new THREE.Mesh(grassGeo, matGrass);
    grassMesh.position.set(0, -0.1, 0);
    baseGroup.add(grassMesh);

    const plazaGeo = new THREE.BoxGeometry(92, 0.35, 68);
    const plazaMesh = new THREE.Mesh(plazaGeo, matTravertine);
    plazaMesh.position.set(2, 0.175, 4);
    baseGroup.add(plazaMesh);

    // Patio ceremonial rehundido
    const sunkenPlazaGeo = new THREE.BoxGeometry(36, 0.06, 28);
    const sunkenPlazaMesh = new THREE.Mesh(sunkenPlazaGeo, matTravertinePaving);
    sunkenPlazaMesh.position.set(16, 0.38, 17);
    baseGroup.add(sunkenPlazaMesh);

    // Bordillos amarillos
    const curbGeo1 = new THREE.BoxGeometry(36.4, 0.16, 0.35);
    const curb1 = new THREE.Mesh(curbGeo1, matYellowAccent);
    curb1.position.set(16, 0.42, 3);
    baseGroup.add(curb1);

    const curbGeoSide = new THREE.BoxGeometry(0.35, 0.16, 28.4);
    const curb2 = new THREE.Mesh(curbGeoSide, matYellowAccent);
    curb2.position.set(-2.2, 0.42, 17);
    baseGroup.add(curb2);

    const curb3 = new THREE.Mesh(curbGeoSide, matYellowAccent);
    curb3.position.set(34.2, 0.42, 17);
    baseGroup.add(curb3);

    // Cuadrícula y bancas
    for (let i = -2; i <= 2; i++) {
      const lineXGeo = new THREE.BoxGeometry(35.8, 0.02, 0.16);
      const lineX = new THREE.Mesh(lineXGeo, matYellowAccent);
      lineX.position.set(16, 0.43, 17 + i * 5.5);
      baseGroup.add(lineX);

      const lineZGeo = new THREE.BoxGeometry(0.16, 0.02, 27.8);
      const lineZ = new THREE.Mesh(lineZGeo, matYellowAccent);
      lineZ.position.set(16 + i * 7.0, 0.43, 17);
      baseGroup.add(lineZ);

      const benchGeo = new THREE.BoxGeometry(1.2, 0.35, 1.2);
      const bench = new THREE.Mesh(benchGeo, matYellowAccent);
      bench.position.set(16 + i * 7.0, 0.58, 30.5);
      baseGroup.add(bench);
    }
    rootGroup.add(baseGroup);

    // B. Volúmenes Piramidales Monolíticos (Talud de 54°)
    const buildingGroup = new THREE.Group();
    buildingGroup.name = 'Edificio_Principal';

    function createTrapezoidalPrism({
      name,
      xMin,
      xMax,
      yBase = 0.35,
      height,
      zFrontBase,
      zFrontTop,
      zBackBase,
      zBackTop,
      material = matTerracotta
    }) {
      const yTop = yBase + height;

      const vertices = new Float32Array([
        // Front
        xMin, yBase, zFrontBase,
        xMax, yBase, zFrontBase,
        xMax, yTop,  zFrontTop,
        xMin, yTop,  zFrontTop,
        // Back
        xMin, yBase, zBackBase,
        xMax, yBase, zBackBase,
        xMax, yTop,  zBackTop,
        xMin, yTop,  zBackTop
      ]);

      const indices = [
        0, 1, 2,   0, 2, 3,
        3, 2, 6,   3, 6, 7,
        5, 4, 7,   5, 7, 6,
        4, 0, 3,   4, 3, 7,
        1, 5, 6,   1, 6, 2,
        4, 5, 1,   4, 1, 0
      ];

      // Coordenadas UV calculadas analíticamente para mapeo de texturas
      const uvs = new Float32Array([
        0, 0,   1, 0,   1, 1,   0, 1,
        0, 0,   1, 0,   1, 1,   0, 1
      ]);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, material);
      mesh.name = name;

      const width = xMax - xMin;
      const zSetback = zFrontBase - zFrontTop;
      const slopeLen = Math.sqrt(height * height + zSetback * zSetback);
      const slopeAngle = Math.atan2(zSetback, height);

      return { mesh, xMin, xMax, width, yBase, yTop, height, zFrontBase, zFrontTop, zSetback, slopeLen, slopeAngle };
    }

    // Ala Izquierda
    const leftBlock = createTrapezoidalPrism({
      name: 'Ala_Izquierda_Talud',
      xMin: -28.0,
      xMax: -13.2,
      yBase: 0.35,
      height: 11.8,
      zFrontBase: 7.0,
      zFrontTop: -1.6,
      zBackBase: -17.0,
      zBackTop: -17.0
    });
    buildingGroup.add(leftBlock.mesh);

    // Cuerpo Central
    const centralBlock = createTrapezoidalPrism({
      name: 'Cuerpo_Central_Talud',
      xMin: -13.2,
      xMax: 4.2,
      yBase: 0.35,
      height: 15.2,
      zFrontBase: 9.0,
      zFrontTop: -2.0,
      zBackBase: -20.0,
      zBackTop: -20.0
    });
    buildingGroup.add(centralBlock.mesh);

    // Canal de quiebre de sombra
    const transitionBlock = createTrapezoidalPrism({
      name: 'Quiebre_Transicion',
      xMin: -13.2,
      xMax: -12.4,
      yBase: 0.35,
      height: 15.2,
      zFrontBase: 9.0,
      zFrontTop: -2.0,
      zBackBase: -20.0,
      zBackTop: -20.0,
      material: matTerracottaDark
    });
    buildingGroup.add(transitionBlock.mesh);

    // C. Franjas Amarillas Adheridas al Talud
    function createSlopingStripes({ block, numStripes = 2, stripeW = 0.28 }) {
      const group = new THREE.Group();
      const spacing = block.width / (numStripes + 1);

      for (let i = 1; i <= numStripes; i++) {
        const x = block.xMin + i * spacing;
        const geo = new THREE.BoxGeometry(stripeW, block.slopeLen, 0.08);
        const mesh = new THREE.Mesh(geo, matYellowAccent);

        const midY = block.yBase + block.height / 2;
        const midZ = (block.zFrontBase + block.zFrontTop) / 2 + 0.05;

        mesh.position.set(x, midY, midZ);
        mesh.rotation.x = -block.slopeAngle;
        group.add(mesh);
      }
      return group;
    }

    buildingGroup.add(createSlopingStripes({ block: leftBlock, numStripes: 2 }));
    buildingGroup.add(createSlopingStripes({ block: centralBlock, numStripes: 3 }));

    // D. Las 5 Cajas de Frisos Superiores con Iconografía Texturizada y Relieve 3D
    const friezesGroup = new THREE.Group();
    friezesGroup.name = 'Frisos_Superiores_Oro';

    function createFriezeBox({ x, yBase, zFrontCrest, width = 4.2, height = 2.8, depth = 1.8, textureMap, iconType = 0 }) {
      const boxGroup = new THREE.Group();
      const centerZ = zFrontCrest + 0.35 - depth / 2;
      const centerY = yBase + height / 2;

      // Caja perimetral de terracota
      const boxGeo = new THREE.BoxGeometry(width, height, depth);
      const boxMesh = new THREE.Mesh(boxGeo, matTerracotta);
      boxGroup.add(boxMesh);

      // Moldura superior biselada dorada
      const topTrimGeo = new THREE.BoxGeometry(width + 0.15, 0.22, depth + 0.15);
      const topTrim = new THREE.Mesh(topTrimGeo, matYellowAccent);
      topTrim.position.set(0, height / 2 + 0.11, 0);
      boxGroup.add(topTrim);

      // Marco rehundido interior
      const frameInnerGeo = new THREE.BoxGeometry(width - 0.45, height - 0.45, 0.15);
      const frameInner = new THREE.Mesh(frameInnerGeo, matTerracottaDark);
      frameInner.position.set(0, 0, depth / 2 + 0.05);
      boxGroup.add(frameInner);

      // Placa de oro con la iconografía moche texturizada
      const matPlaque = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textureMap,
        roughness: 0.26,
        metalness: 0.88
      });
      const plateGeo = new THREE.BoxGeometry(width - 0.75, height - 0.75, 0.10);
      const plate = new THREE.Mesh(plateGeo, matPlaque);
      plate.position.set(0, 0, depth / 2 + 0.12);
      boxGroup.add(plate);

      // Relieve volumétrico adicional 3D sobre la placa
      const rZ = depth / 2 + 0.22;
      if (iconType === 0) {
        const crownMesh = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.14, 8, 20, Math.PI), matGoldBase);
        crownMesh.position.set(0, 0.42, rZ);
        boxGroup.add(crownMesh);

        const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 16), matGoldBase);
        headMesh.rotateX(Math.PI / 2);
        headMesh.position.set(0, 0.28, rZ);
        boxGroup.add(headMesh);
      } else if (iconType === 1) {
        const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.14, 10, 28), matGoldBase);
        ringMesh.position.set(0, 0, rZ);
        boxGroup.add(ringMesh);

        const centerFace = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.16, 16), matGoldBase);
        centerFace.rotateX(Math.PI / 2);
        centerFace.position.set(0, 0, rZ + 0.02);
        boxGroup.add(centerFace);
      }

      boxGroup.position.set(x, centerY, centerZ);
      return boxGroup;
    }

    // 2 Frisos Ala Izquierda
    friezesGroup.add(createFriezeBox({ x: -23.0, yBase: leftBlock.yTop, zFrontCrest: leftBlock.zFrontTop, textureMap: texFrieze0, iconType: 0 }));
    friezesGroup.add(createFriezeBox({ x: -16.8, yBase: leftBlock.yTop, zFrontCrest: leftBlock.zFrontTop, textureMap: texFrieze2, iconType: 2 }));

    // 3 Frisos Cuerpo Central
    friezesGroup.add(createFriezeBox({ x: -9.8, yBase: centralBlock.yTop, zFrontCrest: centralBlock.zFrontTop, textureMap: texFrieze2, iconType: 2 }));
    friezesGroup.add(createFriezeBox({ x: -4.5, yBase: centralBlock.yTop, zFrontCrest: centralBlock.zFrontTop, textureMap: texFrieze1, iconType: 1 })); // Medallón Solar
    friezesGroup.add(createFriezeBox({ x: 0.8, yBase: centralBlock.yTop, zFrontCrest: centralBlock.zFrontTop, textureMap: texFrieze0, iconType: 0 }));

    buildingGroup.add(friezesGroup);

    // E. Pabellón de Entrada Triangular con Gran Emblema del Señor de Sipán
    const entranceGroup = new THREE.Group();
    entranceGroup.name = 'Pabellon_Entrada_Triangular';

    const entryX = 7.0;
    const entryZ = 7.0;
    const entryY = 0.35;
    const outerW = 7.4;
    const outerH = 6.5;
    const innerW = 5.4;
    const innerH = 4.9;
    const canopyDepth = 5.2;

    const archShape = new THREE.Shape();
    archShape.moveTo(-outerW / 2, 0);
    archShape.lineTo(outerW / 2, 0);
    archShape.lineTo(0, outerH);
    archShape.closePath();

    const holePath = new THREE.Path();
    holePath.moveTo(-innerW / 2, 0);
    holePath.lineTo(innerW / 2, 0);
    holePath.lineTo(0, innerH);
    holePath.closePath();
    archShape.holes.push(holePath);

    const archExtrude = new THREE.ExtrudeGeometry(archShape, { depth: canopyDepth, bevelEnabled: false });
    archExtrude.rotateY(Math.PI);
    const archMesh = new THREE.Mesh(archExtrude, matTerracotta);
    archMesh.position.set(entryX, entryY, entryZ);
    entranceGroup.add(archMesh);

    // Bordes amarillos del triángulo
    const borderGeo = new THREE.BoxGeometry(0.24, 7.4, 0.24);
    const borderL = new THREE.Mesh(borderGeo, matYellowAccent);
    borderL.position.set(entryX - 1.9, entryY + 3.25, entryZ + 0.05);
    borderL.rotation.z = -0.51;
    entranceGroup.add(borderL);

    const borderR = new THREE.Mesh(borderGeo, matYellowAccent);
    borderR.position.set(entryX + 1.9, entryY + 3.25, entryZ + 0.05);
    borderR.rotation.z = 0.51;
    entranceGroup.add(borderR);

    // Vidrio azul con celosía romboidal
    const glassZ = entryZ - 1.4;
    const glassShape = new THREE.Shape();
    glassShape.moveTo(-innerW / 2, 0);
    glassShape.lineTo(innerW / 2, 0);
    glassShape.lineTo(0, innerH);
    glassShape.closePath();

    const glassMesh = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), matBlueGlass);
    glassMesh.position.set(entryX, entryY, glassZ);
    entranceGroup.add(glassMesh);

    // Puerta central
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.12), matGlassFrame);
    doorMesh.position.set(entryX, entryY + 1.2, glassZ + 0.06);
    entranceGroup.add(doorMesh);

    // Pasarela de acceso con barandales
    const walkMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 7.5), matRampDeck);
    walkMesh.position.set(entryX, entryY + 0.10, entryZ + 3.2);
    entranceGroup.add(walkMesh);

    for (let s = -1; s <= 1; s += 2) {
      const rx = entryX + s * 1.15;
      const railTube = new THREE.CylinderGeometry(0.035, 0.035, 7.5, 8);
      railTube.rotateX(Math.PI / 2);
      const rail = new THREE.Mesh(railTube, matMetalRail);
      rail.position.set(rx, entryY + 0.95, entryZ + 3.2);
      entranceGroup.add(rail);

      for (let p = -3; p <= 3; p++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), matMetalRail);
        post.position.set(rx, entryY + 0.52, entryZ + 3.2 + p * 1.15);
        entranceGroup.add(post);
      }
    }

    // Gran Emblema Circular del Señor de Sipán con textura e incrustaciones
    const emblemMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texEmblem,
      roughness: 0.22,
      metalness: 0.90
    });
    const emblemGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.10, 32);
    emblemGeo.rotateX(Math.PI / 2);
    const emblemMesh = new THREE.Mesh(emblemGeo, emblemMat);
    emblemMesh.position.set(entryX - 1.25, entryY + 4.2, entryZ + 0.20);
    entranceGroup.add(emblemMesh);

    // Rótulo: "MUSEO TUMBAS REALES DE SIPAN"
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.32, 0.06), matGoldBase);
    signMesh.position.set(entryX - 1.6, entryY + 5.15, entryZ + 0.15);
    signMesh.rotation.z = 0.42;
    entranceGroup.add(signMesh);

    buildingGroup.add(entranceGroup);

    // F. Lucernario Cenital Piramidal Superior
    const skylightGroup = new THREE.Group();
    const skyMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 4.4, 2.6, 4), matBlueGlass);
    skyMesh.rotateY(Math.PI / 4);
    skyMesh.position.set(7.4, 13.2, -0.6);
    skylightGroup.add(skyMesh);

    const skyEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(skyMesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x14202c, linewidth: 2 })
    );
    skyEdges.position.copy(skyMesh.position);
    skyEdges.rotation.copy(skyMesh.rotation);
    skylightGroup.add(skyEdges);
    buildingGroup.add(skylightGroup);

    // G. Rampa Monumental Ceremonial (Ascenso continuo de ~60 metros de recorrido)
    const rampGroup = new THREE.Group();
    rampGroup.name = 'Rampa_Monumental_Lateral';

    const rStart = { x: 34.0, y: 0.35, z: 8.5 };
    const rEnd = { x: 10.5, y: 10.6, z: 8.5 };
    const rLen = rStart.x - rEnd.x; // 23.5m
    const rRise = rEnd.y - rStart.y; // 10.25m
    const rSlope = Math.atan2(rRise, rLen);
    const rWidth = 3.6;

    // Muro frontal sur de la rampa
    const rampWallShape = new THREE.Shape();
    rampWallShape.moveTo(rStart.x, 0.35);
    rampWallShape.lineTo(rEnd.x, 0.35);
    rampWallShape.lineTo(rEnd.x, rEnd.y + 1.2);
    rampWallShape.lineTo(rStart.x, rStart.y + 1.2);
    rampWallShape.closePath();

    const rampWallGeo = new THREE.ExtrudeGeometry(rampWallShape, { depth: 0.6, bevelEnabled: false });
    const rampWallMesh = new THREE.Mesh(rampWallGeo, matTerracotta);
    rampWallMesh.position.set(0, 0, rStart.z + rWidth / 2);
    rampGroup.add(rampWallMesh);

    // Zócalo macizo bajo la rampa
    const underWallGeo = new THREE.ExtrudeGeometry(rampWallShape, { depth: rWidth, bevelEnabled: false });
    const underWallMesh = new THREE.Mesh(underWallGeo, matTerracotta);
    underWallMesh.position.set(0, 0, rStart.z - rWidth / 2);
    rampGroup.add(underWallMesh);

    // 8 Pilastras amarillas rítmicas escalonadas en la fachada de la rampa
    const numPilasters = 8;
    for (let p = 0; p < numPilasters; p++) {
      const t = (p + 0.5) / numPilasters;
      const px = rStart.x - t * rLen;
      const currentH = rStart.y + t * rRise + 0.95;

      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.28, currentH, 0.12), matYellowAccent);
      pil.position.set(px, currentH / 2 + 0.35, rStart.z + rWidth / 2 + 0.65);
      rampGroup.add(pil);
    }

    // Deck peatonal inclinado
    const deckHypot = Math.sqrt(rLen * rLen + rRise * rRise);
    const rDeck = new THREE.Mesh(new THREE.BoxGeometry(deckHypot, 0.25, rWidth), matRampDeck);
    rDeck.position.set((rStart.x + rEnd.x) / 2, (rStart.y + rEnd.y) / 2 + 0.1, rStart.z);
    rDeck.rotation.z = -rSlope;
    rampGroup.add(rDeck);

    // Parapeto interior y pasamanos metálico
    const innerP = new THREE.Mesh(new THREE.BoxGeometry(deckHypot, 1.1, 0.25), matTerracotta);
    innerP.position.set((rStart.x + rEnd.x) / 2, (rStart.y + rEnd.y) / 2 + 0.65, rStart.z - rWidth / 2);
    innerP.rotation.z = -rSlope;
    rampGroup.add(innerP);

    // Pasamanos interior corregido (rotación de geometría para evitar sobrescritura de Euler)
    const railGeo = new THREE.CylinderGeometry(0.04, 0.04, deckHypot, 8);
    railGeo.rotateZ(Math.PI / 2);
    const rail = new THREE.Mesh(railGeo, matMetalRail);
    rail.position.set((rStart.x + rEnd.x) / 2, (rStart.y + rEnd.y) / 2 + 1.25, rStart.z - rWidth / 2);
    rail.rotation.z = -rSlope;
    rampGroup.add(rail);

    // Vestíbulo superior de llegada (acceso al 3er piso)
    const topPortal = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 4.6), matTerracotta);
    topPortal.position.set(rEnd.x - 1.5, rEnd.y + 0.6, rEnd.z - 0.5);
    rampGroup.add(topPortal);

    const topDoor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.0, 2.2), matGlassFrame);
    topDoor.position.set(rEnd.x + 0.8, rEnd.y + 0.6, rEnd.z - 0.5);
    rampGroup.add(topDoor);

    buildingGroup.add(rampGroup);

    rootGroup.add(buildingGroup);

    // =========================================================================
    // 5. EXPORTACIÓN GLB BINARIA GLTF 2.0
    // =========================================================================
    console.log('Iniciando exportación con Three.js GLTFExporter...');
    const exporter = new THREE.GLTFExporter();

    return new Promise((resolve, reject) => {
      exporter.parse(
        rootGroup,
        (gltfArrayBuffer) => {
          console.log('¡Exportación GLTF completada! Tamaño:', gltfArrayBuffer.byteLength);
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(new Blob([gltfArrayBuffer]));
        },
        { binary: true, embedImages: true }
      );
    });
  });

  await browser.close();

  const buffer = Buffer.from(glbBase64, 'base64');

  // Guardar en las dos ubicaciones del proyecto
  const pathRoot = path.resolve('museo_sipan.glb');
  const pathExample = path.resolve('example-project/models/museo_sipan.glb');

  fs.writeFileSync(pathRoot, buffer);
  fs.writeFileSync(pathExample, buffer);

  const stats = fs.statSync(pathRoot);
  console.log(`\n🎉 ¡Modelo 3D Avanzado Generado Exitosamente!`);
  console.log(`📁 Rutas:`);
  console.log(`   - ${pathRoot}`);
  console.log(`   - ${pathExample}`);
  console.log(`📊 Peso: ${stats.size} bytes (${(stats.size / (1024 * 1024)).toFixed(2)} MB)\n`);

  return {
    pathRoot,
    pathExample,
    sizeBytes: stats.size,
    sizeMB: (stats.size / (1024 * 1024)).toFixed(2)
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/generate_sipan_advanced.js')) {
  generateAdvancedModel()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
