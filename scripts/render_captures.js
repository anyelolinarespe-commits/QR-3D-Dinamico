/**
 * Script de renderizado multicámara automatizado para iteración visual
 * Utiliza Three.js y Puppeteer-core con Google Chrome para generar capturas nítidas
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export async function renderAngles({ glbPath = 'museo_sipan.glb', outputDir = 'captures/iteration_1' } = {}) {
  fs.mkdirSync(outputDir, { recursive: true });

  const glbBase64 = fs.readFileSync(glbPath).toString('base64');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; overflow: hidden; background: #cce0eb; }
    canvas { width: 100vw; height: 100vh; display: block; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
</head>
<body>
<div id="container"></div>
<script>
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe0f2); // Cielo despejado norteño
  scene.fog = new THREE.FogExp2(0xbfe0f2, 0.008);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1280, 720);
  renderer.setPixelRatio(1.0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.getElementById('container').appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(42, 1280 / 720, 0.5, 500);

  // Iluminación solar cálida de Lambayeque
  const hemiLight = new THREE.HemisphereLight(0xfff7e6, 0x445566, 0.65);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff0d0, 1.35);
  sunLight.position.set(35, 45, 40);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 150;
  const d = 45;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x90b0d0, 0.45);
  fillLight.position.set(-30, 25, -20);
  scene.add(fillLight);

  let loadedModel = null;
  const loader = new THREE.GLTFLoader();

  const binaryString = atob("${glbBase64}");
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  loader.parse(bytes.buffer, '', (gltf) => {
    loadedModel = gltf.scene;
    loadedModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(loadedModel);
    window.__MODEL_READY = true;
  });

  window.setCameraPose = (eye, target) => {
    camera.position.set(eye.x, eye.y, eye.z);
    camera.lookAt(target.x, target.y, target.z);
    renderer.render(scene, camera);
  };
</script>
</body>
</html>
`;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setContent(htmlContent);

  // Esperar a que el modelo cargue
  await page.waitForFunction('window.__MODEL_READY === true', { timeout: 15000 });

  const cameraAngles = [
    {
      name: '01_frontal_baja',
      description: 'Vista frontal baja sobre el césped hacia la fachada monumental',
      eye: { x: -8, y: 3.5, z: 38 },
      target: { x: -6, y: 7.5, z: 2 }
    },
    {
      name: '02_perspectiva_rampa',
      description: 'Vista en perspectiva tres cuartos destacando la rampa monumental',
      eye: { x: 34, y: 7.5, z: 36 },
      target: { x: 5, y: 6.0, z: 4 }
    },
    {
      name: '03_detalle_entrada',
      description: 'Acercamiento al portal triangular y celosía azul con frisos superiores',
      eye: { x: 7, y: 3.8, z: 22 },
      target: { x: 6.5, y: 4.8, z: 8 }
    },
    {
      name: '04_aerea_general',
      description: 'Vista aérea cenital del conjunto arquitectónico y plaza cívica',
      eye: { x: 12, y: 38, z: 46 },
      target: { x: 2, y: 4, z: 4 }
    }
  ];

  const results = [];

  for (const angle of cameraAngles) {
    await page.evaluate((pose) => {
      window.setCameraPose(pose.eye, pose.target);
    }, angle);

    // Pequeño retardo para asegurar que los shaders completen el render
    await new Promise((r) => setTimeout(r, 400));

    const filename = `${angle.name}.png`;
    const filepath = path.join(outputDir, filename);
    await page.screenshot({ path: filepath, type: 'png' });
    results.push({
      name: angle.name,
      description: angle.description,
      filepath: filepath
    });
    console.log(`Captura generada: ${filepath}`);
  }

  await browser.close();
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/render_captures.js')) {
  renderAngles()
    .then((res) => console.log('¡Todas las capturas se generaron exitosamente!'))
    .catch((err) => console.error('Error renderizando:', err));
}
