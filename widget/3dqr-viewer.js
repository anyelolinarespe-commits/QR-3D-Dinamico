/**
 * 3D QR Viewer - Web Component Embebible
 * Renderiza modelos 3D interactivos con Three.js y actualiza en tiempo real
 * códigos QR desechables sin recargar la página ni el modelo 3D.
 * Incluye modo Vista Aérea 90° que muestrea los colores cenitales del modelo
 * y los proyecta en los recuadros del código QR manteniendo la legibilidad.
 */

class Qr3dViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.apiUrl = this.getAttribute('api-url') || window.location.origin;
    this.qrId = this.getAttribute('qr-id');
    this.eventSource = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationFrameId = null;
    this.currentModel = null;
    this.modelPivot = null;
    this.qrMaterials = [];
    this.edgeLines = [];
    this.sunLight = null;
    this.fillLight = null;
    this.resizeObserver = null;
    this.showEdges = this.getAttribute('show-edges') !== 'false';
    this.autoRotate = this.getAttribute('auto-rotate') !== 'false';
    this.aerialRequested = this.getAttribute('aerial-scan') === 'true';

    // Estado de Vista Aérea 90° y QR cromático
    this.isAerialMode = false;
    this.autoRotateBeforeAerial = this.autoRotate;
    this.defaultView = null;
    this.mainBounds = null;
    this.cameraAnim = null;
    this.aerialQrMesh = null;
    this.aerialSamples = null;
    this.qrMatrixCache = null;
    this.pointerDownInfo = null;
  }

  static get observedAttributes() {
    return ['qr-id', 'api-url', 'auto-rotate', 'aerial-scan'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'qr-id') this.qrId = newValue;
      if (name === 'api-url') this.apiUrl = newValue;
      if (name === 'auto-rotate') this.autoRotate = newValue !== 'false';
      if (name === 'aerial-scan') {
        const wantAerial = newValue === 'true';
        this.aerialRequested = wantAerial;
        if (this.currentModel) {
          if (wantAerial && !this.isAerialMode) this.enterAerialScanMode();
          if (!wantAerial && this.isAerialMode) this.exitAerialScanMode();
        }
      }
    }
  }

  connectedCallback() {
    this.render();
    this.loadDependencies().then(() => {
      if (!this.isConnected) return;
      this.initThree();
      this.loadModel();
      this.initRealtimeSSE();
    });
  }

  disconnectedCallback() {
    if (this.eventSource) {
      this.eventSource.close();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  async loadDependencies() {
    if (!window.THREE) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }
    if (!window.THREE.OrbitControls) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    }
    if (!window.THREE.GLTFLoader) {
      await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded) return resolve();
        existing.addEventListener('load', resolve);
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => {
        s.dataset.loaded = 'true';
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  render() {
    const width = this.getAttribute('width') || '100%';
    const height = this.getAttribute('height') || '480px';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          width: ${width};
          height: ${height};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          border-radius: 16px;
          overflow: hidden;
          background: radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 100%);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
          user-select: none;
        }

        #viewport {
          width: 100%;
          height: 100%;
          display: block;
          cursor: grab;
        }

        #viewport:active {
          cursor: grabbing;
        }

        /* Overlay 2D del código QR en vivo */
        .qr-badge-container {
          position: absolute;
          bottom: 16px;
          right: 16px;
          background: rgba(15, 23, 42, 0.88);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.45);
          transition: transform 0.2s ease, border-color 0.2s ease;
          z-index: 10;
          cursor: pointer;
        }

        .qr-badge-container:hover {
          transform: scale(1.04);
          border-color: rgba(245, 158, 11, 0.7);
        }

        .qr-badge-container.aerial-active {
          border-color: #f59e0b;
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.28);
        }

        .qr-badge-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          font-size: 11px;
          color: #cbd5e1;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 8px #22c55e;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .qr-image-wrapper {
          position: relative;
          width: 116px;
          height: 116px;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        #qr-preview-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        #qr-preview-img.updating {
          opacity: 0.2;
          transform: scale(0.9);
        }

        /* Notificación flotante de escaneo completado */
        .scan-toast {
          position: absolute;
          top: 56px;
          left: 50%;
          transform: translateX(-50%) translateY(-20px);
          background: #059669;
          color: #ffffff;
          padding: 8px 16px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          opacity: 0;
          pointer-events: none;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .scan-toast.show {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }

        /* Barra de herramientas */
        .controls-toolbar {
          position: absolute;
          top: 16px;
          left: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          z-index: 10;
        }

        .btn-tool {
          background: rgba(15, 23, 42, 0.78);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: #cbd5e1;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .btn-tool:hover {
          background: rgba(30, 41, 59, 0.95);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.35);
        }

        .btn-tool.active {
          background: rgba(217, 119, 6, 0.88);
          border-color: #fbbf24;
          color: #ffffff;
        }

        .hint-3d {
          position: absolute;
          bottom: 16px;
          left: 16px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          pointer-events: none;
          background: rgba(15, 23, 42, 0.5);
          padding: 4px 10px;
          border-radius: 999px;
        }

        .loader {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #60a5fa;
          font-size: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(96, 165, 250, 0.2);
          border-top-color: #60a5fa;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>

      <div class="controls-toolbar">
        <button id="btn-aerial" class="btn-tool">🛸 Escanear 90°</button>
        <button id="btn-rotate" class="btn-tool">🔄 Auto-Giro: ON</button>
        <button id="btn-edges" class="btn-tool">✏️ Aristas: ON</button>
        <button id="btn-reset" class="btn-tool">🎯 Centrar</button>
      </div>

      <div class="scan-toast" id="scan-toast">
        ✨ ¡QR escaneado! Nuevo código activo
      </div>

      <div class="hint-3d" id="hint-3d">🖱️ Clic en el modelo: Vista aérea 90° · Arrastra para girar</div>

      <div class="loader" id="loader">
        <div class="spinner"></div>
        <span>Cargando modelo 3D...</span>
      </div>

      <!-- Live 2D QR overlay -->
      <div class="qr-badge-container" id="qr-badge" title="Clic para activar Vista Aérea 90° y QR con colores del modelo">
        <div class="qr-badge-header">
          <span id="qr-badge-title">QR Dinámico</span>
          <span class="live-dot" title="En vivo"></span>
        </div>
        <div class="qr-image-wrapper">
          <img id="qr-preview-img" src="" alt="QR Activo" />
        </div>
        <div id="qr-badge-sub" style="font-size: 10px; color: #94a3b8; text-align: center;">Clic para escanear 90°</div>
      </div>

      <canvas id="viewport"></canvas>
    `;

    this.shadowRoot.getElementById('btn-aerial').addEventListener('click', () => {
      if (this.isAerialMode) {
        this.exitAerialScanMode();
      } else {
        this.enterAerialScanMode();
      }
    });

    this.shadowRoot.getElementById('qr-badge').addEventListener('click', () => {
      if (this.isAerialMode) {
        this.exitAerialScanMode();
      } else {
        this.enterAerialScanMode();
      }
    });

    this.shadowRoot.getElementById('btn-rotate').addEventListener('click', () => {
      this.autoRotate = !this.autoRotate;
      this.updateRotateButtonLabel();
    });

    this.shadowRoot.getElementById('btn-edges').addEventListener('click', () => {
      this.showEdges = !this.showEdges;
      this.shadowRoot.getElementById('btn-edges').innerText = this.showEdges ? '✏️ Aristas: ON' : '✏️ Aristas: OFF';
      for (const line of this.edgeLines) {
        line.visible = this.showEdges;
      }
    });

    this.shadowRoot.getElementById('btn-reset').addEventListener('click', () => {
      if (this.isAerialMode) {
        this.exitAerialScanMode();
      } else if (this.controls) {
        this.controls.reset();
      }
    });
  }

  updateRotateButtonLabel() {
    const btn = this.shadowRoot.getElementById('btn-rotate');
    if (btn) {
      btn.innerText = this.autoRotate ? '🔄 Auto-Giro: ON' : '⏸️ Auto-Giro: OFF';
    }
  }

  initThree() {
    const canvas = this.shadowRoot.getElementById('viewport');
    const width = this.clientWidth || 600;
    const height = this.clientHeight || 480;

    this.scene = new window.THREE.Scene();
    this.camera = new window.THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 1.8, 4.5);

    this.renderer = new window.THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = window.THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = window.THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputEncoding = window.THREE.sRGBEncoding;

    this.controls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 500;
    this.controls.minDistance = 0.5;
    this.controls.target.set(0, 1.2, 0);

    const hemiLight = new window.THREE.HemisphereLight(0xdce8f8, 0x3a2a24, 0.52);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const ambientLight = new window.THREE.AmbientLight(0xffffff, 0.20);
    this.scene.add(ambientLight);

    this.sunLight = new window.THREE.DirectionalLight(0xfff3d8, 1.85);
    this.sunLight.position.set(-30, 48, 22);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.bias = -0.0005;
    if ('normalBias' in this.sunLight.shadow) {
      this.sunLight.shadow.normalBias = 0.03;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.fillLight = new window.THREE.DirectionalLight(0x90b4e8, 0.35);
    this.fillLight.position.set(35, 18, -25);
    this.scene.add(this.fillLight);

    // Detectar clic corto sobre el modelo 3D para activar/salir de Vista Aérea 90°
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) {
        this.pointerDownInfo = { x: e.clientX, y: e.clientY, time: performance.now() };
      } else {
        this.pointerDownInfo = null;
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!this.pointerDownInfo || e.button !== 0) return;
      const dist = Math.hypot(e.clientX - this.pointerDownInfo.x, e.clientY - this.pointerDownInfo.y);
      const elapsed = performance.now() - this.pointerDownInfo.time;
      this.pointerDownInfo = null;
      if (dist >= 6 || elapsed > 400 || !this.modelPivot) return;

      const rect = canvas.getBoundingClientRect();
      const ndc = new window.THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new window.THREE.Raycaster();
      raycaster.setFromCamera(ndc, this.camera);
      const hits = raycaster.intersectObjects(this.modelPivot.children, true);
      if (hits.length > 0) {
        if (this.isAerialMode) {
          this.exitAerialScanMode();
        } else {
          this.enterAerialScanMode();
        }
      }
    });

    this.resizeObserver = new ResizeObserver(() => {
      const w = this.clientWidth;
      const h = this.clientHeight;
      if (w > 0 && h > 0) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    });
    this.resizeObserver.observe(this);

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);

      if (this.cameraAnim) {
        const now = performance.now();
        const rawT = Math.min(1, (now - this.cameraAnim.startTime) / this.cameraAnim.duration);
        const t = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        this.camera.position.lerpVectors(this.cameraAnim.fromPos, this.cameraAnim.toPos, t);
        this.controls.target.lerpVectors(this.cameraAnim.fromTarget, this.cameraAnim.toTarget, t);

        if (this.modelPivot && this.cameraAnim.toRotY !== null) {
          this.modelPivot.rotation.y =
            this.cameraAnim.fromRotY + (this.cameraAnim.toRotY - this.cameraAnim.fromRotY) * t;
        }

        if (this.aerialQrMesh && this.cameraAnim.fadeAerialTo !== null) {
          const fromOp = this.cameraAnim.fadeAerialFrom;
          const toOp = this.cameraAnim.fadeAerialTo;
          this.aerialQrMesh.material.opacity = fromOp + (toOp - fromOp) * t;
        }

        if (rawT >= 1) {
          const onComplete = this.cameraAnim.onComplete;
          this.cameraAnim = null;
          if (onComplete) onComplete();
        }
      } else if (this.autoRotate && this.modelPivot && !this.isAerialMode) {
        this.modelPivot.rotation.y += 0.006;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  computeMainModelBounds() {
    if (!this.currentModel) return null;
    const totemNode = this.currentModel.getObjectByName('QR_Totem_Integrated');
    const prevTotemVis = totemNode ? totemNode.visible : true;
    const prevEdgeVis = this.edgeLines.map((l) => l.visible);
    const prevAerialVis = this.aerialQrMesh ? this.aerialQrMesh.visible : false;

    if (totemNode) totemNode.visible = false;
    this.edgeLines.forEach((l) => (l.visible = false));
    if (this.aerialQrMesh) this.aerialQrMesh.visible = false;

    const prevRotY = this.modelPivot ? this.modelPivot.rotation.y : 0;
    if (this.modelPivot) {
      this.modelPivot.rotation.y = 0;
      this.modelPivot.updateMatrixWorld(true);
    }

    const box = new window.THREE.Box3();
    this.currentModel.traverse((child) => {
      if (!child.isMesh || !child.visible) return;
      if (totemNode && this.isDescendantOf(child, totemNode)) return;
      if (child === this.aerialQrMesh) return;
      box.expandByObject(child);
    });

    if (box.isEmpty()) {
      box.setFromObject(this.currentModel);
    }

    if (totemNode) totemNode.visible = prevTotemVis;
    this.edgeLines.forEach((l, i) => (l.visible = prevEdgeVis[i]));
    if (this.aerialQrMesh) this.aerialQrMesh.visible = prevAerialVis;
    if (this.modelPivot) {
      this.modelPivot.rotation.y = prevRotY;
      this.modelPivot.updateMatrixWorld(true);
    }

    const size = box.getSize(new window.THREE.Vector3());
    const center = box.getCenter(new window.THREE.Vector3());
    const side = Math.max(Math.min(size.x, size.z), Math.max(size.x, size.z) * 0.86);

    return { box, size, center, side };
  }

  isDescendantOf(node, ancestor) {
    let curr = node;
    while (curr) {
      if (curr === ancestor) return true;
      curr = curr.parent;
    }
    return false;
  }

  frameModelToCamera(rootObject) {
    const rawBox = new window.THREE.Box3().setFromObject(rootObject);
    if (!rawBox.isEmpty()) {
      const rawCenter = rawBox.getCenter(new window.THREE.Vector3());
      rootObject.position.x -= rawCenter.x;
      rootObject.position.z -= rawCenter.z;
      rootObject.position.y -= rawBox.min.y;
    }

    this.modelPivot.updateMatrixWorld(true);
    this.mainBounds = this.computeMainModelBounds();

    const centeredBox = new window.THREE.Box3().setFromObject(this.modelPivot);
    const sphere = centeredBox.getBoundingSphere(new window.THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.5);

    const fovRad = window.THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.max(0.5, this.camera.aspect || 1);
    const effectiveFov = Math.min(fovRad, 2 * Math.atan(Math.tan(fovRad / 2) * aspect));
    const dist = (radius / Math.sin(effectiveFov / 2)) * 0.96;

    this.camera.near = Math.max(0.05, radius * 0.01);
    this.camera.far = Math.max(250, dist + radius * 12);
    this.camera.updateProjectionMatrix();

    const target = sphere.center.clone();
    const cameraPos = new window.THREE.Vector3(
      target.x + dist * 0.48,
      target.y + dist * 0.36,
      target.z + dist * 0.80
    );

    this.defaultView = {
      target: target.clone(),
      cameraPos: cameraPos.clone()
    };

    this.controls.target.copy(target);
    this.camera.position.copy(cameraPos);
    this.controls.minDistance = Math.max(0.5, radius * 0.25);
    this.controls.maxDistance = Math.max(12, radius * 5.0);
    this.controls.update();
    this.controls.saveState();

    if (this.sunLight) {
      const r = Math.max(radius * 1.15, 2);
      this.sunLight.position.set(target.x - r * 1.15, target.y + r * 1.55, target.z + r * 0.75);
      this.sunLight.target.position.copy(target);
      this.sunLight.target.updateMatrixWorld();
      this.sunLight.shadow.camera.left = -r;
      this.sunLight.shadow.camera.right = r;
      this.sunLight.shadow.camera.top = r;
      this.sunLight.shadow.camera.bottom = -r;
      this.sunLight.shadow.camera.near = Math.max(0.1, r * 0.05);
      this.sunLight.shadow.camera.far = r * 5.0;
      this.sunLight.shadow.camera.updateProjectionMatrix();
    }
    if (this.fillLight) {
      this.fillLight.position.set(target.x + radius * 1.3, target.y + radius * 0.7, target.z - radius * 1.1);
    }
  }

  /**
   * Renderiza el modelo ortográficamente desde 90° arriba (sin totem auxiliar ni líneas negras)
   * para muestrear exactamente los colores cenitales visibles desde arriba.
   */
  sampleAerial90Colors() {
    if (!this.renderer || !this.scene || !this.modelPivot || !this.mainBounds) return null;
    if (this.aerialSamples) return this.aerialSamples;

    const { box, center, size, side } = this.mainBounds;
    const halfSide = Math.max(side * 0.5, 0.5);
    const res = 128;

    const orthoCam = new window.THREE.OrthographicCamera(
      -halfSide, halfSide, halfSide, -halfSide,
      0.1, size.y + 80
    );
    orthoCam.up.set(0, 0, -1);
    orthoCam.position.set(center.x, box.max.y + 30, center.z);
    orthoCam.lookAt(center.x, center.y, center.z);
    orthoCam.updateMatrixWorld(true);

    const totemNode = this.currentModel.getObjectByName('QR_Totem_Integrated');
    const prevTotemVis = totemNode ? totemNode.visible : true;
    const prevEdgeVis = this.edgeLines.map((l) => l.visible);
    const prevAerialVis = this.aerialQrMesh ? this.aerialQrMesh.visible : false;
    const prevRotY = this.modelPivot.rotation.y;

    if (totemNode) totemNode.visible = false;
    this.edgeLines.forEach((l) => (l.visible = false));
    if (this.aerialQrMesh) this.aerialQrMesh.visible = false;
    this.modelPivot.rotation.y = 0;
    this.modelPivot.updateMatrixWorld(true);

    const rt = new window.THREE.WebGLRenderTarget(res, res, {
      minFilter: window.THREE.LinearFilter,
      magFilter: window.THREE.LinearFilter,
      format: window.THREE.RGBAFormat
    });
    const prevTarget = this.renderer.getRenderTarget();
    const prevClearColor = new window.THREE.Color();
    this.renderer.getClearColor(prevClearColor);
    const prevClearAlpha = this.renderer.getClearAlpha();

    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, orthoCam);

    const rawPixels = new Uint8Array(res * res * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, res, res, rawPixels);

    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(prevClearColor, prevClearAlpha);
    rt.dispose();

    if (totemNode) totemNode.visible = prevTotemVis;
    this.edgeLines.forEach((l, i) => (l.visible = prevEdgeVis[i]));
    if (this.aerialQrMesh) this.aerialQrMesh.visible = prevAerialVis;
    this.modelPivot.rotation.y = prevRotY;
    this.modelPivot.updateMatrixWorld(true);

    // Encontrar banda vertical válida para clampear bordes si la maqueta es rectangular (p.ej. 72x56)
    let minValidRow = res - 1;
    let maxValidRow = 0;
    let minValidCol = res - 1;
    let maxValidCol = 0;
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const a = rawPixels[(y * res + x) * 4 + 3];
        if (a > 128) {
          if (y < minValidRow) minValidRow = y;
          if (y > maxValidRow) maxValidRow = y;
          if (x < minValidCol) minValidCol = x;
          if (x > maxValidCol) maxValidCol = x;
        }
      }
    }
    if (maxValidRow <= minValidRow) {
      minValidRow = 0; maxValidRow = res - 1;
      minValidCol = 0; maxValidCol = res - 1;
    }

    this.aerialSamples = {
      res,
      rawPixels,
      minValidRow,
      maxValidRow,
      minValidCol,
      maxValidCol
    };
    return this.aerialSamples;
  }

  sampleAerialColorAtUV(samples, u, v) {
    const { res, rawPixels, minValidRow, maxValidRow, minValidCol, maxValidCol } = samples;
    // Canvas v=0 (arriba, -Z) corresponde a WebGL py = res - 1
    const rawX = Math.round(u * (res - 1));
    const rawY = Math.round((1 - v) * (res - 1));
    const cx = Math.max(minValidCol, Math.min(maxValidCol, rawX));
    const cy = Math.max(minValidRow, Math.min(maxValidRow, rawY));

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const sx = Math.max(minValidCol, Math.min(maxValidCol, cx + dx));
        const sy = Math.max(minValidRow, Math.min(maxValidRow, cy + dy));
        const idx = (sy * res + sx) * 4;
        if (rawPixels[idx + 3] > 128) {
          rSum += rawPixels[idx];
          gSum += rawPixels[idx + 1];
          bSum += rawPixels[idx + 2];
          count++;
        }
      }
    }

    if (count === 0) return [30, 41, 59];
    // El render target WebGL almacena valores lineales; convertir a sRGB para Canvas 2D
    const toSrgb = (lin) => {
      const c = Math.max(0, Math.min(1, lin / 255));
      const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(255, s * 255)));
    };
    return [toSrgb(rSum / count), toSrgb(gSum / count), toSrgb(bSum / count)];
  }

  rgbToHsv(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      else if (max === gn) h = ((bn - rn) / d + 2) / 6;
      else h = ((rn - gn) / d + 4) / 6;
    }
    const s = max === 0 ? 0 : d / max;
    return [h, s, max];
  }

  hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  /**
   * Genera un canvas QR sólido y vívido donde cada píxel (oscuro y claro) adopta el color
   * muestreado desde 90° arriba con saturación alta y contraste legible sin aspecto transparente.
   */
  buildAerialColoredQrCanvas(matrix, samples, { pixelSize = 768 } = {}) {
    const N = matrix.size;
    const margin = 2;
    const total = N + margin * 2;
    const cell = pixelSize / total;

    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext('2d');

    // Fondo sólido luminoso de la zona de silencio (sin transparencia fantasmal)
    ctx.fillStyle = '#f6f8f2';
    ctx.fillRect(0, 0, pixelSize, pixelSize);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const bit = matrix.modules[r * N + c];
        const u = (c + 0.5) / N;
        const v = (r + 0.5) / N;
        const [sr, sg, sb] = this.sampleAerialColorAtUV(samples, u, v);
        const [h, s] = this.rgbToHsv(sr, sg, sb);

        const isFinder =
          (r < 8 && c < 8) ||
          (r < 8 && c >= N - 8) ||
          (r >= N - 8 && c < 8);

        if (bit === 1) {
          // Píxel oscuro: color saturado y vibrante fiel al material (verde, terracota, azul, ocre)
          const darkSat = s >= 0.10 ? Math.max(0.68, Math.min(0.96, s * 1.45)) : 0.10;
          const targetLum = isFinder ? 44 : 76;

          // Ajustar V en HSV hasta alcanzar la luminancia objetivo preservando el tono real
          let lo = 0.08, hi = 0.85;
          for (let step = 0; step < 8; step++) {
            const mid = (lo + hi) * 0.5;
            const [tr, tg, tb] = this.hsvToRgb(h, darkSat, mid);
            const lum = 0.299 * tr + 0.587 * tg + 0.114 * tb;
            if (lum < targetLum) lo = mid;
            else hi = mid;
          }
          const [dr, dg, db] = this.hsvToRgb(h, darkSat, (lo + hi) * 0.5);
          ctx.fillStyle = `rgb(${dr}, ${dg}, ${db})`;
        } else {
          // Píxel claro: mantiene color visible del modelo (verde claro, coral, celeste, crema) con luminancia >= 198
          const lightSat = isFinder
            ? Math.min(s, 0.22)
            : (s >= 0.10 ? Math.max(0.32, Math.min(0.58, s * 0.85)) : 0.05);
          let [lr, lg, lb] = this.hsvToRgb(h, lightSat, 0.98);
          const lum = 0.299 * lr + 0.587 * lg + 0.114 * lb;
          const minLightLum = isFinder ? 230 : 198;
          if (lum < minLightLum) {
            const lift = Math.min(1, (minLightLum - lum) / Math.max(1, 255 - lum));
            lr = Math.round(lr + (255 - lr) * lift);
            lg = Math.round(lg + (255 - lg) * lift);
            lb = Math.round(lb + (255 - lb) * lift);
          }
          ctx.fillStyle = `rgb(${lr}, ${lg}, ${lb})`;
        }

        const x = Math.floor((c + margin) * cell);
        const y = Math.floor((r + margin) * cell);
        const w = Math.ceil((c + margin + 1) * cell) - x;
        const hCell = Math.ceil((r + margin + 1) * cell) - y;
        ctx.fillRect(x, y, w, hCell);
      }
    }

    return canvas;
  }

  async fetchQrMatrix() {
    if (!this.qrId) return null;
    try {
      const res = await fetch(`${this.apiUrl}/api/qr/${this.qrId}/matrix?t=${Date.now()}`);
      if (!res.ok) return null;
      this.qrMatrixCache = await res.json();
      return this.qrMatrixCache;
    } catch {
      return null;
    }
  }

  async applyAerialColoredQr() {
    if (!this.currentModel || !this.mainBounds) return;
    const matrix = this.qrMatrixCache || (await this.fetchQrMatrix());
    const samples = this.sampleAerial90Colors();
    if (!matrix || !samples) return;

    // 1. Canvas sólido con los colores aéreos para el overlay 3D cenital sobre la maqueta
    const overlayCanvas = this.buildAerialColoredQrCanvas(matrix, samples, {
      pixelSize: 1024
    });

    if (!this.aerialQrMesh) {
      const side = this.mainBounds.side * 0.94;
      const geo = new window.THREE.PlaneGeometry(side, side);
      const tex = new window.THREE.CanvasTexture(overlayCanvas);
      tex.encoding = window.THREE.sRGBEncoding;
      const mat = new window.THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false
      });
      this.aerialQrMesh = new window.THREE.Mesh(geo, mat);
      this.aerialQrMesh.rotation.x = -Math.PI / 2;
      this.aerialQrMesh.position.set(
        this.mainBounds.center.x,
        this.mainBounds.box.max.y + 0.45,
        this.mainBounds.center.z
      );
      this.aerialQrMesh.renderOrder = 5;
      this.modelPivot.add(this.aerialQrMesh);
    } else {
      const tex = new window.THREE.CanvasTexture(overlayCanvas);
      tex.encoding = window.THREE.sRGBEncoding;
      if (this.aerialQrMesh.material.map) this.aerialQrMesh.material.map.dispose();
      this.aerialQrMesh.material.map = tex;
      this.aerialQrMesh.material.needsUpdate = true;
    }
    this.aerialQrMesh.visible = true;

    // 2. Canvas sólido con los colores aéreos para la tarjeta 2D y el totem 3D
    const opaqueCanvas = this.buildAerialColoredQrCanvas(matrix, samples, {
      pixelSize: 512
    });

    const qrImg = this.shadowRoot.getElementById('qr-preview-img');
    if (qrImg) {
      qrImg.src = opaqueCanvas.toDataURL('image/png');
    }

    if (this.qrMaterials.length > 0) {
      const tex3d = new window.THREE.CanvasTexture(opaqueCanvas);
      tex3d.flipY = false;
      tex3d.encoding = window.THREE.sRGBEncoding;
      tex3d.needsUpdate = true;
      for (const mat of this.qrMaterials) {
        if (mat.map) mat.map.dispose();
        mat.map = tex3d;
        mat.needsUpdate = true;
      }
    }
  }

  async enterAerialScanMode() {
    if (!this.currentModel || !this.mainBounds || !this.camera || !this.controls) return;

    if (!this.isAerialMode) {
      this.autoRotateBeforeAerial = this.autoRotate;
    }
    this.isAerialMode = true;
    this.autoRotate = false;
    this.updateRotateButtonLabel();

    const btnAerial = this.shadowRoot.getElementById('btn-aerial');
    const badge = this.shadowRoot.getElementById('qr-badge');
    const badgeTitle = this.shadowRoot.getElementById('qr-badge-title');
    const badgeSub = this.shadowRoot.getElementById('qr-badge-sub');
    const hint = this.shadowRoot.getElementById('hint-3d');

    if (btnAerial) {
      btnAerial.classList.add('active');
      btnAerial.innerText = '↩️ Volver a 3D';
    }
    if (badge) badge.classList.add('aerial-active');
    if (badgeTitle) badgeTitle.innerText = 'QR Aéreo 90°';
    if (badgeSub) badgeSub.innerText = 'Colores tomados de la vista 90°';
    if (hint) hint.innerText = '🛸 Vista Aérea 90° activa · Escanea el QR cromático o haz clic para volver';

    // Generar muestras cenitales y aplicar los colores al QR
    await this.applyAerialColoredQr();

    // Calcular cámara cenital a 90° centrada sobre el modelo principal
    const { center, side } = this.mainBounds;
    const halfSide = Math.max(side * 0.5, 0.5);
    const vFov = window.THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.max(0.5, this.camera.aspect || 1);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const limitingFov = Math.min(vFov, hFov);
    const aerialDist = (halfSide / Math.tan(limitingFov / 2)) * 1.40;

    const toTarget = center.clone();
    const toPos = new window.THREE.Vector3(
      center.x,
      center.y + aerialDist,
      center.z + aerialDist * 0.0025
    );

    const twoPi = Math.PI * 2;
    let rotY = ((this.modelPivot.rotation.y % twoPi) + twoPi) % twoPi;
    if (rotY > Math.PI) rotY -= twoPi;
    this.modelPivot.rotation.y = rotY;

    this.cameraAnim = {
      startTime: performance.now(),
      duration: 700,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
      fromRotY: rotY,
      toRotY: 0,
      fadeAerialFrom: this.aerialQrMesh ? this.aerialQrMesh.material.opacity : 0,
      fadeAerialTo: 1,
      onComplete: null
    };
  }

  exitAerialScanMode() {
    if (!this.isAerialMode) return;
    this.isAerialMode = false;
    this.autoRotate = this.autoRotateBeforeAerial;
    this.updateRotateButtonLabel();

    const btnAerial = this.shadowRoot.getElementById('btn-aerial');
    const badge = this.shadowRoot.getElementById('qr-badge');
    const badgeTitle = this.shadowRoot.getElementById('qr-badge-title');
    const badgeSub = this.shadowRoot.getElementById('qr-badge-sub');
    const hint = this.shadowRoot.getElementById('hint-3d');

    if (btnAerial) {
      btnAerial.classList.remove('active');
      btnAerial.innerText = '🛸 Escanear 90°';
    }
    if (badge) badge.classList.remove('aerial-active');
    if (badgeTitle) badgeTitle.innerText = 'QR Dinámico';
    if (badgeSub) badgeSub.innerText = 'Clic para escanear 90°';
    if (hint) hint.innerText = '🖱️ Clic en el modelo: Vista aérea 90° · Arrastra para girar';

    // Restaurar imagen estándar del QR
    const standardUrl = `${this.apiUrl}/api/qr/${this.qrId}/image?t=${Date.now()}`;
    this.updateQrBadgeOnly(standardUrl);
    this.updateModelQrTexture(standardUrl);

    if (this.defaultView) {
      this.cameraAnim = {
        startTime: performance.now(),
        duration: 650,
        fromPos: this.camera.position.clone(),
        toPos: this.defaultView.cameraPos.clone(),
        fromTarget: this.controls.target.clone(),
        toTarget: this.defaultView.target.clone(),
        fromRotY: this.modelPivot ? this.modelPivot.rotation.y : 0,
        toRotY: null,
        fadeAerialFrom: this.aerialQrMesh ? this.aerialQrMesh.material.opacity : 0,
        fadeAerialTo: 0,
        onComplete: () => {
          if (this.aerialQrMesh) this.aerialQrMesh.visible = false;
        }
      };
    } else if (this.aerialQrMesh) {
      this.aerialQrMesh.visible = false;
    }
  }

  loadModel() {
    if (!this.qrId) return;

    const qrImg = this.shadowRoot.getElementById('qr-preview-img');
    const initialQrUrl = `${this.apiUrl}/api/qr/${this.qrId}/image?t=${Date.now()}`;
    qrImg.src = initialQrUrl;

    // Pre-cargar matriz binaria del QR para modo aéreo instantáneo
    this.fetchQrMatrix();

    const loaderEl = this.shadowRoot.getElementById('loader');
    const modelUrl = `${this.apiUrl}/api/qr/${this.qrId}/model`;

    const loader = new window.THREE.GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        if (this.modelPivot) {
          this.scene.remove(this.modelPivot);
        }

        this.currentModel = gltf.scene;
        this.qrMaterials = [];
        this.edgeLines = [];
        this.aerialSamples = null;
        this.aerialQrMesh = null;

        const edgeMaterial = new window.THREE.LineBasicMaterial({
          color: 0x0f1218,
          transparent: true,
          opacity: 0.58
        });

        this.currentModel.traverse((child) => {
          if (!child.isMesh || !child.material) return;
          child.castShadow = true;
          child.receiveShadow = true;

          const mats = Array.isArray(child.material) ? child.material : [child.material];
          let isQrMesh = false;
          for (const mat of mats) {
            if (!mat.transparent) {
              mat.polygonOffset = true;
              mat.polygonOffsetFactor = 1;
              mat.polygonOffsetUnits = 1;
            }
            const matName = (mat.name || '').toLowerCase();
            const texName = (mat.map && mat.map.name ? mat.map.name : '').toLowerCase();
            if (
              matName.includes('qr') ||
              matName.includes('screen') ||
              matName.includes('display') ||
              texName.includes('qr_texture')
            ) {
              isQrMesh = true;
              if (!this.qrMaterials.includes(mat)) {
                this.qrMaterials.push(mat);
              }
            }
          }

          if (!isQrMesh && child.geometry) {
            const posAttr = child.geometry.attributes && child.geometry.attributes.position;
            if (posAttr && posAttr.count < 30000) {
              const edgesGeo = new window.THREE.EdgesGeometry(child.geometry, 26);
              const lines = new window.THREE.LineSegments(edgesGeo, edgeMaterial);
              lines.visible = this.showEdges;
              child.add(lines);
              this.edgeLines.push(lines);
            }
          }
        });

        this.modelPivot = new window.THREE.Group();
        this.modelPivot.add(this.currentModel);
        this.scene.add(this.modelPivot);
        this.frameModelToCamera(this.currentModel);

        loaderEl.style.opacity = '0';
        setTimeout(() => (loaderEl.style.display = 'none'), 300);

        if (this.aerialRequested) {
          this.enterAerialScanMode();
        }
      },
      undefined,
      (err) => {
        console.warn('Error al cargar modelo GLB:', err);
        loaderEl.innerHTML = `<span style="color:#f87171">⚠️ No se pudo cargar el modelo 3D</span>`;
      }
    );
  }

  initRealtimeSSE() {
    if (!this.qrId) return;

    const sseUrl = `${this.apiUrl}/api/qr/${this.qrId}/events`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Al ocurrir un escaneo o rotación se actualiza el QR sin recargar la página ni el modelo 3D
        if (data.type === 'qr_updated') {
          await this.fetchQrMatrix();
          if (this.isAerialMode) {
            await this.applyAerialColoredQr();
          } else {
            this.updateQrBadgeOnly(data.newQrImageUrl);
            this.updateModelQrTexture(data.newQrImageUrl);
          }
          this.showScanToast();
        }
      } catch (err) {
        // Ignorar heartbeats u otros mensajes planos
      }
    };

    this.eventSource.onerror = () => {
      // Reconexión automática según estándar SSE
    };
  }

  updateQrBadgeOnly(newImageUrl) {
    const qrImg = this.shadowRoot.getElementById('qr-preview-img');
    if (!qrImg) return;

    qrImg.classList.add('updating');

    setTimeout(() => {
      qrImg.src = newImageUrl;
      qrImg.onload = () => {
        qrImg.classList.remove('updating');
      };
    }, 200);
  }

  updateModelQrTexture(newImageUrl) {
    if (!this.qrMaterials || this.qrMaterials.length === 0 || !window.THREE) return;
    const texLoader = new window.THREE.TextureLoader();
    texLoader.setCrossOrigin('anonymous');
    texLoader.load(newImageUrl, (texture) => {
      texture.flipY = false;
      texture.encoding = window.THREE.sRGBEncoding;
      texture.needsUpdate = true;
      for (const mat of this.qrMaterials) {
        if (mat.map) mat.map.dispose();
        mat.map = texture;
        mat.needsUpdate = true;
      }
    });
  }

  showScanToast() {
    const toast = this.shadowRoot.getElementById('scan-toast');
    if (!toast) return;

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
}

if (!customElements.get('qr-3d-viewer')) {
  customElements.define('qr-3d-viewer', Qr3dViewer);
}

export default Qr3dViewer;
