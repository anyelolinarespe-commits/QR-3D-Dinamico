/**
 * Generador procedural 3D del Museo Tumbas Reales de Sipán - Iteración 5 (Final Polish)
 * Máxima fidelidad: Celosía contenida, medallón repujado, rampa integrada y zócalo macizo.
 */

import * as THREE from 'three';
import fs from 'fs';
import path from 'path';

// Polyfill FileReader para Three.js GLTFExporter en Node.js
class FileReaderPolyfill {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
}
global.FileReader = FileReaderPolyfill;

import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function buildSipanMuseumScene() {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'Museo_Tumbas_Reales_Sipan';

  // ==========================================
  // 1. MATERIALES PBR REFINADOS
  // ==========================================
  // Rojo Mochica emblemático (arcilla/cinabrio mate con micro-rugosidad)
  const matTerracotta = new THREE.MeshStandardMaterial({
    color: 0x932c1e,
    roughness: 0.82,
    metalness: 0.04,
    name: 'Mochica_Terracotta'
  });

  const matTerracottaDark = new THREE.MeshStandardMaterial({
    color: 0x701f13,
    roughness: 0.88,
    metalness: 0.04,
    name: 'Mochica_Terracotta_Dark'
  });

  // Franjas y molduras decorativas ocre amarillo
  const matYellowAccent = new THREE.MeshStandardMaterial({
    color: 0xdfa634,
    roughness: 0.45,
    metalness: 0.25,
    name: 'Moche_Yellow_Accent'
  });

  // Oro ceremonial Mochica (brillo satinado de orfebrería precolombina)
  const matGoldRelief = new THREE.MeshStandardMaterial({
    color: 0xddb446,
    roughness: 0.25,
    metalness: 0.90,
    name: 'Moche_Gold_Relief'
  });

  // Vidrio azul cobalto translúcido para celosías y lucernario
  const matBlueGlass = new THREE.MeshPhysicalMaterial({
    color: 0x0e5395,
    roughness: 0.10,
    metalness: 0.12,
    transmission: 0.76,
    opacity: 0.88,
    transparent: true,
    name: 'Blue_Tinted_Glass'
  });

  // Perfilería oscura de la celosía y carpinterías
  const matGlassFrame = new THREE.MeshStandardMaterial({
    color: 0x14202c,
    roughness: 0.45,
    metalness: 0.65,
    name: 'Glass_Frame_Dark'
  });

  // Travertino claro de la plaza cívica
  const matTravertine = new THREE.MeshStandardMaterial({
    color: 0xd5cab9,
    roughness: 0.88,
    metalness: 0.02,
    name: 'Plaza_Travertine_Stone'
  });

  const matTravertinePaving = new THREE.MeshStandardMaterial({
    color: 0xc0b49f,
    roughness: 0.90,
    metalness: 0.02,
    name: 'Plaza_Paving_Accent'
  });

  // Césped
  const matGrass = new THREE.MeshStandardMaterial({
    color: 0x517237,
    roughness: 0.95,
    metalness: 0.0,
    name: 'Surrounding_Grass'
  });

  // Piso de rampa y pasarela
  const matRampDeck = new THREE.MeshStandardMaterial({
    color: 0xdcd3c3,
    roughness: 0.86,
    metalness: 0.02,
    name: 'Ramp_Walkway_Deck'
  });

  // Pasamanos metálico tubular
  const matMetalRail = new THREE.MeshStandardMaterial({
    color: 0xdcdcdc,
    roughness: 0.18,
    metalness: 0.94,
    name: 'Handrail_Metal'
  });

  // ==========================================
  // 2. BASE Y PLAZA CÍVICA
  // ==========================================
  const baseGroup = new THREE.Group();
  baseGroup.name = 'Base_Plaza';

  // Césped circundante
  const grassGeo = new THREE.BoxGeometry(105, 0.2, 90);
  const grassMesh = new THREE.Mesh(grassGeo, matGrass);
  grassMesh.position.set(0, -0.1, 0);
  baseGroup.add(grassMesh);

  // Plataforma cívica principal de travertino
  const plazaGeo = new THREE.BoxGeometry(88, 0.35, 64);
  const plazaMesh = new THREE.Mesh(plazaGeo, matTravertine);
  plazaMesh.position.set(2, 0.175, 4);
  baseGroup.add(plazaMesh);

  // Plaza hundida ceremonial
  const sunkenPlazaGeo = new THREE.BoxGeometry(34, 0.06, 26);
  const sunkenPlazaMesh = new THREE.Mesh(sunkenPlazaGeo, matTravertinePaving);
  sunkenPlazaMesh.position.set(16, 0.38, 17);
  baseGroup.add(sunkenPlazaMesh);

  // Bordillos amarillos
  const curbGeo1 = new THREE.BoxGeometry(34.4, 0.16, 0.35);
  const curb1 = new THREE.Mesh(curbGeo1, matYellowAccent);
  curb1.position.set(16, 0.42, 4);
  baseGroup.add(curb1);

  const curbGeoSide = new THREE.BoxGeometry(0.35, 0.16, 26.4);
  const curb2 = new THREE.Mesh(curbGeoSide, matYellowAccent);
  curb2.position.set(-1.2, 0.42, 17);
  baseGroup.add(curb2);

  const curb3 = new THREE.Mesh(curbGeoSide, matYellowAccent);
  curb3.position.set(33.2, 0.42, 17);
  baseGroup.add(curb3);

  // Modulación de cuadrícula en la plaza ceremonial
  for (let i = -2; i <= 2; i++) {
    const lineXGeo = new THREE.BoxGeometry(33.8, 0.02, 0.16);
    const lineX = new THREE.Mesh(lineXGeo, matYellowAccent);
    lineX.position.set(16, 0.43, 17 + i * 5.0);
    baseGroup.add(lineX);

    const lineZGeo = new THREE.BoxGeometry(0.16, 0.02, 25.8);
    const lineZ = new THREE.Mesh(lineZGeo, matYellowAccent);
    lineZ.position.set(16 + i * 6.6, 0.43, 17);
    baseGroup.add(lineZ);
  }

  // Bancas/bolardos ceremoniales
  for (let b = -2; b <= 2; b++) {
    const benchGeo = new THREE.BoxGeometry(1.1, 0.35, 1.1);
    const benchMesh = new THREE.Mesh(benchGeo, matYellowAccent);
    benchMesh.position.set(16 + b * 6.6, 0.58, 29.5);
    baseGroup.add(benchMesh);
  }

  rootGroup.add(baseGroup);

  // ==========================================
  // 3. ESTRUCTURA PIRAMIDAL CON TALUD EXACTO
  // ==========================================
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
      // Front face
      xMin, yBase, zFrontBase, // 0
      xMax, yBase, zFrontBase, // 1
      xMax, yTop,  zFrontTop,  // 2
      xMin, yTop,  zFrontTop,  // 3

      // Back face
      xMin, yBase, zBackBase,  // 4
      xMax, yBase, zBackBase,  // 5
      xMax, yTop,  zBackTop,   // 6
      xMin, yTop,  zBackTop    // 7
    ]);

    const indices = [
      // Front
      0, 1, 2,   0, 2, 3,
      // Top
      3, 2, 6,   3, 6, 7,
      // Back
      5, 4, 7,   5, 7, 6,
      // Left
      4, 0, 3,   4, 3, 7,
      // Right
      1, 5, 6,   1, 6, 2,
      // Bottom
      4, 5, 1,   4, 1, 0
    ];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;

    const width = xMax - xMin;
    const zSetback = zFrontBase - zFrontTop;
    const slopeLen = Math.sqrt(height * height + zSetback * zSetback);
    const slopeAngle = Math.atan2(zSetback, height);

    return {
      mesh,
      xMin,
      xMax,
      width,
      yBase,
      yTop,
      height,
      zFrontBase,
      zFrontTop,
      zBackBase,
      zBackTop,
      zSetback,
      slopeLen,
      slopeAngle
    };
  }

  // --- ALA IZQUIERDA (Menor altura: 11.5m, ancho 14.5m) ---
  const leftBlock = createTrapezoidalPrism({
    name: 'Ala_Izquierda_Talud',
    xMin: -27.5,
    xMax: -13.0,
    yBase: 0.35,
    height: 11.5,
    zFrontBase: 6.8,
    zFrontTop: -1.5,
    zBackBase: -16.0,
    zBackTop: -16.0
  });
  buildingGroup.add(leftBlock.mesh);

  // --- CUERPO CENTRAL (Mayor altura: 14.8m, ancho 17.0m) ---
  const centralBlock = createTrapezoidalPrism({
    name: 'Cuerpo_Central_Talud',
    xMin: -13.0,
    xMax: 4.0,
    yBase: 0.35,
    height: 14.8,
    zFrontBase: 8.8,
    zFrontTop: -1.9,
    zBackBase: -19.0,
    zBackTop: -19.0
  });
  buildingGroup.add(centralBlock.mesh);

  // Quiebre rehundido de transición
  const transitionBlock = createTrapezoidalPrism({
    name: 'Quiebre_Transicion',
    xMin: -13.0,
    xMax: -12.2,
    yBase: 0.35,
    height: 14.8,
    zFrontBase: 8.8,
    zFrontTop: -1.9,
    zBackBase: -19.0,
    zBackTop: -19.0,
    material: matTerracottaDark
  });
  buildingGroup.add(transitionBlock.mesh);

  // ==========================================
  // 4. FRANJAS AMARILLAS ADHERIDAS EXACTAMENTE AL TALUD
  // ==========================================
  function createSlopingStripes({ block, numStripes = 2, stripeW = 0.28 }) {
    const group = new THREE.Group();
    group.name = `Franjas_${block.mesh.name}`;

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

  // 2 franjas en Ala Izquierda (3 paños simétricos)
  buildingGroup.add(createSlopingStripes({ block: leftBlock, numStripes: 2 }));

  // 3 franjas en Cuerpo Central (4 paños monumentales)
  buildingGroup.add(createSlopingStripes({ block: centralBlock, numStripes: 3 }));

  // ==========================================
  // 5. FRISOS ESCULTÓRICOS SUPERIORES (Crestas Doradas)
  // ==========================================
  const friezesGroup = new THREE.Group();
  friezesGroup.name = 'Frisos_Superiores_Oro';

  function createFriezeBox({ x, yBase, zFrontCrest, width = 4.2, height = 2.8, depth = 1.8, iconType = 0 }) {
    const boxGroup = new THREE.Group();

    const centerZ = zFrontCrest + 0.35 - depth / 2;
    const centerY = yBase + height / 2;

    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const boxMesh = new THREE.Mesh(boxGeo, matTerracotta);
    boxGroup.add(boxMesh);

    const topTrimGeo = new THREE.BoxGeometry(width + 0.15, 0.22, depth + 0.15);
    const topTrim = new THREE.Mesh(topTrimGeo, matYellowAccent);
    topTrim.position.set(0, height / 2 + 0.11, 0);
    boxGroup.add(topTrim);

    const frameInnerGeo = new THREE.BoxGeometry(width - 0.45, height - 0.45, 0.15);
    const frameInner = new THREE.Mesh(frameInnerGeo, matTerracottaDark);
    frameInner.position.set(0, 0, depth / 2 + 0.05);
    boxGroup.add(frameInner);

    const plateGeo = new THREE.BoxGeometry(width - 0.75, height - 0.75, 0.10);
    const plate = new THREE.Mesh(plateGeo, matGoldRelief);
    plate.position.set(0, 0, depth / 2 + 0.12);
    boxGroup.add(plate);

    const rZ = depth / 2 + 0.22;

    if (iconType === 0) {
      // Deidad Mochica con tocado semilunar (Naylamp / Señor de Sipán)
      const headGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 16);
      headGeo.rotateX(Math.PI / 2);
      const head = new THREE.Mesh(headGeo, matGoldRelief);
      head.position.set(0, 0.28, rZ);
      boxGroup.add(head);

      const crownGeo = new THREE.TorusGeometry(0.72, 0.14, 8, 20, Math.PI);
      const crown = new THREE.Mesh(crownGeo, matGoldRelief);
      crown.position.set(0, 0.42, rZ);
      boxGroup.add(crown);

      const torsoGeo = new THREE.BoxGeometry(0.85, 0.75, 0.15);
      const torso = new THREE.Mesh(torsoGeo, matGoldRelief);
      torso.position.set(0, -0.22, rZ);
      boxGroup.add(torso);

      const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.14);
      const armL = new THREE.Mesh(armGeo, matGoldRelief);
      armL.position.set(-0.60, 0.06, rZ);
      armL.rotation.z = Math.PI / 5;
      boxGroup.add(armL);

      const armR = new THREE.Mesh(armGeo, matGoldRelief);
      armR.position.set(0.60, 0.06, rZ);
      armR.rotation.z = -Math.PI / 5;
      boxGroup.add(armR);
    } else if (iconType === 1) {
      // Deidad del Medallón Circular Solar
      const ringGeo = new THREE.TorusGeometry(0.85, 0.14, 10, 28);
      const ring = new THREE.Mesh(ringGeo, matGoldRelief);
      ring.position.set(0, 0, rZ);
      boxGroup.add(ring);

      const centerFaceGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.16, 16);
      centerFaceGeo.rotateX(Math.PI / 2);
      const centerFace = new THREE.Mesh(centerFaceGeo, matGoldRelief);
      centerFace.position.set(0, 0, rZ + 0.02);
      boxGroup.add(centerFace);

      for (let r = 0; r < 8; r++) {
        const rayGeo = new THREE.ConeGeometry(0.12, 0.30, 6);
        rayGeo.rotateZ((r * Math.PI) / 4);
        const ray = new THREE.Mesh(rayGeo, matGoldRelief);
        const angle = (r * Math.PI) / 4;
        ray.position.set(Math.cos(angle) * 1.05, Math.sin(angle) * 1.05, rZ);
        boxGroup.add(ray);
      }
    } else {
      // Cuatro personajes sacerdotales
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sy = -1; sy <= 1; sy += 2) {
          const miniFigGeo = new THREE.BoxGeometry(0.48, 0.58, 0.14);
          const miniFig = new THREE.Mesh(miniFigGeo, matGoldRelief);
          miniFig.position.set(sx * 0.72, sy * 0.45, rZ);
          boxGroup.add(miniFig);

          const miniCrownGeo = new THREE.TorusGeometry(0.24, 0.06, 6, 12, Math.PI);
          const miniCrown = new THREE.Mesh(miniCrownGeo, matGoldRelief);
          miniCrown.position.set(sx * 0.72, sy * 0.45 + 0.32, rZ);
          boxGroup.add(miniCrown);
        }
      }
    }

    boxGroup.position.set(x, centerY, centerZ);
    return boxGroup;
  }

  // Frisos en crestas
  friezesGroup.add(createFriezeBox({ x: -22.5, yBase: leftBlock.yTop, zFrontCrest: leftBlock.zFrontTop, iconType: 0 }));
  friezesGroup.add(createFriezeBox({ x: -16.5, yBase: leftBlock.yTop, zFrontCrest: leftBlock.zFrontTop, iconType: 2 }));

  friezesGroup.add(createFriezeBox({ x: -9.5, yBase: centralBlock.yTop, zFrontCrest: centralBlock.zFrontTop, iconType: 2 }));
  friezesGroup.add(createFriezeBox({ x: -4.25, yBase: centralBlock.yTop, zFrontCrest: centralBlock.zFrontTop, iconType: 1 }));
  friezesGroup.add(createFriezeBox({ x: 1.0, yBase: centralBlock.yTop, zFrontCrest: centralBlock.zFrontTop, iconType: 0 }));

  buildingGroup.add(friezesGroup);

  // ==========================================
  // 6. PABELLÓN TRIANGULAR DE ENTRADA HUECO CON CELOSÍA INTERIOR
  // ==========================================
  const entranceGroup = new THREE.Group();
  entranceGroup.name = 'Pabellon_Entrada_Triangular';

  const entryX = 6.8;
  const entryZ = 6.8;
  const entryY = 0.35;
  const outerW = 7.2;
  const outerH = 6.4;
  const innerW = 5.2;
  const innerH = 4.8;
  const canopyDepth = 5.0;

  // Arco triangular hueco en terracota
  const archShape = new THREE.Shape();
  archShape.moveTo(-outerW / 2, 0);
  archShape.lineTo(outerW / 2, 0);
  archShape.lineTo(0, outerH);
  archShape.closePath();

  // Orificio interior triangular
  const holePath = new THREE.Path();
  holePath.moveTo(-innerW / 2, 0);
  holePath.lineTo(innerW / 2, 0);
  holePath.lineTo(0, innerH);
  holePath.closePath();
  archShape.holes.push(holePath);

  const archExtrude = new THREE.ExtrudeGeometry(archShape, {
    depth: canopyDepth,
    bevelEnabled: false
  });
  archExtrude.rotateY(Math.PI);
  const archMesh = new THREE.Mesh(archExtrude, matTerracotta);
  archMesh.position.set(entryX, entryY, entryZ);
  entranceGroup.add(archMesh);

  // Borde exterior amarillo del triángulo frontal
  const borderGeo = new THREE.BoxGeometry(0.24, 7.3, 0.24);
  const borderL = new THREE.Mesh(borderGeo, matYellowAccent);
  borderL.position.set(entryX - 1.85, entryY + 3.2, entryZ + 0.05);
  borderL.rotation.z = -0.51;
  entranceGroup.add(borderL);

  const borderR = new THREE.Mesh(borderGeo, matYellowAccent);
  borderR.position.set(entryX + 1.85, entryY + 3.2, entryZ + 0.05);
  borderR.rotation.z = 0.51;
  entranceGroup.add(borderR);

  // Vidrio azul triangular en la celosía interior (rehundido 1.2m dentro del pórtico)
  const glassZ = entryZ - 1.2;
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-innerW / 2, 0);
  glassShape.lineTo(innerW / 2, 0);
  glassShape.lineTo(0, innerH);
  glassShape.closePath();

  const glassGeo = new THREE.ShapeGeometry(glassShape);
  const glassMesh = new THREE.Mesh(glassGeo, matBlueGlass);
  glassMesh.position.set(entryX, entryY, glassZ);
  entranceGroup.add(glassMesh);

  // Celosía romboidal azul: perfiles diagonales contenidos dentro del triángulo
  const latticeGroup = new THREE.Group();
  latticeGroup.name = 'Celosia_Romboidal_Azul';
  for (let d = -2; d <= 2; d++) {
    const barLen = 3.2 - Math.abs(d) * 0.6; // Acotado para no salir del triángulo
    const barGeo = new THREE.BoxGeometry(0.06, barLen, 0.05);

    const bar1 = new THREE.Mesh(barGeo, matGlassFrame);
    bar1.position.set(entryX + d * 0.72, entryY + 1.8, glassZ + 0.02);
    bar1.rotation.z = Math.PI / 4;
    latticeGroup.add(bar1);

    const bar2 = new THREE.Mesh(barGeo, matGlassFrame);
    bar2.position.set(entryX + d * 0.72, entryY + 1.8, glassZ + 0.02);
    bar2.rotation.z = -Math.PI / 4;
    latticeGroup.add(bar2);
  }
  entranceGroup.add(latticeGroup);

  // Puerta de entrada central de doble hoja
  const doorGeo = new THREE.BoxGeometry(1.6, 2.4, 0.12);
  const doorMesh = new THREE.Mesh(doorGeo, matGlassFrame);
  doorMesh.position.set(entryX, entryY + 1.2, glassZ + 0.05);
  entranceGroup.add(doorMesh);

  // Pasarela peatonal desde la plaza hacia el portal
  const walkGeo = new THREE.BoxGeometry(2.4, 0.18, 7.5);
  const walkMesh = new THREE.Mesh(walkGeo, matRampDeck);
  walkMesh.position.set(entryX, entryY + 0.10, entryZ + 3.2);
  entranceGroup.add(walkMesh);

  // Barandales
  for (let s = -1; s <= 1; s += 2) {
    const rx = entryX + s * 1.15;
    const railTube = new THREE.CylinderGeometry(0.035, 0.035, 7.5, 8);
    railTube.rotateX(Math.PI / 2);
    const rail = new THREE.Mesh(railTube, matMetalRail);
    rail.position.set(rx, entryY + 0.95, entryZ + 3.2);
    entranceGroup.add(rail);

    for (let p = -3; p <= 3; p++) {
      const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6);
      const post = new THREE.Mesh(postGeo, matMetalRail);
      post.position.set(rx, entryY + 0.52, entryZ + 3.2 + p * 1.15);
      entranceGroup.add(post);
    }
  }

  // Medallón ceremonial del Señor de Sipán con repujado
  const emblemGroup = new THREE.Group();
  const emblemGeo = new THREE.CylinderGeometry(0.70, 0.70, 0.10, 24);
  emblemGeo.rotateX(Math.PI / 2);
  const emblem = new THREE.Mesh(emblemGeo, matGoldRelief);
  emblemGroup.add(emblem);

  const emblemRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 8, 24), matGoldRelief);
  emblemGroup.add(emblemRing);

  emblemGroup.position.set(entryX - 1.25, entryY + 4.2, entryZ + 0.18);
  entranceGroup.add(emblemGroup);

  // Rótulo con tipografía en relieve ("MUSEO TUMBAS REALES DE SIPAN")
  const signGeo = new THREE.BoxGeometry(3.6, 0.32, 0.06);
  const signMesh = new THREE.Mesh(signGeo, matGoldRelief);
  signMesh.position.set(entryX - 1.6, entryY + 5.1, entryZ + 0.14);
  signMesh.rotation.z = 0.42;
  entranceGroup.add(signMesh);

  buildingGroup.add(entranceGroup);

  // ==========================================
  // 7. LUCERNARIO PIRAMIDAL SUPERIOR (VIDRIO AZUL)
  // ==========================================
  const skylightGroup = new THREE.Group();
  skylightGroup.name = 'Lucernario_Superior_Vidrio';

  const skyGeo = new THREE.CylinderGeometry(2.4, 4.4, 2.6, 4);
  skyGeo.rotateY(Math.PI / 4);
  const skyMesh = new THREE.Mesh(skyGeo, matBlueGlass);
  skyMesh.position.set(7.2, 13.0, -0.5);
  skylightGroup.add(skyMesh);

  const skyEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(skyGeo),
    new THREE.LineBasicMaterial({ color: 0x14202c, linewidth: 2 })
  );
  skyEdges.position.copy(skyMesh.position);
  skylightGroup.add(skyEdges);

  buildingGroup.add(skylightGroup);

  // ==========================================
  // 8. RAMPA MONUMENTAL ASCENDENTE (DERECHA)
  // ==========================================
  const rampGroup = new THREE.Group();
  rampGroup.name = 'Rampa_Monumental_Lateral';

  const rStart = { x: 33.0, y: 0.35, z: 8.5 };
  const rEnd = { x: 10.5, y: 10.5, z: 8.5 };
  const rLen = rStart.x - rEnd.x; // 22.5m
  const rRise = rEnd.y - rStart.y; // 10.15m
  const rSlope = Math.atan2(rRise, rLen);
  const rWidth = 3.6;

  // Muro macizo frontal sur de la rampa
  const rampWallShape = new THREE.Shape();
  rampWallShape.moveTo(rStart.x, 0.35);
  rampWallShape.lineTo(rEnd.x, 0.35);
  rampWallShape.lineTo(rEnd.x, rEnd.y + 1.2);
  rampWallShape.lineTo(rStart.x, rStart.y + 1.2);
  rampWallShape.closePath();

  const rampWallGeo = new THREE.ExtrudeGeometry(rampWallShape, {
    depth: 0.6,
    bevelEnabled: false
  });
  const rampWallMesh = new THREE.Mesh(rampWallGeo, matTerracotta);
  rampWallMesh.position.set(0, 0, rStart.z + rWidth / 2);
  rampGroup.add(rampWallMesh);

  // Zócalo macizo que cierra el vano inferior bajo la rampa
  const underWallGeo = new THREE.ExtrudeGeometry(rampWallShape, {
    depth: rWidth,
    bevelEnabled: false
  });
  const underWallMesh = new THREE.Mesh(underWallGeo, matTerracotta);
  underWallMesh.position.set(0, 0, rStart.z - rWidth / 2);
  rampGroup.add(underWallMesh);

  // Pilastras amarillas decorativas rítmicas a lo largo del muro sur
  const numPilasters = 8;
  for (let p = 0; p < numPilasters; p++) {
    const t = (p + 0.5) / numPilasters;
    const px = rStart.x - t * rLen;
    const currentH = rStart.y + t * rRise + 0.9;

    const pilGeo = new THREE.BoxGeometry(0.28, currentH, 0.12);
    const pil = new THREE.Mesh(pilGeo, matYellowAccent);
    pil.position.set(px, currentH / 2 + 0.35, rStart.z + rWidth / 2 + 0.65);
    rampGroup.add(pil);
  }

  // Deck / Pasarela inclinada que sube hacia la izquierda (-X)
  const deckHypot = Math.sqrt(rLen * rLen + rRise * rRise);
  const rDeckGeo = new THREE.BoxGeometry(deckHypot, 0.25, rWidth);
  const rDeck = new THREE.Mesh(rDeckGeo, matRampDeck);
  rDeck.position.set((rStart.x + rEnd.x) / 2, (rStart.y + rEnd.y) / 2 + 0.1, rStart.z);
  rDeck.rotation.z = -rSlope;
  rampGroup.add(rDeck);

  // Parapeto interior (norte)
  const innerPGeo = new THREE.BoxGeometry(deckHypot, 1.1, 0.25);
  const innerP = new THREE.Mesh(innerPGeo, matTerracotta);
  innerP.position.set((rStart.x + rEnd.x) / 2, (rStart.y + rEnd.y) / 2 + 0.65, rStart.z - rWidth / 2);
  innerP.rotation.z = -rSlope;
  rampGroup.add(innerP);

  // Pasamanos interior
  const railTube = new THREE.CylinderGeometry(0.04, 0.04, deckHypot, 8);
  railTube.rotateZ(Math.PI / 2);
  const rail = new THREE.Mesh(railTube, matMetalRail);
  rail.position.set((rStart.x + rEnd.x) / 2, (rStart.y + rEnd.y) / 2 + 1.25, rStart.z - rWidth / 2);
  rail.rotation.z = -rSlope;
  rampGroup.add(rail);

  // Vestíbulo superior de llegada (integrado limpiamente con el nivel superior)
  const topPortalGeo = new THREE.BoxGeometry(5.2, 4.2, 4.6);
  const topPortal = new THREE.Mesh(topPortalGeo, matTerracotta);
  topPortal.position.set(rEnd.x - 1.5, rEnd.y + 0.6, rEnd.z - 0.5);
  rampGroup.add(topPortal);

  const topDoorGeo = new THREE.BoxGeometry(0.15, 3.0, 2.2);
  const topDoor = new THREE.Mesh(topDoorGeo, matGlassFrame);
  topDoor.position.set(rEnd.x + 0.8, rEnd.y + 0.6, rEnd.z - 0.5);
  rampGroup.add(topDoor);

  buildingGroup.add(rampGroup);

  // Nodo raíz
  rootGroup.add(buildingGroup);

  return rootGroup;
}

/**
 * Exporta a .glb
 */
export async function exportToGLB(outputPath = 'museo_sipan.glb') {
  const scene = new THREE.Scene();
  const model = buildSipanMuseumScene();
  scene.add(model);

  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltfArrayBuffer) => {
        fs.writeFileSync(outputPath, Buffer.from(gltfArrayBuffer));
        const stats = fs.statSync(outputPath);
        resolve({
          path: outputPath,
          sizeBytes: stats.size,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2)
        });
      },
      (error) => {
        reject(error);
      },
      { binary: true }
    );
  });
}

// Ejecución directa si se invoca desde CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/generate_sipan_model.js')) {
  console.log('Construyendo y exportando modelo 3D del Museo Tumbas Reales de Sipán (Iteración 5 - Final)...');
  exportToGLB('museo_sipan.glb')
    .then((res) => {
      console.log(`¡Éxito! Archivo GLB generado: ${res.path} (${res.sizeBytes} bytes, ${res.sizeMB} MB)`);
    })
    .catch((err) => {
      console.error('Error generando GLB:', err);
      process.exit(1);
    });
}
