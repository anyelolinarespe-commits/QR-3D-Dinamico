/**
 * Generador Ejemplo 2 – Museo Tumbas Reales de Sipán (Versión Mejorada HD)
 * Reconstrucción de alta fidelidad con geometría corregida y materiales PBR
 * Nuevas mejoras: muro lateral completo, mejor proporción de rampas, más frisos,
 * patio hundido con cuadrícula, luz cálida ambiente y acabado premium.
 *
 * Pipeline: Puppeteer → Three.js r128 + GLTFExporter → sipan_v2.glb
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_PATH = path.join(__dirname, '..', 'example-project', 'models', 'sipan_v2.glb');

export async function generateEjemplo2Model() {
  console.log('[START] Iniciando Ejemplo 2 – Museo Tumbas Reales de Sipán (HD Mejorado)...');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-web-security'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('console', (msg) => console.log('  [Browser]', msg.text()));

  const glbBase64 = await page.evaluate(async () => {
    // ── 1. Cargar Three.js r128 ────────────────────────────────────────────────
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    // ── 2. Cargar GLTFExporter r128 ───────────────────────────────────────────
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/GLTFExporter.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    console.log('[OK] Three.js r128 y GLTFExporter cargados');

    // ══════════════════════════════════════════════════════════════════════════
    // A. GENERADOR DE TEXTURAS PROCEDURALES PBR
    // ══════════════════════════════════════════════════════════════════════════
    function addNoise(ctx, w, h, opacity = 0.10) {
      const d = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 255 * opacity;
        d.data[i]   = Math.min(255, Math.max(0, d.data[i] + n));
        d.data[i+1] = Math.min(255, Math.max(0, d.data[i+1] + n));
        d.data[i+2] = Math.min(255, Math.max(0, d.data[i+2] + n));
      }
      ctx.putImageData(d, 0, 0);
    }

    // A1. Terracota / Adobe Mochica (cinabrio rojo)
    const cvTerra = document.createElement('canvas');
    cvTerra.width = cvTerra.height = 512;
    const ctTerra = cvTerra.getContext('2d');
    const gT = ctTerra.createLinearGradient(0, 0, 512, 512);
    gT.addColorStop(0,   '#9e3121');
    gT.addColorStop(0.4, '#912a1c');
    gT.addColorStop(1,   '#7e1f10');
    ctTerra.fillStyle = gT;
    ctTerra.fillRect(0, 0, 512, 512);
    // Venas de adobe: líneas horizontales tenues
    ctTerra.strokeStyle = 'rgba(60,10,5,0.18)';
    ctTerra.lineWidth = 2;
    for (let y = 32; y < 512; y += 32) {
      ctTerra.beginPath(); ctTerra.moveTo(0, y); ctTerra.lineTo(512, y); ctTerra.stroke();
    }
    addNoise(ctTerra, 512, 512, 0.14);
    const texTerracotta = new THREE.CanvasTexture(cvTerra);
    texTerracotta.wrapS = texTerracotta.wrapT = THREE.RepeatWrapping;
    texTerracotta.repeat.set(4, 4);

    // A2. Piso de plaza / travertino
    const cvPlaza = document.createElement('canvas');
    cvPlaza.width = cvPlaza.height = 512;
    const ctP = cvPlaza.getContext('2d');
    ctP.fillStyle = '#cfc5b0';
    ctP.fillRect(0, 0, 512, 512);
    ctP.strokeStyle = '#a89880'; ctP.lineWidth = 3;
    for (let v = 0; v <= 512; v += 128) { ctP.beginPath(); ctP.moveTo(v,0); ctP.lineTo(v,512); ctP.stroke(); }
    for (let h = 0; h <= 512; h += 128) { ctP.beginPath(); ctP.moveTo(0,h); ctP.lineTo(512,h); ctP.stroke(); }
    addNoise(ctP, 512, 512, 0.07);
    const texPlaza = new THREE.CanvasTexture(cvPlaza);
    texPlaza.wrapS = texPlaza.wrapT = THREE.RepeatWrapping;
    texPlaza.repeat.set(8, 6);

    // A3. Césped
    const cvGrass = document.createElement('canvas');
    cvGrass.width = cvGrass.height = 256;
    const ctG = cvGrass.getContext('2d');
    const gG = ctG.createLinearGradient(0,0,256,256);
    gG.addColorStop(0, '#5a7e38'); gG.addColorStop(1, '#466428');
    ctG.fillStyle = gG; ctG.fillRect(0,0,256,256);
    addNoise(ctG, 256, 256, 0.10);
    const texGrass = new THREE.CanvasTexture(cvGrass);
    texGrass.wrapS = texGrass.wrapT = THREE.RepeatWrapping;
    texGrass.repeat.set(6, 6);

    // A4. Vidrio azul con celosía romboidal (ventana triangular)
    const cvGlass = document.createElement('canvas');
    cvGlass.width = cvGlass.height = 256;
    const ctL = cvGlass.getContext('2d');
    ctL.fillStyle = 'rgba(10, 65, 128, 0.90)';
    ctL.fillRect(0, 0, 256, 256);
    ctL.strokeStyle = '#0d1a26'; ctL.lineWidth = 7;
    for (let i = -256; i <= 512; i += 56) {
      ctL.beginPath(); ctL.moveTo(i, 0);   ctL.lineTo(i + 256, 256); ctL.stroke();
      ctL.beginPath(); ctL.moveTo(i, 256); ctL.lineTo(i + 256, 0);   ctL.stroke();
    }
    // Reflejo sutil
    ctL.fillStyle = 'rgba(100, 180, 255, 0.07)';
    ctL.fillRect(0, 0, 100, 256);
    const texGlass = new THREE.CanvasTexture(cvGlass);
    texGlass.wrapS = texGlass.wrapT = THREE.RepeatWrapping;
    texGlass.repeat.set(2, 2);

    // A5. Oro martillado (franjas y marcos)
    const cvGold = document.createElement('canvas');
    cvGold.width = cvGold.height = 256;
    const ctGo = cvGold.getContext('2d');
    const gGo = ctGo.createRadialGradient(128,128,20,128,128,180);
    gGo.addColorStop(0, '#f5d060');
    gGo.addColorStop(0.5, '#ddb446');
    gGo.addColorStop(1, '#b08828');
    ctGo.fillStyle = gGo; ctGo.fillRect(0,0,256,256);
    addNoise(ctGo, 256, 256, 0.09);
    const texGold = new THREE.CanvasTexture(cvGold);

    // A6. Frisos iconográficos (5 variantes)
    function makeFriezeTex(type) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 400;
      const ctx = c.getContext('2d');

      // Fondo dorado
      const gf = ctx.createLinearGradient(0,0,512,400);
      gf.addColorStop(0, '#f0c94a'); gf.addColorStop(1, '#c4941e');
      ctx.fillStyle = gf; ctx.fillRect(0,0,512,400);

      // Marco terracota
      ctx.strokeStyle = '#6e1d12'; ctx.lineWidth = 20;
      ctx.strokeRect(14, 14, 484, 372);

      // Marco interior doble
      ctx.strokeStyle = '#9e7314'; ctx.lineWidth = 8;
      ctx.strokeRect(28, 28, 456, 344);

      ctx.fillStyle = '#5c3a06';
      ctx.lineWidth = 1;

      if (type === 0) {
        // Naylamp / Señor de Sipán – guerrero con tocado semilunar
        // Tocado semilunar grande
        ctx.beginPath(); ctx.arc(256, 190, 100, Math.PI, 0, false);
        ctx.strokeStyle = '#5c3a06'; ctx.lineWidth = 22; ctx.stroke();
        // Rayos del tocado
        for (let i = 0; i < 7; i++) {
          const ang = Math.PI + (i * Math.PI / 6);
          ctx.beginPath();
          ctx.moveTo(256 + Math.cos(ang)*100, 190 + Math.sin(ang)*100);
          ctx.lineTo(256 + Math.cos(ang)*130, 190 + Math.sin(ang)*130);
          ctx.lineWidth = 10; ctx.stroke();
        }
        // Cabeza
        ctx.beginPath(); ctx.arc(256, 195, 36, 0, Math.PI * 2); ctx.fill();
        // Orejeras
        ctx.beginPath(); ctx.arc(192, 205, 20, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(320, 205, 20, 0, Math.PI * 2); ctx.fill();
        // Cuerpo / pectoral rectangular
        ctx.fillRect(220, 240, 72, 80);
        // Brazos
        ctx.lineWidth = 16; ctx.strokeStyle = '#5c3a06';
        ctx.beginPath(); ctx.moveTo(220,260); ctx.lineTo(160,230); ctx.lineTo(150,185); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(292,260); ctx.lineTo(352,230); ctx.lineTo(362,185); ctx.stroke();
        // Cetro en mano derecha
        ctx.fillRect(355,185,10,80);
        ctx.beginPath(); ctx.arc(360,185,16,0,Math.PI*2); ctx.fill();

      } else if (type === 1) {
        // Ai Apaec – medallón solar con rayos
        ctx.beginPath(); ctx.arc(256, 200, 105, 0, Math.PI * 2);
        ctx.strokeStyle = '#5c3a06'; ctx.lineWidth = 20; ctx.stroke();
        // 16 rayos
        for (let r = 0; r < 16; r++) {
          const a = (r / 16) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(256+Math.cos(a)*105, 200+Math.sin(a)*105);
          ctx.lineTo(256+Math.cos(a)*140, 200+Math.sin(a)*140);
          ctx.lineWidth = 11; ctx.stroke();
        }
        // Cara del dios
        ctx.beginPath(); ctx.arc(256, 200, 55, 0, Math.PI * 2); ctx.fill();
        // Colmillos felínicos
        ctx.fillStyle = '#f5d060';
        ctx.beginPath(); ctx.moveTo(240,240); ctx.lineTo(248,264); ctx.lineTo(255,240); ctx.fill();
        ctx.beginPath(); ctx.moveTo(272,240); ctx.lineTo(264,264); ctx.lineTo(257,240); ctx.fill();
        ctx.fillStyle = '#5c3a06';
        // Dos círculos-ojos
        ctx.beginPath(); ctx.arc(237, 190, 14, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(275, 190, 14, 0, Math.PI*2); ctx.fill();

      } else if (type === 2) {
        // Sacerdotes danzantes – cuatro figuras en 2×2
        for (let col = 0; col < 2; col++) {
          for (let row = 0; row < 2; row++) {
            const cx = 148 + col * 216;
            const cy = 130 + row * 160;
            // Mini-tocado
            ctx.beginPath(); ctx.arc(cx, cy - 24, 26, Math.PI, 0, false);
            ctx.lineWidth = 10; ctx.strokeStyle = '#5c3a06'; ctx.stroke();
            // Cabeza
            ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI*2); ctx.fill();
            // Cuerpo
            ctx.fillRect(cx-18, cy+22, 36, 44);
            // Brazos alzados
            ctx.lineWidth = 10;
            ctx.beginPath(); ctx.moveTo(cx-18, cy+30); ctx.lineTo(cx-42, cy+10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx+18, cy+30); ctx.lineTo(cx+42, cy+10); ctx.stroke();
          }
        }

      } else if (type === 3) {
        // Guerrero Alado / Deidad Moche – alas extendidas
        // Alas
        ctx.beginPath();
        ctx.moveTo(80, 220); ctx.quadraticCurveTo(180, 110, 256, 160);
        ctx.quadraticCurveTo(332, 110, 432, 220);
        ctx.lineWidth = 20; ctx.strokeStyle = '#5c3a06'; ctx.stroke();
        // Cabeza con corona
        ctx.beginPath(); ctx.arc(256, 165, 38, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(256, 128, 20, Math.PI, 0, false);
        ctx.lineWidth = 12; ctx.strokeStyle = '#5c3a06'; ctx.stroke();
        // Cuerpo
        ctx.fillRect(228, 205, 56, 72);
        // Cuchillo / tumi
        ctx.fillStyle = '#f5d060';
        ctx.beginPath();
        ctx.arc(290, 250, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5c3a06';
        ctx.fillRect(286, 268, 8, 32);

      } else {
        // Araña de Oro / motivo geométrico Moche
        // Cuerpo central
        ctx.beginPath(); ctx.arc(256, 200, 55, 0, Math.PI*2); ctx.fill();
        // 8 patas
        for (let p = 0; p < 8; p++) {
          const a = (p / 8) * Math.PI * 2;
          const lx = 256 + Math.cos(a) * 55;
          const ly = 200 + Math.sin(a) * 55;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(256 + Math.cos(a) * 150, 200 + Math.sin(a) * 100);
          ctx.lineWidth = 14; ctx.strokeStyle = '#5c3a06'; ctx.stroke();
        }
        // Patrón geométrico escalonado en las esquinas
        for (let gx = 0; gx < 3; gx++) {
          for (let gy = 0; gy < 2; gy++) {
            const sx = 55 + gx * 160;
            const sy = 50 + gy * 270;
            ctx.fillRect(sx, sy, 24, 24);
            ctx.fillRect(sx+28, sy+28, 24, 24);
          }
        }
      }

      addNoise(ctx, 512, 400, 0.07);
      return new THREE.CanvasTexture(c);
    }

    const friezeTex = [0,1,2,3,4].map(makeFriezeTex);

    // A7. Medallón del Señor de Sipán
    const cvMedal = document.createElement('canvas');
    cvMedal.width = cvMedal.height = 512;
    const ctM = cvMedal.getContext('2d');
    const gM = ctM.createRadialGradient(256,256,30,256,256,245);
    gM.addColorStop(0,'#f9e070'); gM.addColorStop(0.5,'#ddb446'); gM.addColorStop(1,'#9e7314');
    ctM.fillStyle = gM; ctM.fillRect(0,0,512,512);
    ctM.strokeStyle = '#1a6e78'; ctM.lineWidth = 18;
    ctM.beginPath(); ctM.arc(256,256,215,0,Math.PI*2); ctM.stroke();
    ctM.strokeStyle = '#7c5b12'; ctM.lineWidth = 10;
    ctM.beginPath(); ctM.arc(256,256,185,0,Math.PI*2); ctM.stroke();
    ctM.fillStyle = '#5c3a06';
    ctM.beginPath(); ctM.arc(256,256,36,0,Math.PI*2); ctM.fill();
    for (let r=0;r<12;r++){
      const a=(r/12)*Math.PI*2;
      ctM.beginPath();
      ctM.moveTo(256+Math.cos(a)*36,256+Math.sin(a)*36);
      ctM.lineTo(256+Math.cos(a)*185,256+Math.sin(a)*185);
      ctM.lineWidth=6; ctM.strokeStyle='rgba(92,58,6,0.3)'; ctM.stroke();
    }
    addNoise(ctM,512,512,0.07);
    const texMedal = new THREE.CanvasTexture(cvMedal);

    // ══════════════════════════════════════════════════════════════════════════
    // B. MATERIALES PBR
    // ══════════════════════════════════════════════════════════════════════════
    const matTerra = new THREE.MeshStandardMaterial({ color:0x9a2e1e, map:texTerracotta, roughness:0.80, metalness:0.03, name:'Terracota_PBR' });
    const matTerraDark = new THREE.MeshStandardMaterial({ color:0x6b1b10, roughness:0.88, metalness:0.03, name:'Terracota_Oscura' });
    const matYellow = new THREE.MeshStandardMaterial({ color:0xd9a830, map:texGold, roughness:0.40, metalness:0.35, name:'Amarillo_Acento' });
    const matGold = new THREE.MeshStandardMaterial({ color:0xddb446, roughness:0.20, metalness:0.92, name:'Oro_Metalico' });
    const matGlass = new THREE.MeshStandardMaterial({ color:0x0e4f96, map:texGlass, roughness:0.08, metalness:0.20, opacity:0.88, transparent:true, name:'Vidrio_Azul' });
    const matGlassFrame = new THREE.MeshStandardMaterial({ color:0x101820, roughness:0.38, metalness:0.78, name:'Marco_Vidrio' });
    const matPlaza = new THREE.MeshStandardMaterial({ color:0xc8bca5, map:texPlaza, roughness:0.90, metalness:0.01, name:'Travertino_Plaza' });
    const matGrass = new THREE.MeshStandardMaterial({ color:0x4e7232, map:texGrass, roughness:0.96, metalness:0.0, name:'Cesped' });
    const matRamp = new THREE.MeshStandardMaterial({ color:0xd4cbc0, roughness:0.84, metalness:0.01, name:'Rampa_Piso' });
    const matMetal = new THREE.MeshStandardMaterial({ color:0xd0d0d0, roughness:0.15, metalness:0.95, name:'Metal_Barandal' });
    const matWallPanel = new THREE.MeshStandardMaterial({ color:0x9a2e1e, roughness:0.82, metalness:0.03, name:'Panel_Muro_Lateral' });

    // ══════════════════════════════════════════════════════════════════════════
    // C. CONSTRUCCIÓN GEOMÉTRICA
    //    Sistema de coordenadas: X = ancho (EO), Y = altura, Z = profundidad (NS)
    //    Vista frontal: mirando hacia -Z (Norte)
    //    Escala: 1 unidad ≈ 1 metro
    // ══════════════════════════════════════════════════════════════════════════
    const root = new THREE.Group();
    root.name = 'Museo_Tumbas_Reales_Sipan_V2';

    // ── C1. TERRENO BASE ────────────────────────────────────────────────────
    const terrain = new THREE.Group(); terrain.name = 'Terreno';
    // Césped circundante
    const meshGrass = new THREE.Mesh(new THREE.BoxGeometry(140, 0.25, 110), matGrass);
    meshGrass.position.set(0, -0.12, 0);
    terrain.add(meshGrass);

    // Plaza de acceso (piso claro)
    const meshPlaza = new THREE.Mesh(new THREE.BoxGeometry(100, 0.30, 72), matPlaza);
    meshPlaza.position.set(2, 0.15, 5);
    terrain.add(meshPlaza);

    // Patio ceremonial hundido (3×3 cuadrícula)
    const patioGeo = new THREE.BoxGeometry(38, 0.08, 30);
    const patioMesh = new THREE.Mesh(patioGeo, matPlaza);
    patioMesh.position.set(18, 0.33, 18);
    terrain.add(patioMesh);

    // Bordillos amarillos del patio
    const makeCurb = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matYellow);
      m.position.set(x, y, z);
      terrain.add(m);
    };
    makeCurb(38.4, 0.18, 0.4,  18, 0.44, 3.0);  // frente
    makeCurb(38.4, 0.18, 0.4,  18, 0.44, 33.0); // fondo
    makeCurb(0.4,  0.18, 30.4, -1.0, 0.44, 18); // izq
    makeCurb(0.4,  0.18, 30.4, 37.0, 0.44, 18); // der

    // Cuadrícula interna del patio
    for (let i = -2; i <= 2; i++) {
      const lx = new THREE.Mesh(new THREE.BoxGeometry(37, 0.02, 0.14), matYellow);
      lx.position.set(18, 0.45, 18 + i * 5.6);
      terrain.add(lx);
      const lz = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 29.8), matYellow);
      lz.position.set(18 + i * 7.4, 0.45, 18);
      terrain.add(lz);
    }
    // Bancas/elementos del patio
    for (let b = -2; b <= 2; b++) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), matYellow);
      bench.position.set(18 + b * 7.4, 0.60, 32.0);
      terrain.add(bench);
    }
    root.add(terrain);

    // ── C2. EDIFICIO PRINCIPAL ───────────────────────────────────────────────
    // Función para crear prisma trapezoidal (talud piramidal inclinado)
    function trapezoid({ name, xMin, xMax, yBase = 0.30, height,
                         zFrontBase, zFrontTop, zBack, mat = matTerra }) {
      const yTop = yBase + height;
      const v = new Float32Array([
        // Cara frontal
        xMin, yBase, zFrontBase,
        xMax, yBase, zFrontBase,
        xMax, yTop,  zFrontTop,
        xMin, yTop,  zFrontTop,
        // Cara trasera
        xMin, yBase, zBack,
        xMax, yBase, zBack,
        xMax, yTop,  zBack,
        xMin, yTop,  zBack
      ]);
      const idx = [
        0,1,2, 0,2,3,  // frente
        3,2,6, 3,6,7,  // arriba
        5,4,7, 5,7,6,  // atrás
        4,0,3, 4,3,7,  // izq
        1,5,6, 1,6,2,  // der
        4,5,1, 4,1,0   // abajo
      ];
      const uv = new Float32Array([
        0,0, 1,0, 1,1, 0,1,
        0,0, 1,0, 1,1, 0,1
      ]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      const zSetback = zFrontBase - zFrontTop;
      const slopeLen = Math.sqrt(height * height + zSetback * zSetback);
      const slopeAngle = Math.atan2(zSetback, height);
      return { mesh, xMin, xMax, width: xMax - xMin, yBase, yTop, height,
               zFrontBase, zFrontTop, zBack, zSetback, slopeLen, slopeAngle };
    }

    const building = new THREE.Group(); building.name = 'Edificio';

    // ── ALA IZQUIERDA (menor, talud ~54°)
    const wingL = trapezoid({
      name: 'Ala_Izquierda',
      xMin: -30.0, xMax: -14.0,
      yBase: 0.30, height: 12.5,
      zFrontBase: 7.5, zFrontTop: -1.5,
      zBack: -18.0
    });
    building.add(wingL.mesh);

    // Canal de quiebre de sombra
    const wingLShadow = trapezoid({
      name: 'Ala_Izq_Sombra',
      xMin: -14.0, xMax: -13.2,
      yBase: 0.30, height: 12.5,
      zFrontBase: 7.5, zFrontTop: -1.5,
      zBack: -18.0,
      mat: matTerraDark
    });
    building.add(wingLShadow.mesh);

    // ── CUERPO CENTRAL (mayor, talud más pronunciado)
    const wingC = trapezoid({
      name: 'Cuerpo_Central',
      xMin: -13.2, xMax: 4.5,
      yBase: 0.30, height: 16.5,
      zFrontBase: 9.5, zFrontTop: -2.0,
      zBack: -21.0
    });
    building.add(wingC.mesh);

    // ── TRANSICIÓN LUMINOSA (canal entre cuerpo central y entrada)
    const wingCTrans = trapezoid({
      name: 'Transicion_Central',
      xMin: -13.2, xMax: -12.3,
      yBase: 0.30, height: 16.5,
      zFrontBase: 9.5, zFrontTop: -2.0,
      zBack: -21.0,
      mat: matTerraDark
    });
    building.add(wingCTrans.mesh);

    // ── MURO LATERAL DERECHO LARGO (visible desde vista aérea y derecha)
    // Este es el muro bajo con pilastras que se extiende hacia la derecha
    const wallR = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 7.2, 50),
      matWallPanel
    );
    wallR.position.set(28.0, 3.90, -7.0);
    building.add(wallR);

    // Muro superior sobre la rampa (cuerpo derecho del edificio)
    const bodyR = new THREE.Mesh(
      new THREE.BoxGeometry(16.5, 8.5, 22.0),
      matTerra
    );
    bodyR.position.set(20.5, 4.55, -11.5);
    building.add(bodyR);

    // Zócalo del cuerpo derecho
    const socleR = new THREE.Mesh(
      new THREE.BoxGeometry(17.0, 1.2, 22.5),
      matYellow
    );
    socleR.position.set(20.5, 0.90, -11.5);
    building.add(socleR);

    // ── PILASTRAS AMARILLAS DEL MURO LATERAL ────────────────────────────────
    for (let p = 0; p < 7; p++) {
      const pz = -18.5 + p * 5.5;
      const pilastra = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 7.5, 0.42),
        matYellow
      );
      pilastra.position.set(28.4, 4.05, pz);
      building.add(pilastra);

      // Capitel dorado
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.6), matGold);
      cap.position.set(28.4, 8.0, pz);
      building.add(cap);
    }

    // ── FRISOS SUPERIORES ─────────────────────────────────────────────────────
    const friezes = new THREE.Group(); friezes.name = 'Frisos';

    function makeFriezeBox({ x, yBase, zCrest, w=4.4, h=3.0, d=2.0, texIdx=0 }) {
      const g = new THREE.Group();
      const cz = zCrest - d / 2 + 0.4;
      const cy = yBase + h / 2;

      // Caja terracota
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matTerra));
      // Moldurado superior dorado
      const topGeo = new THREE.BoxGeometry(w + 0.2, 0.28, d + 0.2);
      const top = new THREE.Mesh(topGeo, matYellow);
      top.position.set(0, h/2 + 0.14, 0); g.add(top);
      // Marco rehundido
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w-0.5, h-0.5, 0.18), matTerraDark);
      frame.position.set(0, 0, d/2 + 0.06); g.add(frame);
      // Placa iconográfica dorada
      const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: friezeTex[texIdx], roughness:0.22, metalness:0.88 });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(w-0.8, h-0.8, 0.12), plateMat);
      plate.position.set(0, 0, d/2 + 0.14); g.add(plate);
      // Relieve 3D encima de la placa
      if (texIdx === 1) { // Medallón solar
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.80, 0.14, 8, 24), matGold);
        ring.position.set(0, 0, d/2 + 0.26); g.add(ring);
      } else if (texIdx === 0) { // Guerrero
        const cr = new THREE.Mesh(new THREE.TorusGeometry(0.70, 0.12, 6, 18, Math.PI), matGold);
        cr.position.set(0, 0.42, d/2 + 0.26); g.add(cr);
      }
      g.position.set(x, cy, cz);
      return g;
    }

    // 2 frisos ala izquierda
    friezes.add(makeFriezeBox({ x: -24.5, yBase: wingL.yTop, zCrest: wingL.zFrontTop, texIdx: 0 }));
    friezes.add(makeFriezeBox({ x: -17.5, yBase: wingL.yTop, zCrest: wingL.zFrontTop, texIdx: 2 }));
    // 3 frisos cuerpo central
    friezes.add(makeFriezeBox({ x: -9.5,  yBase: wingC.yTop, zCrest: wingC.zFrontTop, texIdx: 3 }));
    friezes.add(makeFriezeBox({ x: -4.0,  yBase: wingC.yTop, zCrest: wingC.zFrontTop, texIdx: 1 }));
    friezes.add(makeFriezeBox({ x:  1.5,  yBase: wingC.yTop, zCrest: wingC.zFrontTop, texIdx: 4 }));

    building.add(friezes);

    // ── PABELLÓN DE ENTRADA TRIANGULAR ────────────────────────────────────────
    const entrance = new THREE.Group(); entrance.name = 'Entrada_Triangular';
    const eX = 7.5, eZ = 7.5, eY = 0.30;
    const oW = 7.8, oH = 7.0, iW = 5.6, iH = 5.4;

    // Extrusión con hueco triangular
    const archShape = new THREE.Shape();
    archShape.moveTo(-oW/2, 0); archShape.lineTo(oW/2, 0); archShape.lineTo(0, oH); archShape.closePath();
    const holeShape = new THREE.Path();
    holeShape.moveTo(-iW/2, 0.4); holeShape.lineTo(iW/2, 0.4); holeShape.lineTo(0, iH); holeShape.closePath();
    archShape.holes.push(holeShape);

    const archGeo = new THREE.ExtrudeGeometry(archShape, { depth: 5.5, bevelEnabled: false });
    archGeo.rotateY(Math.PI);
    const archMesh = new THREE.Mesh(archGeo, matTerra);
    archMesh.position.set(eX, eY, eZ);
    entrance.add(archMesh);

    // Bordes dorados del triángulo
    const makeBorder = (x, y, z, rz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 8.2, 0.28), matYellow);
      b.position.set(x, y, z); b.rotation.z = rz; entrance.add(b);
    };
    makeBorder(eX - 2.1, eY + 3.4, eZ + 0.08, -0.52);
    makeBorder(eX + 2.1, eY + 3.4, eZ + 0.08,  0.52);

    // Vidrio azul con celosía romboidal
    const glassShape = new THREE.Shape();
    glassShape.moveTo(-iW/2, 0.4); glassShape.lineTo(iW/2, 0.4); glassShape.lineTo(0, iH); glassShape.closePath();
    const glassMesh = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), matGlass);
    glassMesh.position.set(eX, eY, eZ - 1.5);
    entrance.add(glassMesh);

    // Marco metálico del vidrio
    const doorGeo = new THREE.BoxGeometry(1.8, 2.8, 0.14);
    const doorMesh = new THREE.Mesh(doorGeo, matGlassFrame);
    doorMesh.position.set(eX, eY + 1.4, eZ - 1.5);
    entrance.add(doorMesh);

    // Medallón del Señor de Sipán
    const medalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texMedal, roughness: 0.20, metalness: 0.92 });
    const medalGeo = new THREE.CylinderGeometry(0.80, 0.80, 0.11, 32);
    medalGeo.rotateX(Math.PI / 2);
    const medal = new THREE.Mesh(medalGeo, medalMat);
    medal.position.set(eX - 1.4, eY + 4.6, eZ + 0.25);
    entrance.add(medal);

    // Rótulo MUSEO TUMBAS REALES DE SIPAN
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 0.07), matGold);
    sign.position.set(eX - 1.8, eY + 5.6, eZ + 0.18);
    sign.rotation.z = 0.42;
    entrance.add(sign);

    // Pasarela de acceso frontal
    const walkGeo = new THREE.BoxGeometry(2.6, 0.20, 8.0);
    const walk = new THREE.Mesh(walkGeo, matRamp);
    walk.position.set(eX, eY + 0.10, eZ + 4.0);
    entrance.add(walk);

    // Pasamanos del acceso
    for (let s = -1; s <= 1; s += 2) {
      const rxw = eX + s * 1.25;
      const railGeo = new THREE.CylinderGeometry(0.038, 0.038, 8.0, 8);
      railGeo.rotateX(Math.PI / 2);
      const railMesh = new THREE.Mesh(railGeo, matMetal);
      railMesh.position.set(rxw, eY + 0.95, eZ + 4.0);
      entrance.add(railMesh);
      for (let p = -3; p <= 3; p++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.90, 6), matMetal);
        post.position.set(rxw, eY + 0.50, eZ + 4.0 + p * 1.2);
        entrance.add(post);
      }
    }

    building.add(entrance);

    // ── LUCERNARIO / SKYLIGHT PIRAMIDAL CENITAL ────────────────────────────────
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.8, 2.8, 4), matGlass);
    sky.rotateY(Math.PI / 4);
    sky.position.set(16.5, 10.0, -3.0);
    building.add(sky);

    const skyEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(sky.geometry),
      new THREE.LineBasicMaterial({ color: 0x101820, linewidth: 2 })
    );
    skyEdge.position.copy(sky.position);
    skyEdge.rotation.copy(sky.rotation);
    building.add(skyEdge);

    // ── RAMPA MONUMENTAL LATERAL (derecha, ascendente) ───────────────────────
    const ramp = new THREE.Group(); ramp.name = 'Rampa_Monumental';
    const rS = { x: 36.0, y: 0.30, z: 9.0 };
    const rE = { x: 11.5, y: 11.8, z: 9.0 };
    const rLen = rS.x - rE.x;    // 24.5m
    const rRise = rE.y - rS.y;   // 11.5m
    const rSlope = Math.atan2(rRise, rLen);
    const rHypot = Math.sqrt(rLen*rLen + rRise*rRise);
    const rW = 4.0;

    // Muro de contención frontal (Shape + Extrude)
    const rWallShape = new THREE.Shape();
    rWallShape.moveTo(rS.x, 0.30);
    rWallShape.lineTo(rE.x, 0.30);
    rWallShape.lineTo(rE.x, rE.y + 1.4);
    rWallShape.lineTo(rS.x, rS.y + 1.4);
    rWallShape.closePath();
    const rWallGeo = new THREE.ExtrudeGeometry(rWallShape, { depth: 0.65, bevelEnabled: false });
    const rWallMesh = new THREE.Mesh(rWallGeo, matTerra);
    rWallMesh.position.set(0, 0, rS.z + rW / 2);
    ramp.add(rWallMesh);

    // Zócalo sólido bajo la rampa
    const rBaseGeo = new THREE.ExtrudeGeometry(rWallShape, { depth: rW, bevelEnabled: false });
    const rBaseMesh = new THREE.Mesh(rBaseGeo, matTerra);
    rBaseMesh.position.set(0, 0, rS.z - rW / 2);
    ramp.add(rBaseMesh);

    // Pilastras amarillas escalonadas (8 unidades)
    for (let p = 0; p < 8; p++) {
      const t = (p + 0.5) / 8;
      const px = rS.x - t * rLen;
      const ph = rS.y + t * rRise + 1.0;
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.32, ph, 0.14), matYellow);
      pil.position.set(px, ph/2 + 0.30, rS.z + rW/2 + 0.75);
      ramp.add(pil);
      const capP = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.5), matGold);
      capP.position.set(px, ph + 0.43, rS.z + rW/2 + 0.75);
      ramp.add(capP);
    }

    // Deck inclinado peatonal
    const rDeckGeo = new THREE.BoxGeometry(rHypot, 0.26, rW);
    const rDeck = new THREE.Mesh(rDeckGeo, matRamp);
    rDeck.position.set((rS.x+rE.x)/2, (rS.y+rE.y)/2 + 0.12, rS.z);
    rDeck.rotation.z = -rSlope;
    ramp.add(rDeck);

    // Parapeto interior de la rampa
    const parGeo = new THREE.BoxGeometry(rHypot, 1.2, 0.26);
    const par = new THREE.Mesh(parGeo, matTerra);
    par.position.set((rS.x+rE.x)/2, (rS.y+rE.y)/2 + 0.70, rS.z - rW/2);
    par.rotation.z = -rSlope;
    ramp.add(par);

    // Pasamanos metálico interior
    const railRGeo = new THREE.CylinderGeometry(0.044, 0.044, rHypot, 8);
    railRGeo.rotateZ(Math.PI / 2);
    const railR = new THREE.Mesh(railRGeo, matMetal);
    railR.position.set((rS.x+rE.x)/2, (rS.y+rE.y)/2 + 1.3, rS.z - rW/2);
    railR.rotation.z = -rSlope;
    ramp.add(railR);

    // Vestíbulo superior de llegada
    const topPortal = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.5, 5.0), matTerra);
    topPortal.position.set(rE.x - 2.5, rE.y + 3.6, rS.z);
    ramp.add(topPortal);

    // Lucernario sobre el vestíbulo superior
    const topSky = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3.4, 2.4, 4), matGlass);
    topSky.rotateY(Math.PI / 4);
    topSky.position.set(rE.x - 2.5, rE.y + 7.6, rS.z);
    ramp.add(topSky);
    const topSkyEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(topSky.geometry),
      new THREE.LineBasicMaterial({ color: 0x101820, linewidth: 2 })
    );
    topSkyEdge.position.copy(topSky.position);
    topSkyEdge.rotation.copy(topSky.rotation);
    ramp.add(topSkyEdge);

    building.add(ramp);

    // ── FRANJAS AMARILLAS SOBRE EL TALUD INCLINADO ───────────────────────────
    function addStripes(block, count) {
      const sp = block.width / (count + 1);
      for (let i = 1; i <= count; i++) {
        const x = block.xMin + i * sp;
        const geo = new THREE.BoxGeometry(0.30, block.slopeLen, 0.09);
        const mesh = new THREE.Mesh(geo, matYellow);
        const midY = block.yBase + block.height / 2;
        const midZ = (block.zFrontBase + block.zFrontTop) / 2 + 0.055;
        mesh.position.set(x, midY, midZ);
        mesh.rotation.x = -block.slopeAngle;
        building.add(mesh);
      }
    }
    addStripes(wingL, 2);
    addStripes(wingC, 3);

    root.add(building);

    // ── C3. ESCENA CON ILUMINACIÓN ────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.add(root);

    // Luz ambiente cálida
    scene.add(new THREE.AmbientLight(0xffe4b5, 0.65));
    // Luz solar principal
    const sun = new THREE.DirectionalLight(0xfff8dc, 1.4);
    sun.position.set(-25, 55, 40); scene.add(sun);
    // Luz de relleno lateral
    const fill = new THREE.DirectionalLight(0xddeeff, 0.45);
    fill.position.set(40, 20, -10); scene.add(fill);
    // Luz de suelo (rebote)
    const bounce = new THREE.PointLight(0xffa050, 0.30, 90);
    bounce.position.set(0, 2, 15); scene.add(bounce);

    // ── EXPORTAR A GLB ────────────────────────────────────────────────────────
    const exporter = new THREE.GLTFExporter();

    const glbBase64 = await new Promise((resolve, reject) => {
      exporter.parse(scene, (gltfBuffer) => {
        const blob = new Blob([gltfBuffer], { type: 'model/gltf-binary' });
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result.split(',')[1];
          if (!b64 || b64.length < 100) {
            reject(new Error('Base64 vacío o demasiado pequeño'));
          } else {
            resolve(b64);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, { binary: true });
    });

    return glbBase64;
  });

  await browser.close();

  if (!glbBase64) throw new Error('El evaluado no devolvió base64');

  const glbBuffer = Buffer.from(glbBase64, 'base64');
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, glbBuffer);

  const sizeMB = (glbBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`[OK] sipan_v2.glb generado: ${sizeMB} MB -> ${OUTPUT_PATH}`);

  if (glbBuffer.length < 1000) {
    throw new Error(`El GLB es sospechosamente pequeño (${glbBuffer.length} bytes). Algo falló.`);
  }

  return OUTPUT_PATH;
}

// Ejecutar si es el módulo principal
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('generate_sipan_ejemplo2.js')) {
  generateEjemplo2Model()
    .then(p => console.log('[OK] Listo:', p))
    .catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
}
