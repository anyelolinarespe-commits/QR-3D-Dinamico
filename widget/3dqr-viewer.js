/**
 * 3D QR Viewer - Web Component Embebible
 * Renderiza modelos 3D interactivos con Three.js y actualiza en tiempo real
 * códigos QR desechables sin recargar la página ni el modelo 3D.
 * Incluye modo Vista Aérea 90° que muestrea los colores cenitales del modelo
 * y los proyecta en los recuadros del código QR manteniendo la legibilidad,
 * además de perfiles Automático y Manual para iluminación, aristas, color y encuadre.
 */

import { renderIcon } from './icons.js';

export const VIEWER_PRESETS = {
  auto: {
    mode: 'auto',
    preset: 'auto',
    exposure: 0.96,
    sunAzimuth: -108,
    sunElevation: 40,
    sunIntensity: 1.55,
    sunMode: 'scene',
    ambientIntensity: 0.18,
    colorBoost: 1.04,
    fixSrgb: 'auto',
    edgeMode: 'smart',
    backgroundPreset: 'warm_dark',
    backgroundColor: '#1a1612',
    showTotem: true,
    autoRotate: true,
    cameraMode: 'smooth',
    cameraPose: null,
    uiTheme: 'auto',
    accentColor: null,
    surfaceColor: null,
    textColor: null,
    showToolbar: true,
    showHint: true,
    qrRevealStyle: 'blocks'
  },
  archaeological: {
    mode: 'manual',
    preset: 'archaeological',
    exposure: 0.92,
    sunAzimuth: -108,
    sunElevation: 38,
    sunIntensity: 1.65,
    sunMode: 'scene',
    ambientIntensity: 0.14,
    colorBoost: 1.12,
    fixSrgb: 'auto',
    edgeMode: 'smart',
    backgroundPreset: 'warm_dark',
    backgroundColor: '#1a1612',
    showTotem: true,
    autoRotate: true,
    cameraMode: 'smooth',
    cameraPose: null,
    uiTheme: 'dark',
    accentColor: null,
    surfaceColor: null,
    textColor: null,
    showToolbar: true,
    showHint: true,
    qrRevealStyle: 'blocks'
  },
  museum_night: {
    mode: 'manual',
    preset: 'museum_night',
    exposure: 1.0,
    sunAzimuth: -52,
    sunElevation: 48,
    sunIntensity: 1.75,
    sunMode: 'scene',
    ambientIntensity: 0.12,
    colorBoost: 1.1,
    fixSrgb: 'auto',
    edgeMode: 'smart',
    backgroundPreset: 'night',
    backgroundColor: '#090b10',
    showTotem: true,
    autoRotate: true,
    cameraMode: 'smooth',
    cameraPose: null,
    uiTheme: 'dark',
    accentColor: null,
    surfaceColor: null,
    textColor: null,
    showToolbar: true,
    showHint: true,
    qrRevealStyle: 'blocks'
  },
  studio: {
    mode: 'manual',
    preset: 'studio',
    exposure: 1.02,
    sunAzimuth: -45,
    sunElevation: 52,
    sunIntensity: 1.35,
    sunMode: 'scene',
    ambientIntensity: 0.42,
    colorBoost: 1.0,
    fixSrgb: 'auto',
    edgeMode: 'smart',
    backgroundPreset: 'light_studio',
    backgroundColor: '#e2e8f0',
    showTotem: true,
    autoRotate: true,
    cameraMode: 'smooth',
    cameraPose: null,
    uiTheme: 'light',
    accentColor: null,
    surfaceColor: null,
    textColor: null,
    showToolbar: true,
    showHint: true,
    qrRevealStyle: 'blocks'
  },
  outdoor: {
    mode: 'manual',
    preset: 'outdoor',
    exposure: 0.98,
    sunAzimuth: -120,
    sunElevation: 55,
    sunIntensity: 1.55,
    sunMode: 'scene',
    ambientIntensity: 0.34,
    colorBoost: 1.05,
    fixSrgb: 'auto',
    edgeMode: 'off',
    backgroundPreset: 'outdoor',
    backgroundColor: '#cfe4f2',
    showTotem: true,
    autoRotate: true,
    cameraMode: 'smooth',
    cameraPose: null,
    uiTheme: 'light',
    accentColor: null,
    surfaceColor: null,
    textColor: null,
    showToolbar: true,
    showHint: true,
    qrRevealStyle: 'blocks'
  },
  warm_sand: {
    mode: 'manual',
    preset: 'warm_sand',
    exposure: 1.0,
    sunAzimuth: -108,
    sunElevation: 44,
    sunIntensity: 1.48,
    sunMode: 'scene',
    ambientIntensity: 0.36,
    colorBoost: 1.06,
    fixSrgb: 'auto',
    edgeMode: 'smart',
    backgroundPreset: 'warm_sand',
    backgroundColor: '#eae1d0',
    showTotem: true,
    autoRotate: true,
    cameraMode: 'smooth',
    cameraPose: null,
    uiTheme: 'light',
    accentColor: '#0f3d2e',
    surfaceColor: '#ffffff',
    textColor: '#0f3d2e',
    showToolbar: true,
    showHint: true,
    qrRevealStyle: 'blocks'
  },
  transparent: {
    mode: 'manual',
    preset: 'transparent',
    exposure: 0.98,
    sunAzimuth: -108,
    sunElevation: 42,
    sunIntensity: 1.52,
    sunMode: 'scene',
    ambientIntensity: 0.28,
    colorBoost: 1.05,
    fixSrgb: 'auto',
    edgeMode: 'smart',
    backgroundPreset: 'transparent',
    backgroundColor: '#eae1d0',
    showTotem: true,
    autoRotate: true,
    cameraMode: 'smooth',
    cameraPose: null,
    uiTheme: 'auto',
    accentColor: null,
    surfaceColor: null,
    textColor: null,
    showToolbar: true,
    showHint: true,
    qrRevealStyle: 'blocks'
  }
};

export const BACKGROUND_STYLES = {
  auto: {
    css: 'radial-gradient(circle at 50% 38%, #26201b 0%, #12100e 100%)',
    hex: '#1c1814',
    light: false
  },
  warm_dark: {
    css: 'radial-gradient(circle at 50% 38%, #26201b 0%, #12100e 100%)',
    hex: '#1c1814',
    light: false
  },
  slate: {
    css: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 100%)',
    hex: '#172033',
    light: false
  },
  night: {
    css: 'radial-gradient(circle at 50% 35%, #161822 0%, #07080d 100%)',
    hex: '#0e1018',
    light: false
  },
  light_studio: {
    css: 'radial-gradient(circle at 50% 35%, #f8fafc 0%, #cbd5e1 100%)',
    hex: '#e2e8f0',
    light: true
  },
  outdoor: {
    css: 'radial-gradient(circle at 50% 25%, #bae6fd 0%, #e0f2fe 58%, #cbd5e1 100%)',
    hex: '#d5eaf7',
    light: true
  },
  warm_sand: {
    css: 'radial-gradient(circle at 50% 35%, #f5efe4 0%, #dfd4c1 100%)',
    hex: '#eae1d0',
    light: true
  },
  transparent: {
    css: 'transparent',
    hex: null,
    light: true
  }
};

const THEME_ALIASES = {
  light: 'warm_sand',
  dark: 'warm_dark',
  munay: 'warm_sand'
};

function sanitizeViewerHex(val) {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null;
}

function srgbToLinearChannel(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

class Qr3dViewer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.apiUrl = this.getAttribute('api-url') || window.location.origin;
    this.qrId = this.getAttribute('qr-id');
    this.viewToken = this.getAttribute('view-token') || null;
    this.hideBadge = this.readBoolAttr('hide-badge') === true;
    this.showAr = this.readBoolAttr('show-ar') === true;
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
    this.smartEdgeLines = [];
    this.allEdgeLines = [];
    this.edgeTargetMeshes = [];
    this.sunLight = null;
    this.fillLight = null;
    this.hemiLight = null;
    this.ambientLight = null;
    this.resizeObserver = null;
    this.hasExplicitShowEdgesAttr = this.hasAttribute('show-edges');
    this.hasExplicitAutoRotateAttr = this.hasAttribute('auto-rotate');
    this.showEdges = this.getAttribute('show-edges') !== 'false';
    this.autoRotate = this.getAttribute('auto-rotate') !== 'false';
    this.aerialRequested = this.readBoolAttr('aerial-scan') === true;

    this.viewerConfig = { ...VIEWER_PRESETS.auto };
    this._lastActiveEdgeMode = 'smart';
    this._attrOverrides = {};
    this._userToolbarOverrides = {};
    this._hasLocalToolbarEdits = false;
    this._reloadScheduled = false;
    this._hasInitializedScene = false;
    this.modelStats = { generator: '', isLegacyThreeExporter: false };
    this.framingCenter = null;
    this.localLightingCenter = null;
    this.framingRadius = 2;
    this._lightingState = null;
    this._yAxis = null;

    // Estado de Vista Aérea 90° y QR cromático (y animación en bloques)
    this.isAerialMode = false;
    this.autoRotateBeforeAerial = this.autoRotate;
    this.defaultView = null;
    this.mainBounds = null;
    this.cameraAnim = null;
    this.aerialQrMesh = null;
    this.aerialQrBackingMesh = null;
    this.aerialBlocksMesh = null;
    this._aerialBlockData = null;
    this.aerialSamples = null;
    this.qrMatrixCache = null;
    this._modelRevealSnapshot = null;
    this.pointerDownInfo = null;

    // Estado de optimización de renderizado y AR
    this._isPageVisible = typeof document !== 'undefined' ? !document.hidden : true;
    this._isInViewport = true;
    this._isInteracting = false;
    this._pauseAutoRotateUntil = 0;
    this._lastShadowRotY = null;
    this._activeUntil = 0;
    this._inFrame = false;
    this._lastFrameTime = 0;
    this._lastWidth = 0;
    this._lastHeight = 0;
    this.intersectionObserver = null;
    this._arToastTimer = null;
    this._webXrSupported = null;
    this._xrSession = null;
    this._xrOverlayEl = null;
    this._xrHitTestSource = null;
    this._xrHitTestRequested = false;
    this._xrHitTestResultLast = null;
    this._xrAnchor = null;
    this._xrAnchorPromise = null;
    this._xrReticle = null;
    this._xrGroundShadow = null;
    this._xrController = null;
    this._xrPlaced = false;
    this._xrLocked = false;
    this._xrStartedAt = 0;
    this._xrScaleFactor = 1;
    this._xrRotYOffset = 0;
    this._xrBaseFloorLift = 0;
    this._xrAnchorPos = null;
    this._xrSavedState = null;
    this._arCameraStream = null;
    this._isCameraArActive = false;
    this._arCameraFacing = 'environment';
    this._arCameraBaseScale = 1;
    this._arCameraSavedState = null;
    this._camArHasGyro = false;
    this._camArAnchored = false;
    this._camArOrientation = null;
    this._camArScreenAngle = 0;
    this._camArBaseYaw = 0;
    this._camArAnchorDir = null;
    this._camArAnchorDistance = 1.8;
    this._camArElevOffset = 0;
    this._camArRotYOffset = 0;
    this._camArScaleFactor = 1;
    this._camArTouchState = null;
    this._camArCleanupFn = null;
    this._slamSessionActive = false;
    this._slamOverlayEl = null;
    this._slamReticle = null;
    this._slamGroundShadow = null;
    this._slamSavedState = null;
    this._slamScaleFactor = 1;
    this._slamRotYOffset = 0;
    this._slamAnchorPos = null;
    this._xr8LoadPromise = null;
    this._arModalOpen = false;
    this._onVisibilityChange = () => {
      this._isPageVisible = !document.hidden;
      if (this._isPageVisible) {
        this.requestRender({ durationMs: 1200 });
      }
    };
  }

  readBoolAttr(name) {
    if (!this.hasAttribute(name)) return null;
    const raw = (this.getAttribute(name) || '').trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
    return true;
  }

  collectAttributeOverrides() {
    const overrides = {};
    const rawTheme = (this.getAttribute('theme') || '').trim().toLowerCase();
    const resolvedTheme = THEME_ALIASES[rawTheme] || rawTheme;
    if (resolvedTheme && VIEWER_PRESETS[resolvedTheme]) {
      Object.assign(overrides, VIEWER_PRESETS[resolvedTheme]);
    }

    const bgPresetAttr = (this.getAttribute('bg-preset') || '').trim().toLowerCase();
    if (bgPresetAttr && (BACKGROUND_STYLES[bgPresetAttr] || bgPresetAttr === 'custom')) {
      overrides.backgroundPreset = bgPresetAttr;
    }

    const bgColorRaw = (this.getAttribute('bg-color') || '').trim();
    if (bgColorRaw.toLowerCase() === 'transparent') {
      overrides.backgroundPreset = 'transparent';
    } else {
      const hexBg = sanitizeViewerHex(bgColorRaw);
      if (hexBg) {
        overrides.backgroundPreset = 'custom';
        overrides.backgroundColor = hexBg;
      }
    }

    const transparentAttr = this.readBoolAttr('transparent');
    if (transparentAttr === true) {
      overrides.backgroundPreset = 'transparent';
    } else if (transparentAttr === false && !bgPresetAttr && !bgColorRaw && !resolvedTheme) {
      overrides.backgroundPreset = 'warm_dark';
    }

    const uiThemeAttr = (this.getAttribute('ui-theme') || '').trim().toLowerCase();
    if (['auto', 'light', 'dark', 'custom'].includes(uiThemeAttr)) {
      overrides.uiTheme = uiThemeAttr;
    }

    const accentHex = sanitizeViewerHex(this.getAttribute('accent-color'));
    if (accentHex) overrides.accentColor = accentHex;

    const surfaceHex = sanitizeViewerHex(this.getAttribute('surface-color'));
    if (surfaceHex) overrides.surfaceColor = surfaceHex;

    const textHex = sanitizeViewerHex(this.getAttribute('text-color'));
    if (textHex) overrides.textColor = textHex;

    const hideToolbarAttr = this.readBoolAttr('hide-toolbar');
    if (hideToolbarAttr !== null) {
      overrides.showToolbar = !hideToolbarAttr;
    }

    const hideHintAttr = this.readBoolAttr('hide-hint');
    if (hideHintAttr !== null) {
      overrides.showHint = !hideHintAttr;
    }

    const showTotemAttr = this.readBoolAttr('show-totem');
    if (showTotemAttr !== null) {
      overrides.showTotem = showTotemAttr;
    }

    const autoRotateAttr = this.readBoolAttr('auto-rotate');
    if (autoRotateAttr !== null) {
      overrides.autoRotate = autoRotateAttr;
    }

    const showEdgesAttr = this.readBoolAttr('show-edges');
    const edgeModeAttr = (this.getAttribute('edge-mode') || '').trim().toLowerCase();
    if (['smart', 'all', 'off'].includes(edgeModeAttr)) {
      overrides.edgeMode = edgeModeAttr;
    } else if (showEdgesAttr !== null) {
      overrides.edgeMode = showEdgesAttr ? 'smart' : 'off';
    }

    const camModeAttr = (this.getAttribute('camera-mode') || '').trim().toLowerCase();
    if (['smooth', 'direct'].includes(camModeAttr)) {
      overrides.cameraMode = camModeAttr;
    }

    const revealAttr = (this.getAttribute('qr-reveal') || '').trim().toLowerCase();
    if (['fade', 'blocks'].includes(revealAttr)) {
      overrides.qrRevealStyle = revealAttr;
    }

    this._attrOverrides = overrides;
    return overrides;
  }

  static get observedAttributes() {
    return [
      'qr-id',
      'view-token',
      'api-url',
      'auto-rotate',
      'aerial-scan',
      'hide-badge',
      'show-ar',
      'hide-toolbar',
      'hide-hint',
      'flat',
      'transparent',
      'theme',
      'ui-theme',
      'bg-preset',
      'bg-color',
      'accent-color',
      'surface-color',
      'text-color',
      'show-totem',
      'show-edges',
      'edge-mode',
      'camera-mode',
      'qr-reveal',
      'viewer-config'
    ];
  }

  scheduleReloadSource() {
    if (!this.isConnected || !this._hasInitializedScene || this._reloadScheduled) return;
    this._reloadScheduled = true;
    queueMicrotask(() => {
      this._reloadScheduled = false;
      if (!this.isConnected) return;
      this.reloadSource();
    });
  }

  reloadSource() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isAerialMode = false;
    this.cameraAnim = null;
    this.aerialSamples = null;
    this.qrMatrixCache = null;
    this._modelRevealSnapshot = null;
    if (this.aerialBlocksMesh) {
      if (this.aerialBlocksMesh.parent) this.aerialBlocksMesh.parent.remove(this.aerialBlocksMesh);
      if (this.aerialBlocksMesh.geometry) this.aerialBlocksMesh.geometry.dispose();
      if (this.aerialBlocksMesh.material) this.aerialBlocksMesh.material.dispose();
      this.aerialBlocksMesh = null;
      this._aerialBlockData = null;
    }
    if (this.aerialQrBackingMesh) {
      if (this.aerialQrBackingMesh.parent) this.aerialQrBackingMesh.parent.remove(this.aerialQrBackingMesh);
      if (this.aerialQrBackingMesh.geometry) this.aerialQrBackingMesh.geometry.dispose();
      if (this.aerialQrBackingMesh.material) this.aerialQrBackingMesh.material.dispose();
      this.aerialQrBackingMesh = null;
    }
    const loaderEl = this.shadowRoot && this.shadowRoot.getElementById('loader');
    if (loaderEl) {
      loaderEl.style.display = 'flex';
      loaderEl.style.opacity = '1';
      loaderEl.innerHTML = `<div class="spinner"></div><span>Cargando modelo 3D...</span>`;
    }
    this.loadModel();
    this.initRealtimeSSE();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'qr-id') {
      this.qrId = newValue;
      this.scheduleReloadSource();
      return;
    }
    if (name === 'view-token') {
      this.viewToken = newValue || null;
      this.scheduleReloadSource();
      return;
    }
    if (name === 'api-url') {
      this.apiUrl = newValue || window.location.origin;
      this.scheduleReloadSource();
      return;
    }
    if (name === 'hide-badge') {
      this.hideBadge = this.readBoolAttr('hide-badge') === true;
      return;
    }
    if (name === 'show-ar') {
      this.showAr = this.readBoolAttr('show-ar') === true;
      if (this.shadowRoot && this.shadowRoot.host) {
        this.shadowRoot.host.classList.toggle('ar-enabled', this.showAr);
      }
      return;
    }
    if (name === 'viewer-config' && newValue) {
      try {
        const parsed = JSON.parse(newValue);
        if (parsed && typeof parsed === 'object') {
          this.setViewerConfig(parsed, { applyCamera: Boolean(this.currentModel) });
        }
      } catch {
        // Ignorar JSON inválido
      }
      return;
    }
    if (name === 'aerial-scan') {
      const wantAerial = this.readBoolAttr('aerial-scan') === true;
      this.aerialRequested = wantAerial;
      if (this.currentModel) {
        if (wantAerial && !this.isAerialMode) this.enterAerialScanMode();
        if (!wantAerial && this.isAerialMode) this.exitAerialScanMode();
      }
      return;
    }

    this.hasExplicitShowEdgesAttr = this.hasAttribute('show-edges');
    this.hasExplicitAutoRotateAttr = this.hasAttribute('auto-rotate');
    if (name === 'auto-rotate') {
      this.autoRotate = newValue !== 'false';
      if (this.isConnected) {
        this.updateRotateButtonLabel();
        if (this.autoRotate) this.requestRender();
      }
    }
    const overrides = this.collectAttributeOverrides();
    if (this.isConnected) {
      this.setViewerConfig(overrides, { applyCamera: false });
    }
  }

  getEndpoint(kind) {
    const totemHidden = this.viewerConfig && this.viewerConfig.showTotem === false;
    if (this.viewToken) {
      const base = `${this.apiUrl}/view/${this.viewToken}`;
      if (kind === 'meta') return `${base}/meta`;
      if (kind === 'model') return `${base}/model`;
      if (kind === 'arModel') return `${base}/model.glb?ar=1${totemHidden ? '&totem=0' : ''}`;
      if (kind === 'usdz') return `${base}/model.usdz${totemHidden ? '?totem=0' : ''}`;
      if (kind === 'viewQr') return `${base}/view-qr`;
      if (kind === 'image') return `${base}/image`;
      if (kind === 'matrix') return `${base}/matrix`;
      if (kind === 'events') return `${base}/events`;
    }
    if (this.qrId) {
      const base = `${this.apiUrl}/api/qr/${this.qrId}`;
      if (kind === 'meta') return base;
      if (kind === 'model') return `${base}/model`;
      if (kind === 'arModel') return `${base}/model.glb?ar=1${totemHidden ? '&totem=0' : ''}`;
      if (kind === 'usdz') return `${base}/model.usdz${totemHidden ? '?totem=0' : ''}`;
      if (kind === 'viewQr') return `${base}/view-qr`;
      if (kind === 'image') return `${base}/image`;
      if (kind === 'matrix') return `${base}/matrix`;
      if (kind === 'events') return `${base}/events`;
    }
    return null;
  }

  getPublicViewUrl() {
    if (this.viewToken) {
      return new URL(`${this.apiUrl}/view/${this.viewToken}/ar`, window.location.origin).href;
    }
    return window.location.href;
  }

  connectedCallback() {
    this.hideBadge = this.readBoolAttr('hide-badge') === true;
    this.showAr = this.readBoolAttr('show-ar') === true;
    this.aerialRequested = this.readBoolAttr('aerial-scan') === true;
    const rawCfgAttr = this.getAttribute('viewer-config');
    if (rawCfgAttr) {
      try {
        const parsedCfg = JSON.parse(rawCfgAttr);
        if (parsedCfg && typeof parsedCfg === 'object') {
          this.viewerConfig = { ...VIEWER_PRESETS.auto, ...parsedCfg };
          if (this.viewerConfig.edgeMode && this.viewerConfig.edgeMode !== 'off') {
            this._lastActiveEdgeMode = this.viewerConfig.edgeMode;
          }
          if (!this.hasExplicitAutoRotateAttr) {
            this.autoRotate = this.viewerConfig.autoRotate !== false;
          }
        }
      } catch {
        // Ignorar JSON inválido y cargar desde /meta
      }
    } else if (this.hasExplicitAutoRotateAttr) {
      this.viewerConfig.autoRotate = this.autoRotate;
    }
    const attrOverrides = this.collectAttributeOverrides();
    this.viewerConfig = { ...this.viewerConfig, ...attrOverrides };
    if (attrOverrides.autoRotate !== undefined) {
      this.autoRotate = attrOverrides.autoRotate;
    }
    this.render();
    if (this.shadowRoot && this.shadowRoot.host) {
      this.shadowRoot.host.classList.toggle('ar-enabled', this.showAr);
    }
    this.applyBackgroundStyle();
    this.updateRotateButtonLabel();
    this.updateEdgesButtonLabel();
    this.updateCameraModeButtonLabel();
    this.updateSunModeButtonLabel();
    this.probeArCapabilities();
    let pendingSceneViewerFallback = false;
    try {
      const curParams = new URLSearchParams(window.location.search);
      if (curParams.get('ar_fb') === 'sv') {
        pendingSceneViewerFallback = true;
        curParams.delete('ar_fb');
        const cleanQuery = curParams.toString();
        const cleanUrl = `${window.location.pathname}${cleanQuery ? '?' + cleanQuery : ''}${window.location.hash}`;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch {}
    this.loadDependencies().then(() => {
      if (!this.isConnected) return;
      this.initThree();
      this._hasInitializedScene = true;
      this.loadModel();
      this.initRealtimeSSE();
      if (this.showAr) {
        this.loadXr8SlamEngine().catch(() => {});
      }
      if (pendingSceneViewerFallback && this.showAr) {
        this.openArModal({ modeHint: 'sceneviewer-fallback' });
      }
    });
  }

  disconnectedCallback() {
    this.stopSlamCameraAR({ silent: true });
    this.stopCameraAR({ silent: true });
    this.stopWebXrAR();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
    if (this.eventSource) {
      this.eventSource.close();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
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

  /** Precarga bajo demanda el motor 6DoF Visual-Inertial SLAM (@8thwall/engine-binary) tras asegurar THREE. */
  loadXr8SlamEngine() {
    if (window.XR8 && window.XR8.XrController && window.XR8.Threejs) {
      return Promise.resolve(window.XR8);
    }
    if (this._xr8LoadPromise) return this._xr8LoadPromise;

    this._xr8LoadPromise = (async () => {
      await this.loadDependencies();
      const src = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js';
      await new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          if (window.XR8) return resolve();
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Error cargando xr.js')), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-preload-chunks', 'slam');
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('No se pudo descargar el motor AR SLAM (XR8)'));
        document.head.appendChild(s);
      });

      const waitStart = Date.now();
      while (!window.XR8 && Date.now() - waitStart < 8000) {
        await new Promise((r) => setTimeout(r, 40));
      }
      if (!window.XR8) {
        throw new Error('XR8 no inicializó en window.XR8');
      }
      if (typeof window.XR8.loadChunk === 'function') {
        await window.XR8.loadChunk('slam');
      }
      return window.XR8;
    })().catch((err) => {
      this._xr8LoadPromise = null;
      throw err;
    });

    return this._xr8LoadPromise;
  }

  /** Marca materiales y texturas para subir programas/texturas al cambiar entre contextos WebGLRenderer. */
  refreshPivotForRenderer(pivot) {
    if (!pivot || typeof pivot.traverse !== 'function') return;
    pivot.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((mat) => {
        if (!mat) return;
        mat.needsUpdate = true;
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'].forEach((key) => {
          if (mat[key]) mat[key].needsUpdate = true;
        });
      });
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
          border-radius: var(--qr3d-radius, 16px);
          overflow: hidden;
          background: var(--qr3d-bg, var(--_cfg-bg, ${BACKGROUND_STYLES.warm_dark.css}));
          box-shadow: var(--qr3d-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.4));
          user-select: none;
          transition: background 0.35s ease;
          --_qr3d-surface: var(--qr3d-surface, var(--_cfg-surface, rgba(15, 23, 42, 0.88)));
          --_qr3d-surface-hover: var(--qr3d-surface-hover, rgba(30, 41, 59, 0.95));
          --_qr3d-text: var(--qr3d-text, var(--_cfg-text, #cbd5e1));
          --_qr3d-border: var(--qr3d-border, rgba(255, 255, 255, 0.16));
          --_qr3d-accent: var(--qr3d-accent, var(--_cfg-accent, #d97706));
          --_qr3d-accent-text: var(--qr3d-accent-text, #ffffff);
          --_qr3d-toast-bg: var(--qr3d-toast-bg, var(--_cfg-accent, #059669));
          --_qr3d-hint-bg: var(--qr3d-hint-bg, rgba(15, 23, 42, 0.5));
          --_qr3d-hint-text: var(--qr3d-hint-text, rgba(255, 255, 255, 0.7));
        }

        :host(.light-ui) {
          --_qr3d-surface: var(--qr3d-surface, var(--_cfg-surface, rgba(255, 255, 255, 0.90)));
          --_qr3d-surface-hover: var(--qr3d-surface-hover, #ffffff);
          --_qr3d-text: var(--qr3d-text, var(--_cfg-text, #1e293b));
          --_qr3d-border: var(--qr3d-border, rgba(15, 23, 42, 0.14));
          --_qr3d-accent: var(--qr3d-accent, var(--_cfg-accent, #0f3d2e));
          --_qr3d-accent-text: var(--qr3d-accent-text, #ffffff);
          --_qr3d-toast-bg: var(--qr3d-toast-bg, var(--_cfg-accent, #0f3d2e));
          --_qr3d-hint-bg: var(--qr3d-hint-bg, rgba(255, 255, 255, 0.82));
          --_qr3d-hint-text: var(--qr3d-hint-text, rgba(15, 23, 42, 0.78));
        }

        :host([flat]),
        :host([flat="true"]) {
          border-radius: 0;
          box-shadow: none;
        }
        :host([flat="false"]) {
          border-radius: var(--qr3d-radius, 16px);
          box-shadow: var(--qr3d-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.4));
        }

        :host(.light-bg) .hint-3d {
          color: var(--_qr3d-hint-text);
          background: var(--_qr3d-hint-bg);
        }

        :host([hide-badge]) .qr-badge-container,
        :host([hide-badge="true"]) .qr-badge-container {
          display: none;
        }
        :host([hide-badge="false"]) .qr-badge-container {
          display: flex;
        }

        :host(.toolbar-hidden) .controls-toolbar {
          display: none;
        }
        :host(:not(.ar-enabled)) #btn-ar {
          display: none;
        }
        :host(.hint-hidden) .hint-3d {
          display: none;
        }
        :host(.ar-camera-active) {
          background: #000000 !important;
        }
        :host(.ar-camera-active) .qr-badge-container,
        :host(.ar-camera-active) .hint-3d {
          display: none !important;
        }

        #ar-camera-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 1;
          display: none;
          pointer-events: none;
        }

        :host(.ar-camera-active) #ar-camera-video {
          display: block;
        }

        #viewport {
          position: relative;
          z-index: 2;
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
          background: var(--_qr3d-surface);
          border: 1px solid var(--_qr3d-border);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(8px);
          transition: transform 0.2s ease, border-color 0.2s ease;
          z-index: 10;
          cursor: pointer;
        }

        .qr-badge-container:hover {
          transform: scale(1.04);
          border-color: var(--_qr3d-accent);
        }

        .qr-badge-container.aerial-active {
          border-color: var(--_qr3d-accent);
          box-shadow: 0 0 20px rgba(15, 61, 46, 0.25);
        }

        .qr-badge-container.badge-collapsed {
          padding: 7px 10px;
          gap: 0;
        }
        .qr-badge-container.badge-collapsed .qr-image-wrapper,
        .qr-badge-container.badge-collapsed #qr-badge-sub {
          display: none;
        }
        .qr-badge-collapse-btn {
          background: transparent;
          border: 1px solid var(--_qr3d-border);
          color: var(--_qr3d-text);
          border-radius: 6px;
          width: 20px;
          height: 20px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0.8;
        }
        .qr-badge-collapse-btn:hover {
          opacity: 1;
          border-color: var(--_qr3d-accent);
        }

        .qr-badge-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
          font-size: 11px;
          color: var(--_qr3d-text);
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
          background: var(--_qr3d-toast-bg);
          color: var(--_qr3d-accent-text);
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
          background: var(--_qr3d-surface);
          border: 1px solid var(--_qr3d-border);
          color: var(--_qr3d-text);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(8px);
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-tool:hover {
          background: var(--_qr3d-surface-hover);
          border-color: var(--_qr3d-accent);
        }

        .btn-tool.active {
          background: var(--_qr3d-accent);
          border-color: var(--_qr3d-accent);
          color: var(--_qr3d-accent-text);
        }

        .hint-3d {
          position: absolute;
          bottom: 16px;
          left: 16px;
          color: var(--_qr3d-hint-text);
          font-size: 12px;
          pointer-events: none;
          background: var(--_qr3d-hint-bg);
          padding: 4px 10px;
          border-radius: 999px;
          backdrop-filter: blur(6px);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .loader {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: var(--_qr3d-accent);
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
          border: 3px solid rgba(148, 163, 184, 0.25);
          border-top-color: var(--_qr3d-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .ar-camera-hud {
          position: absolute;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          z-index: 25;
          display: none;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          color: #f8fafc;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
          max-width: calc(100% - 24px);
        }
        :host(.ar-camera-active) .ar-camera-hud {
          display: flex;
        }
        .ar-hud-btn {
          background: rgba(255, 255, 255, 0.12);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .ar-hud-btn:hover {
          background: rgba(255, 255, 255, 0.22);
        }
        .ar-hud-btn-danger {
          background: rgba(239, 68, 68, 0.85);
          border-color: rgba(248, 113, 113, 0.6);
        }
        .ar-hud-btn-danger:hover {
          background: rgba(220, 38, 38, 0.95);
        }
        .ar-hud-btn-primary {
          background: linear-gradient(135deg, #059669, #10b981);
          border-color: rgba(52, 211, 153, 0.65);
          color: #ffffff;
        }
        .ar-hud-btn-primary:hover {
          filter: brightness(1.08);
        }
        .ar-camera-pill {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 25;
          display: none;
          align-items: center;
          justify-content: center;
          text-align: center;
          max-width: calc(100% - 28px);
          padding: 7px 14px;
          border-radius: 9999px;
          background: rgba(15, 23, 42, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #f8fafc;
          font-size: 12px;
          font-weight: 600;
          backdrop-filter: blur(8px);
          pointer-events: none;
        }
        :host(.ar-camera-active) .ar-camera-pill {
          display: inline-flex;
        }
        :host(.ar-camera-active) .controls-toolbar {
          display: none !important;
        }

        .ar-modal-backdrop {
          position: absolute;
          inset: 0;
          z-index: 30;
          background: rgba(9, 13, 22, 0.78);
          backdrop-filter: blur(8px);
          display: none;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .ar-modal-backdrop.open {
          display: flex;
        }
        .ar-modal-card {
          width: 100%;
          max-width: 390px;
          max-height: 100%;
          overflow-y: auto;
          background: var(--_qr3d-surface);
          color: var(--_qr3d-text);
          border: 1px solid var(--_qr3d-border);
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ar-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .ar-modal-title {
          font-size: 15px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .ar-modal-close {
          background: transparent;
          border: 1px solid var(--_qr3d-border);
          color: var(--_qr3d-text);
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .ar-modal-desc {
          font-size: 12.5px;
          line-height: 1.45;
          opacity: 0.88;
        }
        .ar-modal-qr-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(148, 163, 184, 0.1);
          border: 1px solid var(--_qr3d-border);
        }
        .ar-modal-qr-box img {
          width: 154px;
          height: 154px;
          border-radius: 10px;
          background: #ffffff;
          padding: 6px;
          object-fit: contain;
        }
        .ar-modal-url-row {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
        }
        .ar-modal-url-input {
          flex: 1;
          min-width: 0;
          font-size: 11px;
          font-family: monospace;
          padding: 6px 8px;
          border-radius: 8px;
          border: 1px solid var(--_qr3d-border);
          background: rgba(15, 23, 42, 0.25);
          color: inherit;
        }
        .ar-modal-warn {
          font-size: 11.5px;
          line-height: 1.45;
          padding: 9px 11px;
          border-radius: 10px;
          background: rgba(245, 158, 11, 0.14);
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #fcd34d;
        }
        :host(.light-ui) .ar-modal-warn {
          color: #92400e;
          background: rgba(245, 158, 11, 0.16);
        }
        .ar-modal-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ar-btn-primary,
        .ar-btn-secondary {
          width: 100%;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-sizing: border-box;
        }
        .ar-btn-primary {
          border: none;
          background: var(--_qr3d-accent);
          color: var(--_qr3d-accent-text);
        }
        .ar-btn-secondary {
          background: transparent;
          color: var(--_qr3d-text);
          border: 1px solid var(--_qr3d-border);
        }
        .ar-btn-primary:hover,
        .ar-btn-secondary:hover {
          filter: brightness(1.08);
        }
      </style>

      <div class="controls-toolbar">
        <button id="btn-aerial" class="btn-tool">${renderIcon('scan', { size: 14 })}<span>Escanear 90°</span></button>
        <button id="btn-ar" class="btn-tool" title="Ver el modelo 3D en Realidad Aumentada desde celular">${renderIcon('smartphone', { size: 14 })}<span>AR</span></button>
        <button id="btn-rotate" class="btn-tool">${renderIcon('refresh', { size: 14 })}<span>Auto-Giro: ON</span></button>
        <button id="btn-edges" class="btn-tool active">${renderIcon('pencil', { size: 14 })}<span>Aristas: Auto</span></button>
        <button id="btn-camera-mode" class="btn-tool" title="Alternar entre cámara cinematográfica suave y respuesta directa 1:1 sin inercia">${renderIcon('film', { size: 14 })}<span>Cámara: Cine</span></button>
        <button id="btn-sun-mode" class="btn-tool" title="Alternar entre sol fijo al modelo (la sombra de la casa al suelo se mantiene) y sol dinámico en el escenario (actual)">${renderIcon('sun', { size: 14 })}<span>Sol: Dinámico</span></button>
        <button id="btn-reset" class="btn-tool">${renderIcon('target', { size: 14 })}<span>Centrar</span></button>
      </div>

      <div class="scan-toast" id="scan-toast">
        ${renderIcon('sparkles', { size: 15 })}<span>¡QR escaneado! Nuevo código activo</span>
      </div>

      <div class="hint-3d" id="hint-3d">${renderIcon('mouse-pointer', { size: 14 })}<span>Clic en el modelo: Vista aérea 90° · Arrastra para girar</span></div>

      <div class="loader" id="loader">
        <div class="spinner"></div>
        <span>Cargando modelo 3D...</span>
      </div>

      <!-- Live 2D QR overlay -->
      <div class="qr-badge-container" id="qr-badge" title="Clic para activar Vista Aérea 90° y QR con colores del modelo">
        <div class="qr-badge-header">
          <span id="qr-badge-title">QR Dinámico</span>
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span class="live-dot" title="En vivo"></span>
            <button type="button" id="btn-collapse-badge" class="qr-badge-collapse-btn" title="Comprimir o expandir tarjeta QR" aria-label="Comprimir o expandir tarjeta QR">${renderIcon('minus', { size: 12 })}</button>
          </span>
        </div>
        <div class="qr-image-wrapper">
          <img id="qr-preview-img" src="" alt="QR Activo" />
        </div>
        <div id="qr-badge-sub" style="font-size: 10px; color: #94a3b8; text-align: center;">Clic para escanear 90°</div>
      </div>

      <div class="ar-camera-pill" id="ar-camera-pill">Apunta hacia tu mesa y toca Fijar aquí</div>
      <video id="ar-camera-video" autoplay playsinline muted></video>
      <canvas id="viewport"></canvas>

      <div class="ar-camera-hud" id="ar-camera-hud">
        <button id="ar-cam-anchor" type="button" class="ar-hud-btn ar-hud-btn-primary" title="Fijar o reubicar el objeto en tu entorno">${renderIcon('pin', { size: 14 })}<span>Fijar aquí</span></button>
        <button id="ar-cam-smaller" type="button" class="ar-hud-btn" title="Reducir modelo">${renderIcon('minus', { size: 14 })}</button>
        <button id="ar-cam-bigger" type="button" class="ar-hud-btn" title="Agrandar modelo">${renderIcon('plus', { size: 14 })}</button>
        <button id="ar-cam-flip" type="button" class="ar-hud-btn" title="Cambiar cámara frontal/trasera">${renderIcon('refresh', { size: 14 })}<span>Cámara</span></button>
        <button id="ar-cam-exit" type="button" class="ar-hud-btn ar-hud-btn-danger">${renderIcon('x', { size: 14 })}<span>Salir AR</span></button>
      </div>

      <div class="ar-modal-backdrop" id="ar-modal" role="dialog" aria-modal="true" aria-labelledby="ar-modal-title">
        <div class="ar-modal-card">
          <div class="ar-modal-head">
            <div class="ar-modal-title" id="ar-modal-title">${renderIcon('smartphone', { size: 17 })}<span>Realidad Aumentada (AR)</span></div>
            <button id="ar-modal-close" type="button" class="ar-modal-close" aria-label="Cerrar">${renderIcon('x', { size: 16 })}</button>
          </div>
          <p class="ar-modal-desc" id="ar-modal-desc"></p>
          <div class="ar-modal-warn" id="ar-modal-warn" style="display:none;"></div>
          <div class="ar-modal-qr-box" id="ar-modal-qr-box">
            <img id="ar-modal-qr-img" src="" alt="QR para abrir vista AR en celular" />
            <div style="font-size:11.5px;font-weight:600;text-align:center;">Escanea desde tu celular para abrir esta vista 3D + AR</div>
            <div class="ar-modal-url-row">
              <input id="ar-modal-url-input" class="ar-modal-url-input" type="text" readonly />
              <button id="ar-modal-copy" type="button" class="ar-hud-btn" style="color:inherit;border-color:var(--_qr3d-border);">${renderIcon('copy', { size: 13 })}<span>Copiar</span></button>
            </div>
          </div>
          <div class="ar-modal-actions" id="ar-modal-actions"></div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('btn-aerial').addEventListener('click', () => {
      if (this.isAerialMode) {
        this.exitAerialScanMode();
      } else {
        this.enterAerialScanMode();
      }
    });

    const qrBadgeEl = this.shadowRoot.getElementById('qr-badge');
    const collapseBadgeBtn = this.shadowRoot.getElementById('btn-collapse-badge');
    if (collapseBadgeBtn && qrBadgeEl) {
      collapseBadgeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = qrBadgeEl.classList.toggle('badge-collapsed');
        collapseBadgeBtn.innerHTML = renderIcon(isCollapsed ? 'plus' : 'minus', { size: 12 });
      });
    }

    qrBadgeEl.addEventListener('click', () => {
      if (qrBadgeEl.classList.contains('badge-collapsed')) {
        qrBadgeEl.classList.remove('badge-collapsed');
        if (collapseBadgeBtn) collapseBadgeBtn.innerHTML = renderIcon('minus', { size: 12 });
        return;
      }
      if (this.isAerialMode) {
        this.exitAerialScanMode();
      } else {
        this.enterAerialScanMode();
      }
    });

    this.shadowRoot.getElementById('btn-ar').addEventListener('click', () => {
      this.launchAR();
    });

    this.shadowRoot.getElementById('ar-modal-close').addEventListener('click', () => {
      this.closeArModal();
    });

    this.shadowRoot.getElementById('ar-modal').addEventListener('click', (e) => {
      if (e.target && e.target.id === 'ar-modal') {
        this.closeArModal();
      }
    });

    this.shadowRoot.getElementById('ar-modal-copy').addEventListener('click', async () => {
      const input = this.shadowRoot.getElementById('ar-modal-url-input');
      const btn = this.shadowRoot.getElementById('ar-modal-copy');
      if (!input || !input.value) return;
      try {
        await navigator.clipboard.writeText(input.value);
      } catch {
        input.select();
        document.execCommand('copy');
      }
      if (btn) {
        btn.innerHTML = `${renderIcon('check', { size: 13 })}<span>Copiado</span>`;
        setTimeout(() => {
          btn.innerHTML = `${renderIcon('copy', { size: 13 })}<span>Copiar</span>`;
        }, 1800);
      }
    });

    this.shadowRoot.getElementById('ar-cam-anchor').addEventListener('click', () => {
      this.toggleCameraArAnchor();
    });

    this.shadowRoot.getElementById('ar-cam-smaller').addEventListener('click', () => {
      this.adjustCameraArScale(0.8);
    });

    this.shadowRoot.getElementById('ar-cam-bigger').addEventListener('click', () => {
      this.adjustCameraArScale(1.25);
    });

    this.shadowRoot.getElementById('ar-cam-flip').addEventListener('click', () => {
      this._arCameraFacing = this._arCameraFacing === 'environment' ? 'user' : 'environment';
      this.startCameraAR({ keepScale: true });
    });

    this.shadowRoot.getElementById('ar-cam-exit').addEventListener('click', () => {
      this.stopCameraAR();
    });

    this.shadowRoot.getElementById('btn-rotate').addEventListener('click', () => {
      if (this.isAerialMode) {
        this.autoRotateBeforeAerial = true;
        this.viewerConfig.autoRotate = true;
        this._userToolbarOverrides.autoRotate = true;
        this._hasLocalToolbarEdits = true;
        this.exitAerialScanMode();
      } else {
        this.autoRotate = !this.autoRotate;
        this.viewerConfig.autoRotate = this.autoRotate;
        this._userToolbarOverrides.autoRotate = this.autoRotate;
        this._hasLocalToolbarEdits = true;
        this.updateRotateButtonLabel();
        this.requestRender();
      }
      this.dispatchEvent(new CustomEvent('viewer-config-change', { detail: this.getViewerConfig() }));
    });

    this.shadowRoot.getElementById('btn-edges').addEventListener('click', () => {
      const currentMode = this.viewerConfig.edgeMode || 'smart';
      if (currentMode === 'off') {
        this.viewerConfig.edgeMode = this._lastActiveEdgeMode || 'smart';
      } else {
        this._lastActiveEdgeMode = currentMode;
        this.viewerConfig.edgeMode = 'off';
      }
      this._userToolbarOverrides.edgeMode = this.viewerConfig.edgeMode;
      this._hasLocalToolbarEdits = true;
      this.applyEdgeMode();
      this.dispatchEvent(new CustomEvent('viewer-config-change', { detail: this.getViewerConfig() }));
    });

    this.shadowRoot.getElementById('btn-camera-mode').addEventListener('click', () => {
      const isDirect = this.viewerConfig.cameraMode === 'direct';
      this.viewerConfig.cameraMode = isDirect ? 'smooth' : 'direct';
      this._userToolbarOverrides.cameraMode = this.viewerConfig.cameraMode;
      this._hasLocalToolbarEdits = true;
      this.applyCameraMode();
      this.dispatchEvent(new CustomEvent('viewer-config-change', { detail: this.getViewerConfig() }));
    });

    this.shadowRoot.getElementById('btn-sun-mode').addEventListener('click', () => {
      const isModel = this.viewerConfig.sunMode === 'model';
      this.viewerConfig.sunMode = isModel ? 'scene' : 'model';
      this._userToolbarOverrides.sunMode = this.viewerConfig.sunMode;
      this._hasLocalToolbarEdits = true;
      this.updateSunModeButtonLabel();
      this.syncSunTransform({ updateShadow: true });
      this.requestRender({ durationMs: 400 });
      this.dispatchEvent(new CustomEvent('viewer-config-change', { detail: this.getViewerConfig() }));
    });

    this.shadowRoot.getElementById('btn-reset').addEventListener('click', () => {
      if (this.isAerialMode) {
        this.exitAerialScanMode();
      } else if (this.controls) {
        if (this.defaultView && this.modelPivot && this.defaultView.pivotRotY !== undefined) {
          this.modelPivot.rotation.y = this.defaultView.pivotRotY;
          this.syncSunTransform({ updateShadow: true });
        }
        this.controls.reset();
        this.requestRender({ durationMs: 800 });
      }
    });
  }

  updateRotateButtonLabel() {
    if (!this.shadowRoot) return;
    const btn = this.shadowRoot.getElementById('btn-rotate');
    if (btn) {
      btn.innerHTML = this.autoRotate
        ? `${renderIcon('refresh', { size: 14 })}<span>Auto-Giro: ON</span>`
        : `${renderIcon('pause', { size: 14 })}<span>Auto-Giro: OFF</span>`;
    }
  }

  updateEdgesButtonLabel() {
    if (!this.shadowRoot) return;
    const btn = this.shadowRoot.getElementById('btn-edges');
    if (!btn) return;
    const mode = this.viewerConfig.edgeMode || 'smart';
    if (mode === 'off') {
      btn.classList.remove('active');
      btn.innerHTML = `${renderIcon('pencil', { size: 14 })}<span>Aristas: OFF</span>`;
    } else if (mode === 'all') {
      btn.classList.add('active');
      btn.innerHTML = `${renderIcon('pencil', { size: 14 })}<span>Aristas: Todas</span>`;
    } else {
      btn.classList.add('active');
      btn.innerHTML = `${renderIcon('pencil', { size: 14 })}<span>Aristas: Auto</span>`;
    }
  }

  updateCameraModeButtonLabel() {
    if (!this.shadowRoot) return;
    const btn = this.shadowRoot.getElementById('btn-camera-mode');
    if (!btn) return;
    const isDirect = this.viewerConfig.cameraMode === 'direct';
    btn.classList.toggle('active', isDirect);
    btn.innerHTML = isDirect
      ? `${renderIcon('zap', { size: 14 })}<span>Cámara: Directa</span>`
      : `${renderIcon('film', { size: 14 })}<span>Cámara: Cine</span>`;
  }

  updateSunModeButtonLabel() {
    if (!this.shadowRoot) return;
    const btn = this.shadowRoot.getElementById('btn-sun-mode');
    if (!btn) return;
    const isModel = this.viewerConfig.sunMode === 'model';
    btn.classList.toggle('active', isModel);
    btn.innerHTML = isModel
      ? `${renderIcon('pin', { size: 14 })}<span>Sol: Fijo</span>`
      : `${renderIcon('sun', { size: 14 })}<span>Sol: Dinámico</span>`;
  }

  applyCameraMode() {
    const isDirect = this.viewerConfig.cameraMode === 'direct';
    if (this.controls) {
      this.controls.enableDamping = !isDirect;
      this.controls.dampingFactor = isDirect ? 0 : 0.10;
      this.controls.rotateSpeed = isDirect ? 1.0 : 0.85;
      this.controls.zoomSpeed = isDirect ? 1.15 : 1.0;
    }
    this.updateCameraModeButtonLabel();
    this.requestRender({ durationMs: 250 });
  }

  initThree() {
    const canvas = this.shadowRoot.getElementById('viewport');
    const width = this.clientWidth || 600;
    const height = this.clientHeight || 480;

    this.scene = new window.THREE.Scene();
    this.camera = new window.THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 1.8, 4.5);

    this.renderer = new window.THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    this._lastWidth = width;
    this._lastHeight = height;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = window.THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = window.THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.viewerConfig.exposure;
    this.renderer.outputEncoding = window.THREE.sRGBEncoding;

    this.controls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.10;
    this.controls.rotateSpeed = 0.85;
    this.controls.maxDistance = 500;
    this.controls.minDistance = 0.5;
    this.controls.target.set(0, 1.2, 0);
    this.controls.addEventListener('change', () => {
      this.requestRender({ durationMs: 250 });
    });
    this.applyCameraMode();

    canvas.addEventListener('pointerdown', () => {
      this._isInteracting = true;
      this._pauseAutoRotateUntil = performance.now() + 1800;
      this.requestRender({ durationMs: 1400 });
    });
    canvas.addEventListener('pointerup', () => {
      this._isInteracting = false;
      this._pauseAutoRotateUntil = performance.now() + 1400;
      this.requestRender({ durationMs: 1400 });
    });
    canvas.addEventListener('pointercancel', () => {
      this._isInteracting = false;
      this._pauseAutoRotateUntil = performance.now() + 1400;
    });
    canvas.addEventListener(
      'wheel',
      () => {
        this._pauseAutoRotateUntil = performance.now() + 1200;
        this.requestRender({ durationMs: 1200 });
      },
      { passive: true }
    );

    this.hemiLight = new window.THREE.HemisphereLight(0xfff5e4, 0x5c4a38, 0.28);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.ambientLight = new window.THREE.AmbientLight(0xffffff, 0.08);
    this.scene.add(this.ambientLight);

    this.sunLight = new window.THREE.DirectionalLight(0xfff1d6, this.viewerConfig.sunIntensity);
    this.sunLight.position.set(-30, 40, 15);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.bias = -0.0002;
    if ('normalBias' in this.sunLight.shadow) {
      this.sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.fillLight = new window.THREE.DirectionalLight(0xbcd0ea, 0.14);
    this.fillLight.position.set(30, 18, -15);
    this.scene.add(this.fillLight);

    this.applyBackgroundStyle();
    this.applyLightingConfig();

    // Detectar clic corto sobre el modelo 3D para activar/salir de Vista Aérea 90°
    canvas.addEventListener('pointerdown', (e) => {
      if (this._xrSession || this._isCameraArActive) {
        this.pointerDownInfo = null;
        return;
      }
      if (e.button === 0) {
        this.pointerDownInfo = { x: e.clientX, y: e.clientY, time: performance.now() };
      } else {
        this.pointerDownInfo = null;
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (this._xrSession || this._isCameraArActive) {
        this.pointerDownInfo = null;
        return;
      }
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
      if (this._xrSession) return;
      const w = this.clientWidth;
      const h = this.clientHeight;
      if (w > 0 && h > 0 && (w !== this._lastWidth || h !== this._lastHeight)) {
        this._lastWidth = w;
        this._lastHeight = h;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.requestRender({ durationMs: 400 });
      }
    });
    this.resizeObserver.observe(this);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          this._isInViewport = entry ? entry.isIntersecting : true;
          if (this._isInViewport) {
            this.requestRender({ durationMs: 800 });
          }
        },
        { threshold: 0.01 }
      );
      this.intersectionObserver.observe(this);
    }

    this._animateLoop = (now) => {
      this.animationFrameId = null;
      if (this._xrSession || this._slamSessionActive) return;
      if (!this.renderer || !this.scene || !this.camera) return;
      if (!this._isPageVisible || !this._isInViewport) return;

      this._inFrame = true;
      try {
        const ts = now || performance.now();
        const dtSec = this._lastFrameTime
          ? Math.min(0.05, Math.max(0.001, (ts - this._lastFrameTime) / 1000))
          : 1 / 60;
        this._lastFrameTime = ts;

        if (this.cameraAnim) {
          const rawT = Math.min(1, (ts - this.cameraAnim.startTime) / this.cameraAnim.duration);
          const t = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

          this.camera.position.lerpVectors(this.cameraAnim.fromPos, this.cameraAnim.toPos, t);
          this.controls.target.lerpVectors(this.cameraAnim.fromTarget, this.cameraAnim.toTarget, t);

          if (this.modelPivot && this.cameraAnim.toRotY !== null) {
            this.modelPivot.rotation.y =
              this.cameraAnim.fromRotY + (this.cameraAnim.toRotY - this.cameraAnim.fromRotY) * t;
            this.syncSunTransform({ updateShadow: true });
          }

          if (this.aerialBlocksMesh && this.cameraAnim.blockMode) {
            this.updateAerialBlocksAnimation(rawT, this.cameraAnim.blockMode);
          } else if (this.aerialQrMesh && this.cameraAnim.fadeAerialTo !== null) {
            const fromOp = this.cameraAnim.fadeAerialFrom;
            const toOp = this.cameraAnim.fadeAerialTo;
            this.aerialQrMesh.material.opacity = fromOp + (toOp - fromOp) * t;
          }

          if (rawT >= 1) {
            const onComplete = this.cameraAnim.onComplete;
            this.cameraAnim = null;
            this.renderer.shadowMap.needsUpdate = true;
            if (onComplete) onComplete();
          }
        } else if (
          this.autoRotate &&
          this.modelPivot &&
          !this.isAerialMode &&
          !this._isCameraArActive &&
          !this._isInteracting &&
          ts >= this._pauseAutoRotateUntil
        ) {
          this.modelPivot.rotation.y += dtSec * 0.32;
          this._lastShadowRotY = this.modelPivot.rotation.y;
          this.syncSunTransform({ updateShadow: true });
        }

        if (this._isCameraArActive && this._camArHasGyro) {
          this.updateCameraArPose();
        } else {
          this.controls.update();
        }
        this.renderer.render(this.scene, this.camera);
        this.renderer.shadowMap.needsUpdate = false;
      } finally {
        this._inFrame = false;
      }

      const shouldKeepAnimating =
        Boolean(this.cameraAnim) ||
        Boolean(this.autoRotate && this.modelPivot && !this.isAerialMode && !this._isCameraArActive) ||
        Boolean(this._isCameraArActive && this._camArHasGyro) ||
        this._isInteracting ||
        performance.now() < this._activeUntil;

      if (shouldKeepAnimating && this._isPageVisible && this._isInViewport && !this.animationFrameId) {
        this.animationFrameId = requestAnimationFrame(this._animateLoop);
      }
    };

    this.requestRender({ durationMs: 1200 });
  }

  requestRender({ durationMs = 600 } = {}) {
    if (this._xrSession || this._slamSessionActive) return;
    if (durationMs > 0) {
      this._activeUntil = Math.max(this._activeUntil, performance.now() + durationMs);
    }
    if (!this.renderer || !this._animateLoop) return;
    if (!this._isPageVisible || !this._isInViewport) return;
    if (!this._inFrame && !this.animationFrameId) {
      this._lastFrameTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this._animateLoop);
    }
  }

  computeMainModelBounds() {
    if (!this.currentModel) return null;
    const totemNode = this.currentModel.getObjectByName('QR_Totem_Integrated');
    const prevTotemVis = totemNode ? totemNode.visible : true;
    const prevEdgeVis = this.edgeLines.map((l) => l.visible);
    const prevAerialVis = this.aerialQrMesh ? this.aerialQrMesh.visible : false;
    const prevBackingVis = this.aerialQrBackingMesh ? this.aerialQrBackingMesh.visible : false;
    const prevBlocksVis = this.aerialBlocksMesh ? this.aerialBlocksMesh.visible : false;

    if (totemNode) totemNode.visible = false;
    this.edgeLines.forEach((l) => (l.visible = false));
    if (this.aerialQrMesh) this.aerialQrMesh.visible = false;
    if (this.aerialQrBackingMesh) this.aerialQrBackingMesh.visible = false;
    if (this.aerialBlocksMesh) this.aerialBlocksMesh.visible = false;

    const prevRotY = this.modelPivot ? this.modelPivot.rotation.y : 0;
    if (this.modelPivot) {
      this.modelPivot.rotation.y = 0;
      this.modelPivot.updateMatrixWorld(true);
    }

    const box = new window.THREE.Box3();
    this.currentModel.traverse((child) => {
      if (!child.isMesh || !child.visible) return;
      if (totemNode && this.isDescendantOf(child, totemNode)) return;
      if (child === this.aerialQrMesh || child === this.aerialQrBackingMesh || child === this.aerialBlocksMesh) return;
      box.expandByObject(child);
    });

    if (box.isEmpty()) {
      box.setFromObject(this.currentModel);
    }

    if (totemNode) totemNode.visible = prevTotemVis;
    this.edgeLines.forEach((l, i) => (l.visible = prevEdgeVis[i]));
    if (this.aerialQrMesh) this.aerialQrMesh.visible = prevAerialVis;
    if (this.aerialQrBackingMesh) this.aerialQrBackingMesh.visible = prevBackingVis;
    if (this.aerialBlocksMesh) this.aerialBlocksMesh.visible = prevBlocksVis;
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
    this.updateCameraFraming({ applyCamera: !this.viewerConfig.cameraPose });
  }

  updateCameraFraming({ applyCamera = true } = {}) {
    if (!this.modelPivot || !this.camera || !this.controls) return;
    const cfg = this.viewerConfig;
    const showTotem = cfg.showTotem !== false;

    const useMainBounds = !showTotem && Boolean(this.mainBounds);
    let box;
    if (useMainBounds) {
      box = this.mainBounds.box.clone();
    } else {
      box = new window.THREE.Box3().setFromObject(this.modelPivot);
    }
    if (box.isEmpty()) {
      box = new window.THREE.Box3().setFromObject(this.modelPivot);
    }

    const sphere = box.getBoundingSphere(new window.THREE.Sphere());
    const radius = Math.max(sphere.radius, 0.5);
    const target = sphere.center.clone();

    this.framingCenter = target.clone();
    this.framingRadius = radius;
    this.modelPivot.updateMatrixWorld(true);
    this.localLightingCenter = useMainBounds
      ? target.clone()
      : this.modelPivot.worldToLocal(target.clone());

    const fovRad = window.THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.max(0.5, this.camera.aspect || 1);
    const effectiveFov = Math.min(fovRad, 2 * Math.atan(Math.tan(fovRad / 2) * aspect));
    const dist = (radius / Math.sin(effectiveFov / 2)) * 0.96;

    this.camera.near = Math.max(0.05, radius * 0.01);
    this.camera.far = Math.max(250, dist + radius * 12);
    this.camera.updateProjectionMatrix();

    this.controls.minDistance = Math.max(0.5, radius * 0.25);
    this.controls.maxDistance = Math.max(12, radius * 5.0);

    if (applyCamera) {
      if (cfg.cameraPose && Array.isArray(cfg.cameraPose.position) && Array.isArray(cfg.cameraPose.target)) {
        const posePos = new window.THREE.Vector3(...cfg.cameraPose.position);
        const poseTarget = new window.THREE.Vector3(...cfg.cameraPose.target);
        const pivotRotY = Number.isFinite(cfg.cameraPose.pivotRotY) ? cfg.cameraPose.pivotRotY : 0;
        this.modelPivot.rotation.y = pivotRotY;
        this.defaultView = {
          target: poseTarget.clone(),
          cameraPos: posePos.clone(),
          pivotRotY
        };
        this.controls.target.copy(poseTarget);
        this.camera.position.copy(posePos);
      } else {
        const cameraPos = new window.THREE.Vector3(
          target.x + dist * 0.48,
          target.y + dist * 0.36,
          target.z + dist * 0.80
        );
        this.defaultView = {
          target: target.clone(),
          cameraPos: cameraPos.clone(),
          pivotRotY: 0
        };
        this.controls.target.copy(target);
        this.camera.position.copy(cameraPos);
      }
      this.controls.update();
      this.controls.saveState();
    }

    this.applyLightingConfig();
  }

  /**
   * Renderiza el modelo ortográficamente desde 90° arriba (sin totem auxiliar ni líneas negras)
   * para muestrear exactamente los colores cenitales visibles desde arriba.
   */
  sampleAerial90Colors() {
    if (!this.renderer || !this.scene || !this.modelPivot || !this.mainBounds) return null;
    if (this.aerialSamples) return this.aerialSamples;

    // Capturar el modelo sin alterar de forma permanente una transición/ocultamiento en curso
    const snap = this._modelRevealSnapshot;
    const savedModelVis = this.currentModel ? this.currentModel.visible : true;
    const savedModelScaleY = this.currentModel ? this.currentModel.scale.y : 1;
    const savedMatStates = snap
      ? snap.matSnapshots.map((e) => ({
          mat: e.mat,
          transparent: e.mat.transparent,
          opacity: e.mat.opacity,
          depthWrite: e.mat.depthWrite
        }))
      : null;

    if (this.currentModel) {
      this.currentModel.visible = true;
      if (snap) {
        this.currentModel.scale.y = snap.scaleY;
        for (const entry of snap.matSnapshots) {
          if (entry.mat.transparent !== entry.transparent) {
            entry.mat.transparent = entry.transparent;
            entry.mat.needsUpdate = true;
          }
          entry.mat.opacity = entry.opacity;
          entry.mat.depthWrite = entry.depthWrite;
        }
      }
    }

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
    const prevBackingVis = this.aerialQrBackingMesh ? this.aerialQrBackingMesh.visible : false;
    const prevBlocksVis = this.aerialBlocksMesh ? this.aerialBlocksMesh.visible : false;
    const prevRotY = this.modelPivot.rotation.y;

    if (totemNode) totemNode.visible = false;
    this.edgeLines.forEach((l) => (l.visible = false));
    if (this.aerialQrMesh) this.aerialQrMesh.visible = false;
    if (this.aerialQrBackingMesh) this.aerialQrBackingMesh.visible = false;
    if (this.aerialBlocksMesh) this.aerialBlocksMesh.visible = false;
    this.modelPivot.rotation.y = 0;
    this.modelPivot.updateMatrixWorld(true);
    this.syncSunTransform({ updateShadow: true });

    const rt = new window.THREE.WebGLRenderTarget(res, res, {
      minFilter: window.THREE.LinearFilter,
      magFilter: window.THREE.LinearFilter,
      format: window.THREE.RGBAFormat
    });
    const prevTarget = this.renderer.getRenderTarget();
    const prevBg = this.scene.background;
    const prevClearColor = new window.THREE.Color();
    this.renderer.getClearColor(prevClearColor);
    const prevClearAlpha = this.renderer.getClearAlpha();

    this.scene.background = null;
    this.renderer.setRenderTarget(rt);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, orthoCam);

    const rawPixels = new Uint8Array(res * res * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, res, res, rawPixels);

    // Segundo pase GPU ultrarrápido para muestrear la altura real (Y) de cada parte del modelo 3D
    let heightPixels = null;
    try {
      const spanY = Math.max(0.05, size.y);
      const heightMat = new window.THREE.ShaderMaterial({
        uniforms: {
          uMinY: { value: box.min.y },
          uSpanY: { value: spanY }
        },
        vertexShader: `
          uniform float uMinY;
          uniform float uSpanY;
          varying float vNormH;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vNormH = clamp((wp.y - uMinY) / uSpanY, 0.0, 1.0);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          varying float vNormH;
          void main() {
            gl_FragColor = vec4(vNormH, vNormH, vNormH, 1.0);
          }
        `
      });
      const prevOverride = this.scene.overrideMaterial;
      this.scene.overrideMaterial = heightMat;
      this.renderer.clear();
      this.renderer.render(this.scene, orthoCam);
      heightPixels = new Uint8Array(res * res * 4);
      this.renderer.readRenderTargetPixels(rt, 0, 0, res, res, heightPixels);
      this.scene.overrideMaterial = prevOverride;
      heightMat.dispose();
    } catch {
      heightPixels = null;
    }

    this.renderer.setRenderTarget(prevTarget);
    this.scene.background = prevBg;
    this.renderer.setClearColor(prevClearColor, prevClearAlpha);
    rt.dispose();

    if (totemNode) totemNode.visible = prevTotemVis;
    this.edgeLines.forEach((l, i) => (l.visible = prevEdgeVis[i]));
    if (this.aerialQrMesh) this.aerialQrMesh.visible = prevAerialVis;
    if (this.aerialQrBackingMesh) this.aerialQrBackingMesh.visible = prevBackingVis;
    if (this.aerialBlocksMesh) this.aerialBlocksMesh.visible = prevBlocksVis;
    if (this.currentModel) {
      if (savedMatStates) {
        for (const s of savedMatStates) {
          if (s.mat.transparent !== s.transparent) {
            s.mat.transparent = s.transparent;
            s.mat.needsUpdate = true;
          }
          s.mat.opacity = s.opacity;
          s.mat.depthWrite = s.depthWrite;
        }
      }
      this.currentModel.scale.y = savedModelScaleY;
      this.currentModel.visible = savedModelVis;
    }
    this.modelPivot.rotation.y = prevRotY;
    this.modelPivot.updateMatrixWorld(true);
    this.syncSunTransform({ updateShadow: true });

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
      heightPixels,
      minValidRow,
      maxValidRow,
      minValidCol,
      maxValidCol
    };
    return this.aerialSamples;
  }

  sampleAerialSurfaceAtUV(samples, u, v) {
    const { res, rawPixels, heightPixels } = samples;
    const rawX = Math.max(0, Math.min(res - 1, Math.round(u * (res - 1))));
    const rawY = Math.max(0, Math.min(res - 1, Math.round((1 - v) * (res - 1))));
    const idx = (rawY * res + rawX) * 4;
    const hasSurface = rawPixels[idx + 3] > 96;
    const normHeight = heightPixels && hasSurface ? (heightPixels[idx] / 255) : (hasSurface ? 0.35 : 0.05);
    return { hasSurface, normHeight };
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

  solveToneToLuminance(sr, sg, sb, targetLum, satScale = 1, allowLightLift = false) {
    const lumTarget = Math.max(8, Math.min(242, targetLum));
    const [h, s] = this.rgbToHsv(sr, sg, sb);
    const adjSat = s >= 0.06 ? Math.max(0, Math.min(0.84, s * satScale)) : 0;
    if (adjSat < 0.06) {
      const g = Math.round(lumTarget);
      return [g, g, g];
    }

    let lo = 0.04;
    let hi = 1.0;
    for (let step = 0; step < 10; step++) {
      const mid = (lo + hi) * 0.5;
      const [tr, tg, tb] = this.hsvToRgb(h, adjSat, mid);
      const lum = 0.299 * tr + 0.587 * tg + 0.114 * tb;
      if (lum < lumTarget) lo = mid;
      else hi = mid;
    }
    let [r, g, b] = this.hsvToRgb(h, adjSat, (lo + hi) * 0.5);
    if (allowLightLift) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < lumTarget) {
        const lift = Math.min(1, (lumTarget - lum) / Math.max(1, 255 - lum));
        r = Math.round(r + (255 - r) * lift);
        g = Math.round(g + (255 - g) * lift);
        b = Math.round(b + (255 - b) * lift);
      }
    }
    return [r, g, b];
  }

  computeAerialQrModuleColors(matrix, samples) {
    const N = matrix.size;
    const qrColors = new Uint8Array(N * N * 3);
    const modelColors = new Uint8Array(N * N * 3);
    let edgeR = 0, edgeG = 0, edgeB = 0, edgeCount = 0;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        const bit = matrix.modules[idx];
        const u = (c + 0.5) / N;
        const v = (r + 0.5) / N;
        const [sr, sg, sb] = this.sampleAerialColorAtUV(samples, u, v);
        modelColors[idx * 3] = sr;
        modelColors[idx * 3 + 1] = sg;
        modelColors[idx * 3 + 2] = sb;

        if (r === 0 || r === N - 1 || c === 0 || c === N - 1) {
          edgeR += sr;
          edgeG += sg;
          edgeB += sb;
          edgeCount++;
        }

        const origLum = 0.299 * sr + 0.587 * sg + 0.114 * sb;
        const isFinder =
          (r < 8 && c < 8) ||
          (r < 8 && c >= N - 8) ||
          (r >= N - 8 && c < 8);

        if (bit === 1) {
          const targetDarkLum = isFinder
            ? 38
            : Math.max(36, Math.min(58, origLum * 0.30 + 22));
          const [dr, dg, db] = this.solveToneToLuminance(
            sr,
            sg,
            sb,
            targetDarkLum,
            isFinder ? 0.90 : 0.96,
            false
          );
          qrColors[idx * 3] = dr;
          qrColors[idx * 3 + 1] = dg;
          qrColors[idx * 3 + 2] = db;
        } else {
          const targetLightLum = isFinder
            ? Math.min(218, Math.max(origLum, 194))
            : Math.min(214, Math.max(origLum, 166));
          const [lr, lg, lb] = this.solveToneToLuminance(
            sr,
            sg,
            sb,
            targetLightLum,
            isFinder ? 0.72 : 0.95,
            true
          );
          qrColors[idx * 3] = lr;
          qrColors[idx * 3 + 1] = lg;
          qrColors[idx * 3 + 2] = lb;
        }
      }
    }

    const avgR = edgeCount > 0 ? Math.round(edgeR / edgeCount) : 214;
    const avgG = edgeCount > 0 ? Math.round(edgeG / edgeCount) : 206;
    const avgB = edgeCount > 0 ? Math.round(edgeB / edgeCount) : 186;
    const quietRgb = this.solveToneToLuminance(avgR, avgG, avgB, 198, 0.42, true);
    const quietColor = `rgb(${quietRgb[0]}, ${quietRgb[1]}, ${quietRgb[2]})`;

    return { size: N, qrColors, modelColors, quietRgb, quietColor };
  }

  /**
   * Genera un canvas QR opaco donde cada módulo adopta el tono real de la maqueta vista desde arriba
   * preservando contraste legible sin velos translúcidos.
   */
  buildAerialColoredQrCanvas(matrix, samples, { pixelSize = 768, moduleColors = null } = {}) {
    const N = matrix.size;
    const margin = 2;
    const total = N + margin * 2;
    const cell = pixelSize / total;
    const computed = moduleColors || this.computeAerialQrModuleColors(matrix, samples);

    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = computed.quietColor || '#ecefe9';
    ctx.fillRect(0, 0, pixelSize, pixelSize);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const idx = (r * N + c) * 3;
        ctx.fillStyle = `rgb(${computed.qrColors[idx]}, ${computed.qrColors[idx + 1]}, ${computed.qrColors[idx + 2]})`;
        const x = Math.floor((c + margin) * cell);
        const y = Math.floor((r + margin) * cell);
        const w = Math.ceil((c + margin + 1) * cell) - x;
        const hCell = Math.ceil((r + margin + 1) * cell) - y;
        ctx.fillRect(x, y, w, hCell);
      }
    }

    return canvas;
  }

  prepareModelRevealState() {
    if (!this.currentModel) return;
    if (this._modelRevealSnapshot) return;
    const matSnapshots = [];
    const seenMats = new Set();
    this.currentModel.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (child === this.aerialQrMesh || child === this.aerialQrBackingMesh || child === this.aerialBlocksMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (mat && !seenMats.has(mat)) {
          seenMats.add(mat);
          matSnapshots.push({
            mat,
            transparent: Boolean(mat.transparent),
            opacity: mat.opacity !== undefined ? mat.opacity : 1,
            depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true
          });
        }
      }
    });
    const edgeSnapshots = [];
    const seenEdgeMats = new Set();
    for (const line of [...this.smartEdgeLines, ...this.allEdgeLines]) {
      if (line.material && !seenEdgeMats.has(line.material)) {
        seenEdgeMats.add(line.material);
        edgeSnapshots.push({
          mat: line.material,
          opacity: line.material.opacity !== undefined ? line.material.opacity : 0.42
        });
      }
    }
    this._modelRevealSnapshot = {
      scaleY: this.currentModel.scale.y || 1,
      matSnapshots,
      edgeSnapshots
    };
  }

  setModelRevealVisibility(factor) {
    if (!this.currentModel) return;
    this.prepareModelRevealState();
    const snap = this._modelRevealSnapshot;
    const clamped = Math.max(0, Math.min(1, factor));

    if (clamped <= 0.01) {
      this.currentModel.visible = false;
      return;
    }

    this.currentModel.visible = true;
    this.currentModel.scale.y = snap.scaleY * (0.9 + 0.1 * clamped);

    for (const entry of snap.matSnapshots) {
      const needTrans = clamped < 0.995 || entry.transparent;
      if (entry.mat.transparent !== needTrans) {
        entry.mat.transparent = needTrans;
        entry.mat.needsUpdate = true;
      }
      entry.mat.opacity = entry.opacity * clamped;
      entry.mat.depthWrite = clamped >= 0.98 ? entry.depthWrite : false;
    }

    for (const edge of snap.edgeSnapshots) {
      edge.mat.opacity = edge.opacity * clamped;
    }
  }

  restoreModelRevealState() {
    if (!this.currentModel) return;
    this.currentModel.visible = true;
    const snap = this._modelRevealSnapshot;
    if (!snap) return;

    this.currentModel.scale.y = snap.scaleY;
    for (const entry of snap.matSnapshots) {
      if (entry.mat.transparent !== entry.transparent) {
        entry.mat.transparent = entry.transparent;
        entry.mat.needsUpdate = true;
      }
      entry.mat.opacity = entry.opacity;
      entry.mat.depthWrite = entry.depthWrite;
    }
    for (const edge of snap.edgeSnapshots) {
      edge.mat.opacity = edge.opacity;
    }
    this._modelRevealSnapshot = null;
  }

  createShadedBoxGeometry(w, h, d, facePalette = null) {
    const geo = new window.THREE.BoxGeometry(w, h, d);
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    if (!pos || !norm) return geo;

    const pal = facePalette || {
      top: [1, 1, 1],
      right: [0.74, 0.74, 0.74],
      left: [0.62, 0.62, 0.62],
      front: [0.68, 0.68, 0.68],
      back: [0.56, 0.56, 0.56],
      bottom: [0.48, 0.48, 0.48]
    };

    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const nx = norm.getX(i);
      const ny = norm.getY(i);
      const nz = norm.getZ(i);
      let c = pal.back;
      if (ny > 0.5) c = pal.top;
      else if (ny < -0.5) c = pal.bottom;
      else if (nx > 0.5) c = pal.right;
      else if (nx < -0.5) c = pal.left;
      else if (nz > 0.5) c = pal.front;

      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new window.THREE.BufferAttribute(colors, 3));
    return geo;
  }

  createBeveledCubeGeometry(w, h, d) {
    const geo = new window.THREE.BufferGeometry();
    const hw = w * 0.5;
    const hh = h * 0.5;
    const hd = d * 0.5;
    const tw = hw * 0.78;
    const td = hd * 0.78;
    const by = hh - Math.min(h * 0.24, Math.min(w, d) * 0.16);

    const positions = [];
    const colors = [];

    const pushQuad = (a, b, c, p4, shade) => {
      const tris = [a, b, c, a, c, p4];
      for (const v of tris) {
        positions.push(v[0], v[1], v[2]);
        colors.push(shade, shade, shade);
      }
    };

    // Cara superior (+Y): 1.0 sin oscurecimiento para mantener el contraste exacto al escanear
    pushQuad([-tw, hh, td], [tw, hh, td], [tw, hh, -td], [-tw, hh, -td], 1.0);

    // Biseles inclinados superiores (marcan nítidamente cada cubo desde vista aérea)
    pushQuad([-hw, by, hd], [hw, by, hd], [tw, hh, td], [-tw, hh, td], 0.72);     // +Z frente
    pushQuad([hw, by, -hd], [-hw, by, -hd], [-tw, hh, -td], [tw, hh, -td], 0.46); // -Z atrás
    pushQuad([hw, by, hd], [hw, by, -hd], [tw, hh, -td], [tw, hh, td], 0.56);     // +X derecha
    pushQuad([-hw, by, -hd], [-hw, by, hd], [-tw, hh, td], [-tw, hh, -td], 0.82); // -X izquierda

    // Paredes verticales del cubo
    pushQuad([-hw, -hh, hd], [hw, -hh, hd], [hw, by, hd], [-hw, by, hd], 0.62);     // +Z frente
    pushQuad([hw, -hh, -hd], [-hw, -hh, -hd], [-hw, by, -hd], [hw, by, -hd], 0.38); // -Z atrás
    pushQuad([hw, -hh, hd], [hw, -hh, -hd], [hw, by, -hd], [hw, by, hd], 0.48);     // +X derecha
    pushQuad([-hw, -hh, -hd], [-hw, -hh, hd], [-hw, by, hd], [-hw, by, -hd], 0.74); // -X izquierda

    // Base inferior (-Y)
    pushQuad([-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd], 0.35);

    geo.setAttribute('position', new window.THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new window.THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  snapAerialBlocksToQrState() {
    if (!this.aerialBlocksMesh || !this._aerialBlockData) return;
    if (!this._blockTmpObj) this._blockTmpObj = new window.THREE.Object3D();
    const obj = this._blockTmpObj;
    const data = this._aerialBlockData;
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      obj.position.set(b.x, b.finalCenterY, b.z);
      obj.rotation.set(0, 0, 0);
      obj.scale.set(b.finalXZ, b.finalScaleY, b.finalXZ);
      obj.updateMatrix();
      this.aerialBlocksMesh.setMatrixAt(i, obj.matrix);
      this.aerialBlocksMesh.setColorAt(i, b.qrCol);
    }
    this.aerialBlocksMesh.instanceMatrix.needsUpdate = true;
    if (this.aerialBlocksMesh.instanceColor) {
      this.aerialBlocksMesh.instanceColor.needsUpdate = true;
    }
  }

  ensureAerialBlocksMesh(matrix, moduleColors, samples = null) {
    if (!this.modelPivot || !this.mainBounds || !window.THREE) return null;
    const N = matrix.size;
    const count = N * N;
    const margin = 2;
    const total = N + margin * 2;
    const side = this.mainBounds.side * 0.94;
    const cell = side / total;
    const { box, center, size } = this.mainBounds;
    const unitBlockH = cell;
    const plateTopY = box.max.y + Math.max(0.38, side * 0.05);
    const plateH = Math.max(0.05, Math.min(side * 0.035, cell * 0.72));

    if (
      this.aerialBlocksMesh &&
      (!this._aerialBlockData || this._aerialBlockData.length !== count)
    ) {
      this.modelPivot.remove(this.aerialBlocksMesh);
      this.aerialBlocksMesh.geometry.dispose();
      this.aerialBlocksMesh.material.dispose();
      this.aerialBlocksMesh = null;
      this._aerialBlockData = null;
    }

    if (!this.aerialBlocksMesh) {
      const geo = this.createBeveledCubeGeometry(cell, unitBlockH, cell);
      const mat = new window.THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        toneMapped: false,
        transparent: false,
        depthWrite: true,
        opacity: 1
      });
      this.aerialBlocksMesh = new window.THREE.InstancedMesh(geo, mat, count);
      this.aerialBlocksMesh.renderOrder = 6;
      this.aerialBlocksMesh.frustumCulled = false;
      this.aerialBlocksMesh.visible = false;
      this.modelPivot.add(this.aerialBlocksMesh);
    }

    const qRgb = moduleColors.quietRgb || [220, 212, 194];
    const quietLinear = new window.THREE.Color(qRgb[0] / 255, qRgb[1] / 255, qRgb[2] / 255).convertSRGBToLinear();

    if (
      this.aerialQrBackingMesh &&
      (this._aerialBackingSide !== side || this._aerialBackingPlateH !== plateH)
    ) {
      const wasVisible = this.aerialQrBackingMesh.visible;
      this.modelPivot.remove(this.aerialQrBackingMesh);
      this.aerialQrBackingMesh.geometry.dispose();
      this.aerialQrBackingMesh.material.dispose();
      this.aerialQrBackingMesh = null;
      this._pendingBackingVis = wasVisible;
    }

    if (!this.aerialQrBackingMesh) {
      const plateGeo = this.createShadedBoxGeometry(side, plateH, side, {
        top: [1, 1, 1],
        right: [0.80, 0.80, 0.80],
        left: [0.90, 0.90, 0.90],
        front: [0.86, 0.86, 0.86],
        back: [0.74, 0.74, 0.74],
        bottom: [0.68, 0.68, 0.68]
      });
      const plateMat = new window.THREE.MeshBasicMaterial({
        color: quietLinear.clone(),
        vertexColors: true,
        toneMapped: false,
        transparent: false,
        depthWrite: true,
        opacity: 1
      });
      this.aerialQrBackingMesh = new window.THREE.Mesh(plateGeo, plateMat);
      this.aerialQrBackingMesh.position.set(center.x, plateTopY - plateH * 0.5, center.z);
      this.aerialQrBackingMesh.renderOrder = 4;
      this.aerialQrBackingMesh.visible = Boolean(this._pendingBackingVis);
      this._aerialBackingSide = side;
      this._aerialBackingPlateH = plateH;
      this._aerialPlateTopY = plateTopY;
      this._pendingBackingVis = undefined;
      this.modelPivot.add(this.aerialQrBackingMesh);
    } else {
      this._aerialPlateTopY = plateTopY;
      this.aerialQrBackingMesh.position.set(center.x, plateTopY - plateH * 0.5, center.z);
      if (this.aerialQrBackingMesh.material && this.aerialQrBackingMesh.material.color) {
        this.aerialQrBackingMesh.material.color.copy(quietLinear);
      }
    }

    if (!this._blockTmpObj) this._blockTmpObj = new window.THREE.Object3D();
    if (!this._blockTmpColor) this._blockTmpColor = new window.THREE.Color();

    const hash = (a, b) => {
      const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };

    const blockData = new Array(count);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        const bit = matrix.modules[i] ? 1 : 0;
        const x = center.x - side * 0.5 + (c + margin + 0.5) * cell;
        const z = center.z - side * 0.5 + (r + margin + 0.5) * cell;
        const u = (c + 0.5) / N;
        const v = (r + 0.5) / N;
        const surface = samples ? this.sampleAerialSurfaceAtUV(samples, u, v) : { hasSurface: true, normHeight: 0.45 };
        const h1 = hash(r, c);
        const h2 = hash(r + 17, c + 31);
        const h3 = hash(r + 53, c + 11);
        const radial = Math.min(1, Math.hypot((c / N) - 0.5, (r / N) - 0.5) * 1.45);

        const colHeight = surface.hasSurface
          ? Math.max(unitBlockH, surface.normHeight * size.y)
          : unitBlockH * 0.25;
        const baseScaleY = Math.max(0.25, colHeight / unitBlockH);
        const baseCenterY = surface.hasSurface
          ? box.min.y + colHeight * 0.5
          : box.min.y + unitBlockH * 0.15;

        const finalScaleY = bit === 1 ? 0.72 : 0.24;
        const finalCenterY = plateTopY + (unitBlockH * finalScaleY) * 0.5;
        const finalXZ = 0.97;

        const modCol = new window.THREE.Color(
          moduleColors.modelColors[i * 3] / 255,
          moduleColors.modelColors[i * 3 + 1] / 255,
          moduleColors.modelColors[i * 3 + 2] / 255
        ).convertSRGBToLinear();

        const qrCol = new window.THREE.Color(
          moduleColors.qrColors[i * 3] / 255,
          moduleColors.qrColors[i * 3 + 1] / 255,
          moduleColors.qrColors[i * 3 + 2] / 255
        ).convertSRGBToLinear();

        blockData[i] = {
          bit,
          x,
          z,
          hasSurface: surface.hasSurface,
          baseCenterY,
          baseScaleY,
          finalCenterY,
          finalScaleY,
          finalXZ,
          burstY: Math.max(plateTopY + unitBlockH, baseCenterY + colHeight * 0.5) + Math.max(0.55, size.y * 0.55) * (0.45 + h1 * 0.85),
          dx: (x - center.x) * (0.16 + h2 * 0.26),
          dz: (z - center.z) * (0.16 + h3 * 0.26),
          rx: (h1 - 0.5) * Math.PI * 1.6,
          ry: (h2 - 0.5) * Math.PI * 1.6,
          delay: 0.22 * radial,
          modCol,
          qrCol
        };

        this._blockTmpObj.position.set(x, baseCenterY, z);
        this._blockTmpObj.rotation.set(0, 0, 0);
        const initXZ = surface.hasSurface ? 0.94 : 0.05;
        this._blockTmpObj.scale.set(initXZ, surface.hasSurface ? baseScaleY : 0.05, initXZ);
        this._blockTmpObj.updateMatrix();
        this.aerialBlocksMesh.setMatrixAt(i, this._blockTmpObj.matrix);
        this.aerialBlocksMesh.setColorAt(i, modCol);
      }
    }

    this._aerialBlockData = blockData;
    this.aerialBlocksMesh.instanceMatrix.needsUpdate = true;
    if (this.aerialBlocksMesh.instanceColor) {
      this.aerialBlocksMesh.instanceColor.needsUpdate = true;
    }
    return this.aerialBlocksMesh;
  }

  updateAerialBlocksAnimation(rawT, mode = 'enter') {
    if (!this.aerialBlocksMesh || !this._aerialBlockData) return;
    const data = this._aerialBlockData;
    const obj = this._blockTmpObj;
    const col = this._blockTmpColor;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    if (mode === 'enter') {
      // Transición sólida sin velos transparentes: al desprenderse los cubos, reemplazan directamente a la maqueta
      if (this.currentModel) {
        this.currentModel.visible = rawT < 0.04;
      }

      // Los bloques permanecen siempre opacos formando el cuerpo 3D escaneable del QR
      this.aerialBlocksMesh.visible = true;
      this.aerialBlocksMesh.material.opacity = 1;

      if (this.aerialQrBackingMesh) {
        if (rawT > 0.68) {
          const bs = Math.max(0.01, easeOut((rawT - 0.68) / 0.32));
          this.aerialQrBackingMesh.visible = true;
          this.aerialQrBackingMesh.scale.set(bs, 1, bs);
        } else {
          this.aerialQrBackingMesh.visible = false;
          this.aerialQrBackingMesh.scale.set(0.01, 1, 0.01);
        }
        this.aerialQrBackingMesh.material.opacity = 1;
      }

      if (this.aerialQrMesh) {
        this.aerialQrMesh.visible = false;
        this.aerialQrMesh.material.opacity = 0;
      }

      for (let i = 0; i < data.length; i++) {
        const b = data[i];
        const p = Math.max(0, Math.min(1, (rawT - b.delay) / Math.max(0.01, 1 - b.delay)));
        if (p < 0.22) {
          // Voxelización in-situ sobre el modelo
          const u = easeOut(p / 0.22);
          obj.position.set(b.x, b.baseCenterY, b.z);
          obj.rotation.set(0, 0, 0);
          const xz = b.hasSurface ? 0.94 : 0.05 + 0.42 * u;
          const sy = b.hasSurface ? b.baseScaleY : 0.05 + 0.35 * u;
          obj.scale.set(xz, sy, xz);
          col.copy(b.modCol);
        } else if (p < 0.56) {
          // Desarme y elevación en bloques desde las partes del modelo
          const u = easeOut((p - 0.22) / 0.34);
          obj.position.set(b.x + b.dx * u, b.baseCenterY + (b.burstY - b.baseCenterY) * u, b.z + b.dz * u);
          obj.rotation.set(b.rx * u, b.ry * u, 0);
          const xz = b.hasSurface ? (0.94 - 0.06 * u) : (0.47 + 0.41 * u);
          const sy = (b.hasSurface ? b.baseScaleY : 0.4) * (1 - u) + 0.88 * u;
          obj.scale.set(xz, sy, xz);
          col.copy(b.modCol).lerp(b.qrCol, u * 0.4);
        } else {
          // Reensamble en los bloques 3D que forman el cuerpo del QR
          const u = easeInOut((p - 0.56) / 0.44);
          obj.position.set(
            b.x + b.dx * (1 - u),
            b.burstY + (b.finalCenterY - b.burstY) * u,
            b.z + b.dz * (1 - u)
          );
          obj.rotation.set(b.rx * (1 - u), b.ry * (1 - u), 0);
          const xz = 0.88 + (b.finalXZ - 0.88) * u;
          const sy = 0.88 + (b.finalScaleY - 0.88) * u;
          obj.scale.set(xz, sy, xz);
          col.copy(b.modCol).lerp(b.qrCol, 0.4 + 0.6 * u);
        }
        obj.updateMatrix();
        this.aerialBlocksMesh.setMatrixAt(i, obj.matrix);
        this.aerialBlocksMesh.setColorAt(i, col);
      }
    } else {
      // Salida sólida: el cuerpo en cubos del QR se desarma y reensambla la maqueta sin transparencia
      if (this.aerialQrMesh) {
        this.aerialQrMesh.material.opacity = 0;
        this.aerialQrMesh.visible = false;
      }
      if (this.aerialQrBackingMesh) {
        if (rawT < 0.22) {
          const bs = Math.max(0.01, 1 - easeOut(rawT / 0.22));
          this.aerialQrBackingMesh.scale.set(bs, 1, bs);
          this.aerialQrBackingMesh.visible = true;
        } else {
          this.aerialQrBackingMesh.visible = false;
          this.aerialQrBackingMesh.scale.set(1, 1, 1);
        }
        this.aerialQrBackingMesh.material.opacity = 1;
      }

      if (this.currentModel) {
        this.currentModel.visible = rawT >= 0.96;
      }

      this.aerialBlocksMesh.visible = rawT < 0.97;
      this.aerialBlocksMesh.material.opacity = 1;

      for (let i = 0; i < data.length; i++) {
        const b = data[i];
        const p = Math.max(0, Math.min(1, (rawT - b.delay * 0.55) / Math.max(0.01, 1 - b.delay * 0.55)));
        if (p < 0.42) {
          const u = easeOut(p / 0.42);
          obj.position.set(
            b.x + b.dx * 0.75 * u,
            b.finalCenterY + (b.burstY - b.finalCenterY) * 0.65 * u,
            b.z + b.dz * 0.75 * u
          );
          obj.rotation.set(b.rx * 0.7 * u, b.ry * 0.7 * u, 0);
          obj.scale.set(
            b.finalXZ + (0.90 - b.finalXZ) * u,
            b.finalScaleY + (0.88 - b.finalScaleY) * u,
            b.finalXZ + (0.90 - b.finalXZ) * u
          );
          col.copy(b.qrCol).lerp(b.modCol, u * 0.55);
        } else {
          const u = easeInOut((p - 0.42) / 0.58);
          const midY = b.finalCenterY + (b.burstY - b.finalCenterY) * 0.65;
          obj.position.set(
            b.x + b.dx * 0.75 * (1 - u),
            midY * (1 - u) + b.baseCenterY * u,
            b.z + b.dz * 0.75 * (1 - u)
          );
          obj.rotation.set(b.rx * 0.7 * (1 - u), b.ry * 0.7 * (1 - u), 0);
          const targetXZ = b.hasSurface ? 0.94 : 0.05;
          const targetSY = b.hasSurface ? b.baseScaleY : 0.05;
          obj.scale.set(
            0.90 * (1 - u) + targetXZ * u,
            0.88 * (1 - u) + targetSY * u,
            0.90 * (1 - u) + targetXZ * u
          );
          col.copy(b.qrCol).lerp(b.modCol, 0.55 + 0.45 * u);
        }
        obj.updateMatrix();
        this.aerialBlocksMesh.setMatrixAt(i, obj.matrix);
        this.aerialBlocksMesh.setColorAt(i, col);
      }
    }

    this.aerialBlocksMesh.instanceMatrix.needsUpdate = true;
    if (this.aerialBlocksMesh.instanceColor) {
      this.aerialBlocksMesh.instanceColor.needsUpdate = true;
    }
  }

  async fetchQrMatrix() {
    const endpoint = this.getEndpoint('matrix');
    if (!endpoint) return null;
    try {
      const res = await fetch(`${endpoint}?t=${Date.now()}`);
      if (!res.ok) return null;
      this.qrMatrixCache = await res.json();
      return this.qrMatrixCache;
    } catch {
      return null;
    }
  }

  async applyAerialColoredQr({ buildBlocks = false } = {}) {
    if (!this.currentModel || !this.mainBounds) return;
    const matrix = this.qrMatrixCache || (await this.fetchQrMatrix());
    const samples = this.sampleAerial90Colors();
    if (!matrix || !samples) return;

    const moduleColors = this.computeAerialQrModuleColors(matrix, samples);

    // 1. Canvas sólido con los colores aéreos para el overlay 3D cenital sobre la maqueta
    const overlayCanvas = this.buildAerialColoredQrCanvas(matrix, samples, {
      pixelSize: 1024,
      moduleColors
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
        this.mainBounds.box.max.y + Math.max(0.45, side * 0.055),
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
    const useBlocks = buildBlocks || (this.viewerConfig.qrRevealStyle || 'blocks') === 'blocks';

    if (useBlocks) {
      this.aerialQrMesh.visible = false;
      this.ensureAerialBlocksMesh(matrix, moduleColors, samples);
      if (this.isAerialMode && !this.cameraAnim && this.aerialBlocksMesh) {
        this.snapAerialBlocksToQrState();
        this.aerialBlocksMesh.visible = true;
        this.aerialBlocksMesh.material.opacity = 1;
        if (this.aerialQrBackingMesh) {
          this.aerialQrBackingMesh.visible = true;
          this.aerialQrBackingMesh.scale.set(1, 1, 1);
          this.aerialQrBackingMesh.material.opacity = 1;
        }
      }
    } else {
      this.aerialQrMesh.visible = true;
      if (this.aerialBlocksMesh) this.aerialBlocksMesh.visible = false;
      if (this.aerialQrBackingMesh) {
        this.aerialQrBackingMesh.visible = false;
        this.aerialQrBackingMesh.material.opacity = 0;
      }
    }

    // 2. Canvas sólido con los colores aéreos para la tarjeta 2D y el totem 3D
    const opaqueCanvas = this.buildAerialColoredQrCanvas(matrix, samples, {
      pixelSize: 512,
      moduleColors
    });

    const aerialDataUrl = opaqueCanvas.toDataURL('image/png');
    const qrImg = this.shadowRoot.getElementById('qr-preview-img');
    if (qrImg) {
      qrImg.src = aerialDataUrl;
    }
    this.dispatchEvent(new CustomEvent('qr-visual-update', {
      detail: { src: aerialDataUrl, isAerial: true }
    }));

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
    this.requestRender();
  }

  async enterAerialScanMode(options = {}) {
    if (!this.currentModel || !this.mainBounds || !this.camera || !this.controls) return;

    const revealStyle = options.style || this.viewerConfig.qrRevealStyle || 'blocks';
    const useBlocks = revealStyle === 'blocks';

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
      btnAerial.innerHTML = `${renderIcon('undo', { size: 14 })}<span>Volver a 3D</span>`;
    }
    if (badge) badge.classList.add('aerial-active');
    if (badgeTitle) badgeTitle.innerText = useBlocks ? 'QR Bloques 90°' : 'QR Aéreo 90°';
    if (badgeSub) badgeSub.innerText = 'Colores tomados de la vista 90°';
    if (hint) hint.innerHTML = `${renderIcon('scan', { size: 14 })}<span>Vista Aérea 90° activa · Escanea el QR cromático o haz clic para volver</span>`;

    // Generar muestras cenitales y aplicar los colores al QR (y bloques si corresponde)
    await this.applyAerialColoredQr({ buildBlocks: useBlocks });

    // Calcular cámara aérea centrada sobre el QR en bloques (ligera inclinación ~7° para evidenciar relieve 3D) o 90° en modo fade
    const { box, center, side } = this.mainBounds;
    const halfSide = Math.max(side * 0.5, 0.5);
    const vFov = window.THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.max(0.5, this.camera.aspect || 1);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const limitingFov = Math.min(vFov, hFov);
    const aerialDist = (halfSide / Math.tan(limitingFov / 2)) * (useBlocks ? 1.44 : 1.40);
    const plateTopY = this._aerialPlateTopY || (box.max.y + Math.max(0.38, side * 0.05));

    const toTarget = useBlocks
      ? new window.THREE.Vector3(center.x, plateTopY, center.z)
      : center.clone();
    const toPos = useBlocks
      ? new window.THREE.Vector3(
          center.x,
          plateTopY + aerialDist * 0.997,
          center.z + aerialDist * 0.065
        )
      : new window.THREE.Vector3(
          center.x,
          center.y + aerialDist,
          center.z + aerialDist * 0.0025
        );

    const twoPi = Math.PI * 2;
    let rotY = ((this.modelPivot.rotation.y % twoPi) + twoPi) % twoPi;
    if (rotY > Math.PI) rotY -= twoPi;
    this.modelPivot.rotation.y = rotY;

    const isDirect = this.viewerConfig.cameraMode === 'direct';
    if (useBlocks && this.aerialQrMesh) {
      this.aerialQrMesh.visible = false;
      this.aerialQrMesh.material.opacity = 0;
    }
    if (useBlocks && this.aerialQrBackingMesh) {
      this.aerialQrBackingMesh.visible = false;
      this.aerialQrBackingMesh.scale.set(0.01, 1, 0.01);
      this.aerialQrBackingMesh.material.opacity = 1;
    }

    this.cameraAnim = {
      startTime: performance.now(),
      duration: isDirect ? 1 : (useBlocks ? 1350 : 700),
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
      fromRotY: rotY,
      toRotY: 0,
      fadeAerialFrom: !useBlocks && this.aerialQrMesh ? this.aerialQrMesh.material.opacity : 0,
      fadeAerialTo: useBlocks ? 0 : 1,
      blockMode: useBlocks && this.aerialBlocksMesh ? 'enter' : null,
      onComplete: () => {
        if (useBlocks && this.aerialBlocksMesh) {
          this.updateAerialBlocksAnimation(1, 'enter');
          this.snapAerialBlocksToQrState();
          this.aerialBlocksMesh.visible = true;
          this.aerialBlocksMesh.material.opacity = 1;
          if (this.aerialQrBackingMesh) {
            this.aerialQrBackingMesh.visible = true;
            this.aerialQrBackingMesh.scale.set(1, 1, 1);
            this.aerialQrBackingMesh.material.opacity = 1;
          }
          if (this.currentModel) {
            this.currentModel.visible = false;
          }
          if (this.aerialQrMesh) {
            this.aerialQrMesh.visible = false;
            this.aerialQrMesh.material.opacity = 0;
          }
        } else {
          if (this.aerialBlocksMesh) this.aerialBlocksMesh.visible = false;
          if (this.aerialQrBackingMesh) {
            this.aerialQrBackingMesh.visible = false;
            this.aerialQrBackingMesh.material.opacity = 0;
          }
          if (this.aerialQrMesh) {
            this.aerialQrMesh.visible = true;
            this.aerialQrMesh.material.opacity = 1;
          }
        }
        this.requestRender();
      }
    };
    this.requestRender({ durationMs: useBlocks ? 1500 : 850 });
  }

  exitAerialScanMode(options = {}) {
    if (!this.isAerialMode) return;
    this.isAerialMode = false;
    this.autoRotate = this.autoRotateBeforeAerial;
    this.updateRotateButtonLabel();

    const revealStyle = options.style || this.viewerConfig.qrRevealStyle || 'blocks';
    const useBlocks = revealStyle === 'blocks' && Boolean(this.aerialBlocksMesh);

    const btnAerial = this.shadowRoot.getElementById('btn-aerial');
    const badge = this.shadowRoot.getElementById('qr-badge');
    const badgeTitle = this.shadowRoot.getElementById('qr-badge-title');
    const badgeSub = this.shadowRoot.getElementById('qr-badge-sub');
    const hint = this.shadowRoot.getElementById('hint-3d');

    if (btnAerial) {
      btnAerial.classList.remove('active');
      btnAerial.innerHTML = `${renderIcon('scan', { size: 14 })}<span>Escanear 90°</span>`;
    }
    if (badge) badge.classList.remove('aerial-active');
    if (badgeTitle) badgeTitle.innerText = 'QR Dinámico';
    if (badgeSub) badgeSub.innerText = 'Clic para escanear 90°';
    if (hint) hint.innerHTML = `${renderIcon('mouse-pointer', { size: 14 })}<span>Clic en el modelo: Vista aérea 90° · Arrastra para girar</span>`;

    // Restaurar imagen estándar del QR
    const imageEndpoint = this.getEndpoint('image');
    if (imageEndpoint) {
      const standardUrl = `${imageEndpoint}?t=${Date.now()}`;
      this.updateQrBadgeOnly(standardUrl);
      this.updateModelQrTexture(standardUrl);
      this.dispatchEvent(new CustomEvent('qr-visual-update', {
        detail: { src: standardUrl, isAerial: false }
      }));
    }

    const isDirect = this.viewerConfig.cameraMode === 'direct';
    if (this.defaultView) {
      this.cameraAnim = {
        startTime: performance.now(),
        duration: isDirect ? 1 : (useBlocks ? 950 : 650),
        fromPos: this.camera.position.clone(),
        toPos: this.defaultView.cameraPos.clone(),
        fromTarget: this.controls.target.clone(),
        toTarget: this.defaultView.target.clone(),
        fromRotY: this.modelPivot ? this.modelPivot.rotation.y : 0,
        toRotY: null,
        fadeAerialFrom: !useBlocks && this.aerialQrMesh ? this.aerialQrMesh.material.opacity : 0,
        fadeAerialTo: 0,
        blockMode: useBlocks ? 'exit' : null,
        onComplete: () => {
          if (this.aerialQrMesh) this.aerialQrMesh.visible = false;
          if (this.aerialQrBackingMesh) {
            this.aerialQrBackingMesh.visible = false;
            this.aerialQrBackingMesh.scale.set(1, 1, 1);
            this.aerialQrBackingMesh.material.opacity = 1;
          }
          if (this.aerialBlocksMesh) this.aerialBlocksMesh.visible = false;
          this.restoreModelRevealState();
          this.applyEdgeMode();
          this.applyTotemVisibility();
          this.requestRender();
        }
      };
    } else {
      if (this.aerialQrMesh) this.aerialQrMesh.visible = false;
      if (this.aerialQrBackingMesh) {
        this.aerialQrBackingMesh.visible = false;
        this.aerialQrBackingMesh.scale.set(1, 1, 1);
        this.aerialQrBackingMesh.material.opacity = 1;
      }
      if (this.aerialBlocksMesh) this.aerialBlocksMesh.visible = false;
      this.restoreModelRevealState();
    }
    this.requestRender({ durationMs: 1100 });
  }

  async fetchViewerConfig() {
    const endpoint = this.getEndpoint('meta');
    if (!endpoint) return null;
    try {
      const res = await fetch(`${endpoint}?t=${Date.now()}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (this._hasLocalStudioEdits) return this.viewerConfig;
      const saved = data.viewerConfig || (data.metadata && data.metadata.viewerConfig);
      if (saved && typeof saved === 'object') {
        const effective = {
          ...saved,
          ...(this._attrOverrides || {}),
          ...(this._hasLocalToolbarEdits ? this._userToolbarOverrides : {})
        };
        this.setViewerConfig(effective, { applyCamera: true });
      }
      return this.viewerConfig;
    } catch {
      return null;
    }
  }

  setQrRevealStyle(style) {
    const normalized = style === 'blocks' ? 'blocks' : 'fade';
    this.viewerConfig.qrRevealStyle = normalized;
    this._attrOverrides.qrRevealStyle = normalized;
    return normalized;
  }

  getViewerConfig() {
    return JSON.parse(JSON.stringify(this.viewerConfig));
  }

  getCameraPose() {
    if (!this.camera || !this.controls) return null;
    const round3 = (n) => Math.round(n * 1000) / 1000;
    const twoPi = Math.PI * 2;
    let rotY = this.modelPivot ? ((this.modelPivot.rotation.y % twoPi) + twoPi) % twoPi : 0;
    if (rotY > Math.PI) rotY -= twoPi;
    return {
      position: [round3(this.camera.position.x), round3(this.camera.position.y), round3(this.camera.position.z)],
      target: [round3(this.controls.target.x), round3(this.controls.target.y), round3(this.controls.target.z)],
      pivotRotY: Math.round(rotY * 10000) / 10000
    };
  }

  resetCameraPose() {
    this.viewerConfig.cameraPose = null;
    this.updateCameraFraming({ applyCamera: true });
  }

  setViewerConfig(nextConfig = {}, { applyCamera = false, fromStudio = false } = {}) {
    if (fromStudio) {
      this._hasLocalStudioEdits = true;
      this._hasLocalToolbarEdits = false;
      this._userToolbarOverrides = {};
    }
    const prevShowTotem = this.viewerConfig.showTotem;
    const prevPose = this.viewerConfig.cameraPose;
    const merged = { ...this.viewerConfig, ...nextConfig };
    if (merged.mode === 'auto' && nextConfig.mode === 'auto') {
      Object.assign(merged, VIEWER_PRESETS.auto, {
        backgroundPreset: nextConfig.backgroundPreset !== undefined ? nextConfig.backgroundPreset : merged.backgroundPreset,
        backgroundColor: nextConfig.backgroundColor !== undefined ? nextConfig.backgroundColor : merged.backgroundColor,
        sunMode: nextConfig.sunMode !== undefined ? nextConfig.sunMode : merged.sunMode,
        autoRotate: typeof nextConfig.autoRotate === 'boolean' ? nextConfig.autoRotate : merged.autoRotate,
        cameraMode: nextConfig.cameraMode !== undefined ? nextConfig.cameraMode : merged.cameraMode,
        cameraPose: nextConfig.cameraPose !== undefined ? nextConfig.cameraPose : null,
        uiTheme: nextConfig.uiTheme !== undefined ? nextConfig.uiTheme : merged.uiTheme,
        accentColor: nextConfig.accentColor !== undefined ? nextConfig.accentColor : merged.accentColor,
        surfaceColor: nextConfig.surfaceColor !== undefined ? nextConfig.surfaceColor : merged.surfaceColor,
        textColor: nextConfig.textColor !== undefined ? nextConfig.textColor : merged.textColor,
        showToolbar: typeof nextConfig.showToolbar === 'boolean' ? nextConfig.showToolbar : merged.showToolbar,
        showHint: typeof nextConfig.showHint === 'boolean' ? nextConfig.showHint : merged.showHint,
        qrRevealStyle: nextConfig.qrRevealStyle !== undefined ? nextConfig.qrRevealStyle : merged.qrRevealStyle
      });
    }
    this.viewerConfig = merged;

    if (this.hasExplicitShowEdgesAttr && nextConfig.edgeMode === undefined && merged.mode === 'auto') {
      this.viewerConfig.edgeMode = this.showEdges ? 'smart' : 'off';
    }
    if (merged.mode === 'manual' || nextConfig.autoRotate !== undefined || !this.hasExplicitAutoRotateAttr) {
      const nextAutoRotate = this.viewerConfig.autoRotate !== false;
      if (this.isAerialMode) {
        this.autoRotateBeforeAerial = nextAutoRotate;
      } else {
        this.autoRotate = nextAutoRotate;
        this.updateRotateButtonLabel();
      }
    }

    this.applyBackgroundStyle();
    this.applyLightingConfig();
    this.updateSunModeButtonLabel();
    this.applyColorCalibration();
    this.applyEdgeMode();
    this.applyCameraMode();
    this.applyTotemVisibility();

    const totemChanged = prevShowTotem !== this.viewerConfig.showTotem;
    const poseChanged = JSON.stringify(prevPose) !== JSON.stringify(this.viewerConfig.cameraPose);
    if (this.currentModel && (applyCamera || poseChanged || (totemChanged && !this.viewerConfig.cameraPose))) {
      this.updateCameraFraming({ applyCamera: true });
    }
    this.aerialSamples = null;
    if (
      this.isAerialMode &&
      (this.viewerConfig.qrRevealStyle || 'blocks') === 'blocks' &&
      !this.cameraAnim &&
      this.currentModel
    ) {
      this.currentModel.visible = false;
    }
    this.requestRender({ durationMs: 600 });
  }

  applyBackgroundStyle() {
    const host = this.shadowRoot && this.shadowRoot.host;
    const cfg = this.viewerConfig;
    const preset = cfg.backgroundPreset || 'warm_dark';
    const isTransparent = preset === 'transparent' || this.readBoolAttr('transparent') === true;
    let bgCss = BACKGROUND_STYLES.warm_dark.css;
    let isLight = false;

    if (isTransparent) {
      bgCss = 'transparent';
      isLight = cfg.uiTheme === 'dark' ? false : true;
    } else if (preset === 'custom' && /^#[0-9a-fA-F]{6}$/.test(cfg.backgroundColor || '')) {
      const hex = cfg.backgroundColor;
      bgCss = `radial-gradient(circle at 50% 35%, ${hex}cc 0%, ${hex} 100%)`;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      isLight = (0.299 * r + 0.587 * g + 0.114 * b) > 155;
    } else if (BACKGROUND_STYLES[preset]) {
      bgCss = BACKGROUND_STYLES[preset].css;
      isLight = BACKGROUND_STYLES[preset].light;
    }

    if (this.scene && window.THREE) {
      this.scene.background = null;
    }
    if (this.renderer) {
      this.renderer.setClearColor(0x000000, 0);
    }

    if (host) {
      host.style.setProperty('--_cfg-bg', bgCss);
      host.classList.toggle('light-bg', isLight);

      const uiTheme = cfg.uiTheme || 'auto';
      const useLightUi = uiTheme === 'light' || (uiTheme === 'auto' && isLight);
      host.classList.toggle('light-ui', useLightUi);

      if (cfg.accentColor) host.style.setProperty('--_cfg-accent', cfg.accentColor);
      else host.style.removeProperty('--_cfg-accent');

      if (cfg.surfaceColor) host.style.setProperty('--_cfg-surface', cfg.surfaceColor);
      else host.style.removeProperty('--_cfg-surface');

      if (cfg.textColor) host.style.setProperty('--_cfg-text', cfg.textColor);
      else host.style.removeProperty('--_cfg-text');

      const hideToolbar = cfg.showToolbar === false || this.readBoolAttr('hide-toolbar') === true;
      const hideHint = cfg.showHint === false || this.readBoolAttr('hide-hint') === true;
      host.classList.toggle('toolbar-hidden', hideToolbar);
      host.classList.toggle('hint-hidden', hideHint);
    }
  }

  applyLightingConfig() {
    if (!this.renderer || !window.THREE) return;
    const cfg = this.viewerConfig;
    const target = this.framingCenter || new window.THREE.Vector3(0, 1.2, 0);
    const radius = this.framingRadius || 2;

    this.renderer.toneMappingExposure = Number(cfg.exposure ?? 0.96);

    const ambient = Number(cfg.ambientIntensity ?? 0.18);
    if (this.hemiLight) {
      this.hemiLight.intensity = ambient * 1.35;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = ambient * 0.45;
    }

    const azRad = window.THREE.MathUtils.degToRad(Number(cfg.sunAzimuth ?? -108));
    const elRad = window.THREE.MathUtils.degToRad(Number(cfg.sunElevation ?? 40));
    const cosEl = Math.cos(elRad);
    const sunDist = Math.max(radius * 2.2, 4);
    const offsetVec = new window.THREE.Vector3(
      sunDist * Math.sin(azRad) * cosEl,
      sunDist * Math.sin(elRad),
      -sunDist * Math.cos(azRad) * cosEl
    );
    const fillOffsetVec = new window.THREE.Vector3(
      -offsetVec.x * 0.75,
      radius * 0.8,
      -offsetVec.z * 0.75
    );

    this._lightingState = {
      targetWorld: target.clone(),
      targetLocal: (this.localLightingCenter || target).clone(),
      offsetVec,
      fillOffsetVec
    };

    if (this.sunLight) {
      this.sunLight.intensity = Number(cfg.sunIntensity ?? 1.55);

      const r = Math.max(radius * 1.15, 2);
      const mapWidth = this.sunLight.shadow.mapSize.width || 2048;
      const texelSize = (2 * r) / mapWidth;
      this.sunLight.shadow.bias = -0.0002;
      if ('normalBias' in this.sunLight.shadow) {
        this.sunLight.shadow.normalBias = Math.max(0.02, texelSize * 1.75);
      }
      this.sunLight.shadow.camera.left = -r;
      this.sunLight.shadow.camera.right = r;
      this.sunLight.shadow.camera.top = r;
      this.sunLight.shadow.camera.bottom = -r;
      this.sunLight.shadow.camera.near = Math.max(0.1, sunDist - r * 1.5);
      this.sunLight.shadow.camera.far = sunDist + r * 1.6;
      this.sunLight.shadow.camera.updateProjectionMatrix();
    }

    if (this.fillLight) {
      this.fillLight.intensity = Math.max(0.06, ambient * 0.78);
    }

    this.syncSunTransform({ updateShadow: true });
    this.updateSunModeButtonLabel();
  }

  /**
   * Posiciona el sol y luz de relleno en el escenario ('scene') o anclados a la rotación del modelo ('model').
   */
  syncSunTransform({ updateShadow = false } = {}) {
    if (!this._lightingState || !window.THREE) return;
    const isModelSun = this.viewerConfig.sunMode === 'model' && Boolean(this.modelPivot);
    const rotY = isModelSun ? this.modelPivot.rotation.y : 0;
    const baseTarget = isModelSun ? this._lightingState.targetLocal : this._lightingState.targetWorld;

    const worldTarget = baseTarget.clone();
    const worldSunOffset = this._lightingState.offsetVec.clone();
    const worldFillOffset = this._lightingState.fillOffsetVec.clone();

    if (isModelSun && Math.abs(rotY) > 1e-6) {
      if (!this._yAxis) this._yAxis = new window.THREE.Vector3(0, 1, 0);
      worldTarget.applyAxisAngle(this._yAxis, rotY);
      worldSunOffset.applyAxisAngle(this._yAxis, rotY);
      worldFillOffset.applyAxisAngle(this._yAxis, rotY);
    }

    if ((this._xrSession || this._isCameraArActive) && this.modelPivot) {
      const pivotScale = Math.max(0.001, this.modelPivot.scale.x || 1);
      worldTarget.multiplyScalar(pivotScale).add(this.modelPivot.position);
      worldSunOffset.multiplyScalar(pivotScale);
      worldFillOffset.multiplyScalar(pivotScale);
      if (this.sunLight && this.sunLight.shadow && this.sunLight.shadow.camera) {
        const scaledR = Math.max(0.35, (this.framingRadius || 2) * pivotScale * 1.25);
        const scaledDist = Math.max(1.2, worldSunOffset.length());
        const cam = this.sunLight.shadow.camera;
        cam.left = -scaledR;
        cam.right = scaledR;
        cam.top = scaledR;
        cam.bottom = -scaledR;
        cam.near = Math.max(0.05, scaledDist - scaledR * 1.6);
        cam.far = scaledDist + scaledR * 1.8;
        cam.updateProjectionMatrix();
      }
    }

    if (this.sunLight) {
      this.sunLight.position.copy(worldTarget).add(worldSunOffset);
      this.sunLight.target.position.copy(worldTarget);
      this.sunLight.target.updateMatrixWorld();
    }
    if (this.fillLight) {
      this.fillLight.position.copy(worldTarget).add(worldFillOffset);
    }
    if (updateShadow && this.renderer) {
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  applyColorCalibration() {
    if (!this.currentModel || !window.THREE) return;
    const cfg = this.viewerConfig;
    const fixSrgbSetting = cfg.fixSrgb || 'auto';
    const shouldFixSrgb =
      fixSrgbSetting === 'on' ||
      (fixSrgbSetting === 'auto' && this.modelStats.isLegacyThreeExporter);
    const boost = Number(cfg.colorBoost ?? 1.04);
    const totemNode = this.currentModel.getObjectByName('QR_Totem_Integrated');
    const tmpColor = new window.THREE.Color();
    const hsl = { h: 0, s: 0, l: 0 };

    const calibrateRgb = (r, g, b) => {
      let lr = shouldFixSrgb ? srgbToLinearChannel(r) : r;
      let lg = shouldFixSrgb ? srgbToLinearChannel(g) : g;
      let lb = shouldFixSrgb ? srgbToLinearChannel(b) : b;
      tmpColor.setRGB(lr, lg, lb);
      if (Math.abs(boost - 1.0) > 0.01) {
        tmpColor.getHSL(hsl);
        const satFactor = boost;
        const newS = Math.min(1, Math.max(0, hsl.s * satFactor));
        const newL = boost > 1
          ? Math.pow(Math.max(0, Math.min(1, hsl.l)), 1 + (boost - 1) * 0.28)
          : Math.min(1, hsl.l + (1 - boost) * 0.12);
        tmpColor.setHSL(hsl.h, newS, newL);
      }
      return tmpColor;
    };

    this.currentModel.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (totemNode && this.isDescendantOf(child, totemNode)) return;
      if (child === this.aerialQrMesh) return;

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      const isQr = mats.some((m) => this.qrMaterials.includes(m));
      if (isQr) return;

      for (const mat of mats) {
        if (!mat.userData._origColor && mat.color) {
          mat.userData._origColor = mat.color.clone();
        }
        if (mat.userData._origColor && mat.color) {
          if (!mat.map) {
            const orig = mat.userData._origColor;
            const calibrated = calibrateRgb(orig.r, orig.g, orig.b);
            mat.color.copy(calibrated);
          } else if (boost > 1.0) {
            const atten = Math.max(0.76, 1 - (boost - 1) * 0.22);
            mat.color.setRGB(
              mat.userData._origColor.r * atten,
              mat.userData._origColor.g * atten,
              mat.userData._origColor.b * atten
            );
          } else {
            mat.color.copy(mat.userData._origColor);
          }
          mat.needsUpdate = true;
        }
      }

      const geom = child.geometry;
      if (geom && geom.userData && geom.userData._origVertexColors) {
        if (!shouldFixSrgb && Math.abs(boost - 1.0) <= 0.01) {
          if (geom.userData._origColorAttr) {
            geom.setAttribute('color', geom.userData._origColorAttr);
          }
        } else {
          const origArr = geom.userData._origVertexColors;
          const itemSize = geom.userData._colorItemSize || 3;
          const outArr = new Float32Array(origArr.length);
          for (let i = 0; i < origArr.length; i += itemSize) {
            const c = calibrateRgb(origArr[i], origArr[i + 1], origArr[i + 2]);
            outArr[i] = c.r;
            outArr[i + 1] = c.g;
            outArr[i + 2] = c.b;
            if (itemSize === 4) outArr[i + 3] = origArr[i + 3];
          }
          geom.setAttribute('color', new window.THREE.BufferAttribute(outArr, itemSize));
        }
      }
    });
  }

  shouldIncludeSmartEdge(child) {
    const geom = child.geometry;
    const posAttr = geom && geom.attributes && geom.attributes.position;
    if (!posAttr || posAttr.count >= 30000) return false;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const label = `${child.name || ''} ${mats.map((m) => (m && m.name) || '').join(' ')}`.toLowerCase();
    const looksOrganicByName = /terrain|terreno|mountain|montana|cerro|hill|foliage|canopy|copa|tree|arbol|leaf|leaves|hojas|rock|piedra|relief|plinth|zocalo|drain|canaleta/.test(label);
    if (looksOrganicByName && posAttr.count > 200) {
      return false;
    }

    const edges42 = new window.THREE.EdgesGeometry(geom, 42);
    const c42 = edges42.attributes.position ? edges42.attributes.position.count / 2 : 0;
    if (c42 === 0) {
      edges42.dispose();
      return false;
    }

    if (posAttr.count > 600) {
      const edges15 = new window.THREE.EdgesGeometry(geom, 15);
      const c15 = edges15.attributes.position ? edges15.attributes.position.count / 2 : 0;
      edges15.dispose();
      if ((c15 - c42) > 200 && (c42 / Math.max(1, c15)) < 0.55) {
        edges42.dispose();
        return false;
      }
    }

    return edges42;
  }

  applyEdgeMode() {
    const mode = this.viewerConfig.edgeMode || 'smart';
    if (mode !== 'off') {
      this._lastActiveEdgeMode = mode;
    }

    if (mode === 'all' && this.allEdgeLines.length === 0 && this.edgeTargetMeshes.length > 0) {
      const allEdgeMaterial = new window.THREE.LineBasicMaterial({
        color: 0x0f1218,
        transparent: true,
        opacity: 0.55
      });
      for (const mesh of this.edgeTargetMeshes) {
        const posAttr = mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.position;
        if (posAttr && posAttr.count < 14000) {
          const edgesGeo = new window.THREE.EdgesGeometry(mesh.geometry, 26);
          const lines = new window.THREE.LineSegments(edgesGeo, allEdgeMaterial);
          lines.matrixAutoUpdate = false;
          lines.updateMatrix();
          mesh.add(lines);
          this.allEdgeLines.push(lines);
        }
      }
    }

    for (const line of this.smartEdgeLines) {
      line.visible = mode === 'smart';
    }
    for (const line of this.allEdgeLines) {
      line.visible = mode === 'all';
    }

    this.edgeLines = mode === 'all' ? this.allEdgeLines : this.smartEdgeLines;
    this.showEdges = mode !== 'off';
    this.updateEdgesButtonLabel();
    this.requestRender();
  }

  applyTotemVisibility() {
    if (!this.currentModel) return;
    const totemNode = this.currentModel.getObjectByName('QR_Totem_Integrated');
    if (totemNode) {
      totemNode.visible = this.viewerConfig.showTotem !== false;
      if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
      this.requestRender({ durationMs: 400 });
    }
  }

  loadModel() {
    const imageEndpoint = this.getEndpoint('image');
    const modelUrl = this.getEndpoint('model');
    if (!imageEndpoint || !modelUrl) return;

    const qrImg = this.shadowRoot.getElementById('qr-preview-img');
    const initialQrUrl = `${imageEndpoint}?t=${Date.now()}`;
    qrImg.src = initialQrUrl;

    // Pre-cargar matriz binaria del QR y configuración visual del modelo
    this.fetchQrMatrix();
    this.fetchViewerConfig();

    const loaderEl = this.shadowRoot.getElementById('loader');

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
        this.smartEdgeLines = [];
        this.allEdgeLines = [];
        this.edgeTargetMeshes = [];
        this.aerialSamples = null;
        this.aerialQrMesh = null;
        this.aerialQrBackingMesh = null;
        this.aerialBlocksMesh = null;
        this._aerialBlockData = null;
        this._modelRevealSnapshot = null;

        const rawGenerator =
          (gltf.parser && gltf.parser.json && gltf.parser.json.asset && gltf.parser.json.asset.generator) || '';
        this.modelStats = {
          generator: rawGenerator,
          isLegacyThreeExporter: rawGenerator === 'THREE.GLTFExporter'
        };

        const smartEdgeMaterial = new window.THREE.LineBasicMaterial({
          color: 0x0f1218,
          transparent: true,
          opacity: 0.42
        });

        const totemNode = this.currentModel.getObjectByName('QR_Totem_Integrated');
        let totalSceneVerts = 0;
        let isTerrainMaquette = false;

        this.currentModel.traverse((child) => {
          if (!child.isMesh || !child.material) return;
          const posAttr = child.geometry && child.geometry.attributes && child.geometry.attributes.position;
          if (posAttr) totalSceneVerts += posAttr.count;

          const inTotem = totemNode ? this.isDescendantOf(child, totemNode) : false;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          const matLabel = `${child.name || ''} ${mats.map((m) => (m && m.name) || '').join(' ')}`.toLowerCase();
          if (/terrain|terreno|plinth|zocalo|tucume|sipan/.test(matLabel)) {
            isTerrainMaquette = true;
          }
          const isAuxLightMesh = /plinth|zocalo|bush|shrub|drain|canaleta/.test(matLabel);
          child.castShadow = !isAuxLightMesh;
          child.receiveShadow = !/foliage|tree|bush|shrub|leaf/.test(matLabel);
          if (child !== this.currentModel) {
            child.matrixAutoUpdate = false;
            child.updateMatrix();
          }

          let isQrMesh = false;
          for (const mat of mats) {
            if (!mat.transparent) {
              mat.polygonOffset = true;
              mat.polygonOffsetFactor = 1;
              mat.polygonOffsetUnits = 1;
            }
            if (!inTotem && !mat.userData._origColor && mat.color) {
              mat.userData._origColor = mat.color.clone();
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

          if (!isQrMesh && !inTotem && child.geometry && child.geometry.attributes && child.geometry.attributes.color) {
            const colorAttr = child.geometry.attributes.color;
            const itemSize = colorAttr.itemSize || 3;
            let snap;
            if (colorAttr.array && !colorAttr.normalized && !colorAttr.isInterleavedBufferAttribute) {
              snap = new Float32Array(colorAttr.array);
            } else {
              snap = new Float32Array(colorAttr.count * itemSize);
              for (let i = 0; i < colorAttr.count; i++) {
                snap[i * itemSize] = colorAttr.getX(i);
                snap[i * itemSize + 1] = colorAttr.getY(i);
                snap[i * itemSize + 2] = colorAttr.getZ(i);
                if (itemSize === 4) snap[i * itemSize + 3] = colorAttr.getW(i);
              }
            }
            child.geometry.userData._origVertexColors = snap;
            child.geometry.userData._origColorAttr = colorAttr;
            child.geometry.userData._colorItemSize = itemSize;
          }

          if (!isQrMesh && child.geometry) {
            this.edgeTargetMeshes.push(child);
            const smartGeo = this.shouldIncludeSmartEdge(child);
            if (smartGeo) {
              const lines = new window.THREE.LineSegments(smartGeo, smartEdgeMaterial);
              lines.visible = false;
              lines.matrixAutoUpdate = false;
              lines.updateMatrix();
              child.add(lines);
              this.smartEdgeLines.push(lines);
            }
          }
        });

        // Adaptar pixelRatio en mallas densas y limitar ángulo vertical en maquetas de terreno
        if (this.controls) {
          this.controls.maxPolarAngle = isTerrainMaquette ? Math.PI * 0.492 : Math.PI * 0.88;
        }
        if (this.renderer) {
          const dprCap = totalSceneVerts > 15000 ? 1.0 : 1.25;
          this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
          this.renderer.shadowMap.needsUpdate = true;
        }

        this.modelPivot = new window.THREE.Group();
        this.modelPivot.add(this.currentModel);
        this.scene.add(this.modelPivot);
        this.frameModelToCamera(this.currentModel);
        this.setViewerConfig(this.viewerConfig, { applyCamera: true });
        if (!this.aerialRequested) {
          this.updateModelQrTexture(initialQrUrl);
        }
        this.requestRender({ durationMs: 1200 });

        loaderEl.style.opacity = '0';
        setTimeout(() => (loaderEl.style.display = 'none'), 300);

        this.dispatchEvent(new CustomEvent('viewer-ready', { detail: { viewerConfig: this.getViewerConfig() } }));

        if (this.aerialRequested) {
          this.enterAerialScanMode();
        }
      },
      undefined,
      (err) => {
        console.warn('Error al cargar modelo GLB:', err);
        fetch(`${this.apiUrl}/health`)
          .then((r) => r.json().catch(() => null))
          .then((h) => {
            if (!h || h.serviceActive === false) {
              loaderEl.innerHTML = `<span style="color:#f87171; text-align:center; padding:12px; display:inline-flex; align-items:center; gap:8px;">${renderIcon('ban', { size: 16 })}<span>El servicio no se activó o la base de datos no está disponible</span></span>`;
            } else {
              loaderEl.innerHTML = `<span style="color:#f87171; display:inline-flex; align-items:center; gap:8px;">${renderIcon('alert-triangle', { size: 16 })}<span>No se pudo cargar el modelo 3D</span></span>`;
            }
          })
          .catch(() => {
            loaderEl.innerHTML = `<span style="color:#f87171; text-align:center; padding:12px; display:inline-flex; align-items:center; gap:8px;">${renderIcon('ban', { size: 16 })}<span>El servicio no se activó o el servidor no responde</span></span>`;
          });
      }
    );
  }

  initRealtimeSSE() {
    const sseUrl = this.getEndpoint('events');
    if (!sseUrl) return;

    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Al ocurrir un escaneo o rotación se actualiza el QR sin recargar la página ni el modelo 3D
        if (data.type === 'qr_updated') {
          const nextImgUrl = this.viewToken
            ? `${this.apiUrl}/view/${this.viewToken}/image?t=${Date.now()}`
            : (data.newQrImageUrl || `${this.getEndpoint('image')}?t=${Date.now()}`);
          await this.fetchQrMatrix();
          if (this.isAerialMode) {
            await this.applyAerialColoredQr();
          } else {
            this.updateQrBadgeOnly(nextImgUrl);
            this.updateModelQrTexture(nextImgUrl);
          }
          this.dispatchEvent(new CustomEvent('qr-rotated', {
            detail: { ...data, newQrImageUrl: nextImgUrl }
          }));
          if (!this.hideBadge) {
            this.showScanToast();
          }
        } else if (data.type === 'scan_count_updated') {
          this.dispatchEvent(new CustomEvent('qr-scan-recorded', { detail: data }));
        } else if (data.type === 'link_config_updated') {
          this.dispatchEvent(new CustomEvent('qr-link-config', { detail: data }));
        } else if (data.type === 'status_updated') {
          this.dispatchEvent(new CustomEvent('qr-status-change', { detail: data }));
        } else if (data.type === 'viewer_config_updated' && data.viewerConfig) {
          const effective = {
            ...data.viewerConfig,
            ...(this._attrOverrides || {}),
            ...(this._hasLocalToolbarEdits ? this._userToolbarOverrides : {})
          };
          this.setViewerConfig(effective, { applyCamera: true });
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
      this.requestRender();
    });
  }

  probeArCapabilities() {
    if (typeof navigator !== 'undefined' && navigator.xr && typeof navigator.xr.isSessionSupported === 'function') {
      navigator.xr
        .isSessionSupported('immersive-ar')
        .then((supported) => {
          this._webXrSupported = Boolean(supported);
        })
        .catch(() => {
          this._webXrSupported = false;
        });
    } else {
      this._webXrSupported = false;
    }
  }

  async ensureWebXrSupport() {
    if (this._webXrSupported !== null) return this._webXrSupported;
    if (typeof navigator !== 'undefined' && navigator.xr && typeof navigator.xr.isSessionSupported === 'function') {
      try {
        this._webXrSupported = Boolean(await navigator.xr.isSessionSupported('immersive-ar'));
      } catch {
        this._webXrSupported = false;
      }
    } else {
      this._webXrSupported = false;
    }
    return this._webXrSupported;
  }

  getArEnvironmentInfo() {
    const ua = navigator.userAgent || '';
    const isIOS =
      /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const isInAppWebView = /Instagram|FBAN|FBAV|WhatsApp|Line|MicroMessenger|TikTok|Snapchat|LinkedIn/i.test(ua);
    const isNonSafariIos = isIOS && (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) || isInAppWebView);
    const arModelEndpoint = this.getEndpoint('arModel') || this.getEndpoint('model');
    const usdzEndpoint = this.getEndpoint('usdz');
    const absArModelUrl = arModelEndpoint ? new URL(arModelEndpoint, window.location.origin).href : null;
    const absUsdzUrl = usdzEndpoint ? new URL(usdzEndpoint, window.location.origin).href : null;
    const parsedModel = absArModelUrl ? new URL(absArModelUrl) : null;
    const isLocalHost = parsedModel
      ? /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i.test(parsedModel.hostname)
      : false;
    const isHttpsOrigin = parsedModel ? parsedModel.protocol === 'https:' : window.location.protocol === 'https:';
    const hasCameraApi = Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
    const hasGyroApi = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    let androidChromeIntentUrl = null;
    if (isAndroid && typeof window !== 'undefined') {
      try {
        const cur = new URL(window.location.href);
        if (cur.protocol === 'https:' || cur.protocol === 'http:') {
          const scheme = cur.protocol.replace(':', '');
          androidChromeIntentUrl =
            `intent://${cur.host}${cur.pathname}${cur.search}` +
            `#Intent;scheme=${scheme};package=com.android.chrome;action=android.intent.action.VIEW;` +
            `S.browser_fallback_url=${encodeURIComponent(cur.href)};end;`;
        }
      } catch {
        androidChromeIntentUrl = null;
      }
    }
    return {
      isIOS,
      isAndroid,
      isMobile: isIOS || isAndroid,
      isInAppWebView,
      isNonSafariIos,
      absArModelUrl,
      absUsdzUrl,
      androidChromeIntentUrl,
      isLocalHost,
      isHttpsOrigin,
      hasCameraApi,
      hasGyroApi,
      webXrSupported: Boolean(this._webXrSupported)
    };
  }

  buildAndroidSceneViewerIntent(absModelUrl) {
    const arTitle = this.getAttribute('ar-title') || 'Modelo 3D Interactivo';
    let fallbackUrl = window.location.href;
    try {
      const fb = new URL(window.location.href);
      fb.searchParams.set('ar_fb', 'sv');
      fallbackUrl = fb.href;
    } catch {}
    return (
      `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(absModelUrl)}` +
      `&mode=ar_preferred&title=${encodeURIComponent(arTitle)}&resizable=true` +
      `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;` +
      `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
    );
  }

  createIosQuickLookAnchor(usdzUrl, { labelText = null, className = null } = {}) {
    const anchor = document.createElement('a');
    anchor.setAttribute('rel', 'ar');
    anchor.setAttribute('href', usdzUrl);
    if (className) anchor.className = className;

    const img = document.createElement('img');
    img.alt = '';
    img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    if (labelText) {
      img.style.width = '1px';
      img.style.height = '1px';
      img.style.opacity = '0.01';
      img.style.position = 'absolute';
      img.style.pointerEvents = 'none';
    }
    anchor.appendChild(img);

    if (labelText) {
      const iconWrap = document.createElement('span');
      iconWrap.style.display = 'inline-flex';
      iconWrap.innerHTML = renderIcon('smartphone', { size: 15 });
      const txt = document.createElement('span');
      txt.textContent = labelText;
      anchor.appendChild(iconWrap);
      anchor.appendChild(txt);
    }
    return anchor;
  }

  triggerIosQuickLook(usdzUrl) {
    const anchor = this.createIosQuickLookAnchor(usdzUrl);
    anchor.style.position = 'fixed';
    anchor.style.top = '0';
    anchor.style.left = '0';
    anchor.style.width = '1px';
    anchor.style.height = '1px';
    anchor.style.opacity = '0.01';
    anchor.style.pointerEvents = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => anchor.remove(), 250);
    const msg = 'Abriendo AR Quick Look en iOS...';
    this.showToastMessage(msg, 3500, 'smartphone');
    this.dispatchEvent(new CustomEvent('ar-status', { detail: { platform: 'ios', icon: 'smartphone', message: msg } }));
  }

  triggerAndroidSceneViewer(absModelUrl) {
    const intentUrl = this.buildAndroidSceneViewerIntent(absModelUrl);
    const msg = 'Abriendo Google Scene Viewer en Android...';
    this.showToastMessage(msg, 4200, 'smartphone');
    this.dispatchEvent(new CustomEvent('ar-status', { detail: { platform: 'android', icon: 'smartphone', message: msg } }));
    window.location.href = intentUrl;
  }

  computeArUnitScale() {
    if (!this.modelPivot) return 0.5;
    let maxSpan = 1;
    if (this.mainBounds && this.mainBounds.size) {
      const s = this.mainBounds.size;
      maxSpan = Math.max(s.x, s.y, s.z, 0.01);
    } else {
      const box = new window.THREE.Box3().setFromObject(this.modelPivot);
      const s = box.getSize(new window.THREE.Vector3());
      maxSpan = Math.max(s.x, s.y, s.z, 0.01);
    }
    const targetSpan = 0.72;
    return maxSpan > 1.05 || maxSpan < 0.25 ? targetSpan / maxSpan : 1;
  }

  computeVisiblePivotBottomMinY() {
    if (!this.modelPivot || !window.THREE) return 0;
    const prevPos = this.modelPivot.position.clone();
    const prevScale = this.modelPivot.scale.clone();
    const prevRot = this.modelPivot.rotation.clone();
    const prevVis = this.modelPivot.visible;
    this.modelPivot.position.set(0, 0, 0);
    this.modelPivot.scale.setScalar(1);
    this.modelPivot.rotation.set(0, 0, 0);
    this.modelPivot.visible = true;
    this.modelPivot.updateMatrixWorld(true);

    const totemNode = this.currentModel ? this.currentModel.getObjectByName('QR_Totem_Integrated') : null;
    const hideTotem = this.viewerConfig && this.viewerConfig.showTotem === false;
    const box = new window.THREE.Box3();
    if (this.currentModel) {
      this.currentModel.traverse((child) => {
        if (!child.isMesh || !child.visible) return;
        if (hideTotem && totemNode && this.isDescendantOf(child, totemNode)) return;
        if (child === this.aerialQrMesh || child === this.aerialQrBackingMesh || child === this.aerialBlocksMesh) return;
        box.expandByObject(child);
      });
    }
    if (box.isEmpty()) {
      box.setFromObject(this.modelPivot);
    }

    this.modelPivot.position.copy(prevPos);
    this.modelPivot.scale.copy(prevScale);
    this.modelPivot.rotation.copy(prevRot);
    this.modelPivot.visible = prevVis;
    this.modelPivot.updateMatrixWorld(true);
    return box.isEmpty() ? 0 : box.min.y;
  }

  createArReticleMesh() {
    const THREE = window.THREE;
    const group = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.085, 0.125, 48).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92
    });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    const dotGeo = new THREE.CircleGeometry(0.02, 24).rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    group.add(new THREE.Mesh(dotGeo, dotMat));

    group.matrixAutoUpdate = false;
    group.visible = false;
    return group;
  }

  createGroundedShadowDisc() {
    const THREE = window.THREE;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    return mesh;
  }

  disposeThreeHelperObject(obj) {
    if (!obj) return;
    if (obj.parent) obj.parent.remove(obj);
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    });
  }

  buildWebXrOverlayDom(options = {}) {
    const {
      onSmaller = () => this.applyXrScaleFactor(this._xrScaleFactor * 0.78),
      onBigger = () => this.applyXrScaleFactor(this._xrScaleFactor * 1.28),
      onRotate = () => {
        this._xrRotYOffset += Math.PI / 4;
        if (this.modelPivot) {
          this.modelPivot.rotation.y = this._xrRotYOffset;
          this.syncSunTransform({ updateShadow: true });
        }
      },
      onExit = () => this.stopWebXrAR(),
      container = null,
      footerHtml = ''
    } = options;

    const overlay = document.createElement('div');
    overlay.style.cssText = [
      container ? 'position:absolute' : 'position:fixed',
      'inset:0',
      container ? 'z-index:2' : 'z-index:2147483647',
      'pointer-events:none',
      'touch-action:none',
      'display:flex',
      'flex-direction:column',
      'justify-content:space-between',
      'padding:18px 16px 26px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
    ].join(';');

    const statusPill = document.createElement('div');
    statusPill.id = 'xr-status-pill';
    statusPill.textContent = 'Apunta lento a tu mesa o piso para detectar superficie...';
    statusPill.style.cssText = [
      'align-self:center',
      'background:rgba(15,23,42,0.86)',
      'color:#f8fafc',
      'border:1px solid rgba(255,255,255,0.22)',
      'border-radius:9999px',
      'padding:8px 14px',
      'font-size:12.5px',
      'font-weight:600',
      'text-align:center',
      'max-width:92vw',
      'backdrop-filter:blur(8px)',
      'pointer-events:none'
    ].join(';');

    const ctaWrap = document.createElement('div');
    ctaWrap.style.cssText = [
      'align-self:center',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:8px',
      'pointer-events:none'
    ].join(';');

    const bar = document.createElement('div');
    bar.style.cssText = [
      'align-self:center',
      'display:flex',
      'flex-wrap:wrap',
      'justify-content:center',
      'gap:8px',
      'padding:9px 12px',
      'background:rgba(15,23,42,0.88)',
      'border:1px solid rgba(255,255,255,0.2)',
      'border-radius:14px',
      'backdrop-filter:blur(10px)',
      'pointer-events:auto'
    ].join(';');

    const makeBtn = (html, title, bg = 'rgba(255,255,255,0.14)') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = title;
      b.innerHTML = html;
      b.style.cssText = [
        `background:${bg}`,
        'color:#fff',
        'border:1px solid rgba(255,255,255,0.22)',
        'border-radius:10px',
        'padding:7px 11px',
        'font-size:12.5px',
        'font-weight:700',
        'display:inline-flex',
        'align-items:center',
        'gap:5px',
        'cursor:pointer',
        'pointer-events:auto'
      ].join(';');
      return b;
    };

    const btnPlaceSurface = makeBtn(
      `${renderIcon('pin', { size: 15 })}<span>Fijar en esta mesa</span>`,
      'Fijar modelo sobre el círculo detectado',
      'linear-gradient(135deg, #059669, #10b981)'
    );
    btnPlaceSurface.style.display = 'none';
    btnPlaceSurface.style.padding = '10px 18px';
    btnPlaceSurface.style.fontSize = '13.5px';
    btnPlaceSurface.style.boxShadow = '0 10px 24px rgba(16,185,129,0.35)';

    const btnFallbackPlace = makeBtn(
      `${renderIcon('target', { size: 15 })}<span>Fijar frente a mí</span>`,
      'Fijar el objeto en el espacio a 1m frente a ti si la superficie es muy lisa',
      'rgba(14,165,233,0.88)'
    );
    btnFallbackPlace.style.display = 'none';

    const btnRelocate = makeBtn(`${renderIcon('target', { size: 14 })}<span>Reubicar</span>`, 'Elegir otra mesa o superficie');
    btnRelocate.style.display = 'none';
    const btnSmaller = makeBtn(`${renderIcon('minus', { size: 14 })}<span>Achicar</span>`, 'Reducir escala');
    const btnBigger = makeBtn(`${renderIcon('plus', { size: 14 })}<span>Agrandar</span>`, 'Aumentar escala');
    const btnRotate = makeBtn(`${renderIcon('refresh', { size: 14 })}<span>Girar</span>`, 'Rotar modelo 45°');
    const btnExit = makeBtn(`${renderIcon('x', { size: 14 })}<span>Salir AR</span>`, 'Cerrar sesión AR', 'rgba(239,68,68,0.88)');

    const blockBubble = (el) => {
      el.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
    };
    [bar, btnPlaceSurface, btnFallbackPlace].forEach(blockBubble);

    btnSmaller.addEventListener('click', (e) => {
      e.stopPropagation();
      onSmaller();
    });
    btnBigger.addEventListener('click', (e) => {
      e.stopPropagation();
      onBigger();
    });
    btnRotate.addEventListener('click', (e) => {
      e.stopPropagation();
      onRotate();
    });
    btnExit.addEventListener('click', (e) => {
      e.stopPropagation();
      onExit();
    });

    ctaWrap.append(btnPlaceSurface, btnFallbackPlace);

    const bottomStack = document.createElement('div');
    bottomStack.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;';
    bottomStack.appendChild(bar);
    if (footerHtml) {
      const credit = document.createElement('div');
      credit.style.cssText = [
        'font-size:10.5px',
        'color:rgba(226,232,240,0.85)',
        'background:rgba(15,23,42,0.72)',
        'padding:3px 9px',
        'border-radius:9999px',
        'pointer-events:auto'
      ].join(';');
      credit.innerHTML = footerHtml;
      blockBubble(credit);
      bottomStack.appendChild(credit);
    }

    bar.append(btnRelocate, btnSmaller, btnBigger, btnRotate, btnExit);
    overlay.append(statusPill, ctaWrap, bottomStack);
    (container || document.body).appendChild(overlay);
    return {
      overlay,
      statusPill,
      bar,
      btnPlaceSurface,
      btnFallbackPlace,
      btnRelocate
    };
  }

  /** Posiciona y escala modelPivot y su sombra anclada a una posición mundial AR 6DoF. */
  applySpatialPlacement(savedState, anchorPos, scaleFactor, shadowDisc) {
    if (!this.modelPivot || !savedState || !anchorPos) return;
    const clamped = Math.max(0.18, Math.min(4.5, scaleFactor));
    const totalScale = savedState.arBaseScale * clamped;
    this.modelPivot.scale.setScalar(totalScale);
    const lift = -(savedState.unscaledMinY || 0) * totalScale;
    this.modelPivot.position.set(anchorPos.x, anchorPos.y + lift, anchorPos.z);
    if (shadowDisc) {
      const span = Math.max(0.45, (this.framingRadius || 1) * 2.1 * totalScale);
      shadowDisc.position.set(anchorPos.x, anchorPos.y + 0.002, anchorPos.z);
      shadowDisc.scale.set(span, span, 1);
    }
    this.syncSunTransform({ updateShadow: true });
    return clamped;
  }

  applyXrScaleFactor(nextFactor) {
    this._xrScaleFactor = Math.max(0.18, Math.min(4.5, nextFactor));
    if (!this.modelPivot || !this._xrSavedState) return;
    if (this._xrAnchorPos) {
      this._xrScaleFactor = this.applySpatialPlacement(
        this._xrSavedState,
        this._xrAnchorPos,
        this._xrScaleFactor,
        this._xrGroundShadow
      );
      return;
    }
    const totalScale = this._xrSavedState.arBaseScale * this._xrScaleFactor;
    this.modelPivot.scale.setScalar(totalScale);
    this.syncSunTransform({ updateShadow: true });
  }

  startWebXrAR() {
    if (!navigator.xr || !this.renderer || !this.scene || !this.modelPivot) {
      this.openArModal({ modeHint: 'webxr-unavailable' });
      return;
    }
    if (this._xrSession) return;

    this.closeArModal();
    this.stopSlamCameraAR({ silent: true });
    this.stopCameraAR({ silent: true });
    if (this.isAerialMode) {
      this.exitAerialScanMode();
    }
    this.restoreModelRevealState();

    const ui = this.buildWebXrOverlayDom();
    const { overlay, statusPill, bar, btnPlaceSurface, btnFallbackPlace, btnRelocate } = ui;
    this._xrOverlayEl = overlay;

    const handleXrFallback = (err) => {
      if (this._xrOverlayEl) {
        this._xrOverlayEl.remove();
        this._xrOverlayEl = null;
      }
      const errDetail = err
        ? [err.name, err.message].filter(Boolean).join(': ')
        : '';
      const env = this.getArEnvironmentInfo();
      if (err && err.name === 'NotSupportedError' && env.hasCameraApi && (env.isHttpsOrigin || env.isLocalHost)) {
        this.startSlamCameraAR();
        return;
      }
      this.openArModal({ modeHint: 'webxr-denied', webXrError: errDetail });
    };

    // Llamar requestSession síncronamente dentro del gesto de clic del usuario
    navigator.xr
      .requestSession('immersive-ar', {
        optionalFeatures: ['local-floor', 'hit-test', 'anchors', 'dom-overlay'],
        domOverlay: { root: overlay }
      })
      .then(async (session) => {
        if (!this.isConnected) {
          await session.end().catch(() => {});
          return;
        }

        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }

        this._xrSession = session;
        this._xrHitTestSource = null;
        this._xrHitTestRequested = false;
        this._xrHitTestResultLast = null;
        this._xrAnchor = null;
        this._xrPlaced = false;
        this._xrLocked = false;
        this._xrStartedAt = performance.now();
        this._xrScaleFactor = 1;
        this._xrRotYOffset = 0;
        this._xrAnchorPos = null;

        const arBaseScale = this.computeArUnitScale();
        const unscaledMinY = this.computeVisiblePivotBottomMinY();
        this._xrSavedState = {
          pivotPos: this.modelPivot.position.clone(),
          pivotScale: this.modelPivot.scale.clone(),
          pivotRotY: this.modelPivot.rotation.y,
          pivotVisible: this.modelPivot.visible,
          autoRotate: this.autoRotate,
          controlsEnabled: this.controls ? this.controls.enabled : true,
          cameraPos: this.camera.position.clone(),
          cameraTarget: this.controls ? this.controls.target.clone() : new window.THREE.Vector3(),
          cameraNear: this.camera.near,
          cameraFar: this.camera.far,
          arBaseScale,
          unscaledMinY
        };

        session.addEventListener('end', () => {
          this.cleanupWebXrState();
        });

        let chosenSpace = 'local';
        try {
          await session.requestReferenceSpace('local-floor');
          chosenSpace = 'local-floor';
        } catch {
          chosenSpace = 'local';
        }

        this.renderer.xr.enabled = true;
        this.renderer.xr.setReferenceSpaceType(chosenSpace);
        await this.renderer.xr.setSession(session);

        if (!this.isConnected) {
          await session.end().catch(() => {});
          this.cleanupWebXrState();
          return;
        }

        this.autoRotate = false;
      if (this.controls) this.controls.enabled = false;

      this.camera.near = 0.02;
      this.camera.far = 60;
      this.camera.updateProjectionMatrix();
      try {
        session.updateRenderState({ depthNear: 0.02, depthFar: 60 });
      } catch {
        // Algunos drivers XR mantienen sus propios límites
      }

      this.scene.background = null;
      this.renderer.setClearColor(0x000000, 0);
      this.modelPivot.visible = false;
      this.modelPivot.scale.setScalar(arBaseScale);
      this.modelPivot.rotation.set(0, 0, 0);

      this._xrReticle = this.createArReticleMesh();
      this.scene.add(this._xrReticle);
      this._xrGroundShadow = this.createGroundedShadowDisc();
      this.scene.add(this._xrGroundShadow);

      const lockPlacedModel = async (worldPos, hitResult = null, refSpace = null) => {
        if (!this.modelPivot || !this._xrSavedState) return;
        this._xrPlaced = true;
        this._xrLocked = true;
        this._xrAnchorPos = worldPos.clone();

        const xrCamPos = this.renderer.xr.getCamera(this.camera).position;
        this._xrRotYOffset = Math.atan2(xrCamPos.x - worldPos.x, xrCamPos.z - worldPos.z);
        this.modelPivot.rotation.y = this._xrRotYOffset;
        this.modelPivot.visible = true;
        if (this._xrReticle) this._xrReticle.visible = false;
        if (this._xrGroundShadow) this._xrGroundShadow.visible = true;

        this.applyXrScaleFactor(this._xrScaleFactor);

        overlay.style.pointerEvents = 'auto';
        btnPlaceSurface.style.display = 'none';
        btnFallbackPlace.style.display = 'none';
        btnRelocate.style.display = 'inline-flex';
        if (statusPill) {
          statusPill.textContent = 'Fijado en tu espacio · Camina alrededor 360°, acércate o mira arriba/abajo';
        }

        if (hitResult && typeof hitResult.createAnchor === 'function') {
          try {
            if (this._xrAnchor && typeof this._xrAnchor.delete === 'function') {
              this._xrAnchor.delete();
            }
            this._xrAnchor = await hitResult.createAnchor();
          } catch {
            this._xrAnchor = null;
          }
        } else if (refSpace && typeof window.XRRigidTransform === 'function' && session.requestAnchor) {
          // Algunos runtimes solo crean anchors sobre hitTestResult
          this._xrAnchor = null;
        }
      };

      const unlockToReposition = () => {
        if (this._xrAnchor && typeof this._xrAnchor.delete === 'function') {
          try { this._xrAnchor.delete(); } catch {}
        }
        this._xrAnchor = null;
        this._xrPlaced = false;
        this._xrLocked = false;
        this._xrAnchorPos = null;
        this._xrStartedAt = performance.now();
        if (this.modelPivot) this.modelPivot.visible = false;
        if (this._xrGroundShadow) this._xrGroundShadow.visible = false;
        overlay.style.pointerEvents = 'none';
        btnRelocate.style.display = 'none';
        if (statusPill) {
          statusPill.textContent = 'Apunta a la nueva superficie para volver a fijarlo...';
        }
      };

      btnPlaceSurface.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._xrReticle && this._xrReticle.visible) {
          const pos = new window.THREE.Vector3().setFromMatrixPosition(this._xrReticle.matrix);
          lockPlacedModel(pos, this._xrHitTestResultLast, this.renderer.xr.getReferenceSpace());
        }
      });

      btnFallbackPlace.addEventListener('click', (e) => {
        e.stopPropagation();
        const xrCam = this.renderer.xr.getCamera(this.camera);
        const dir = new window.THREE.Vector3(0, 0, -1).applyQuaternion(xrCam.quaternion);
        dir.y = 0;
        if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
        dir.normalize();
        const dropPos = xrCam.position.clone().addScaledVector(dir, 1.05);
        dropPos.y = xrCam.position.y - 0.35;
        lockPlacedModel(dropPos, null, this.renderer.xr.getReferenceSpace());
      });

      btnRelocate.addEventListener('click', (e) => {
        e.stopPropagation();
        unlockToReposition();
      });

      // Gestos táctiles sobre el objeto fijado: 1 dedo rota sobre la mesa, 2 dedos escala sin mover anclaje
      let gesture = null;
      const getTouchDist = (t0, t1) => Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const isInsideBar = (target) => Boolean(target && (bar.contains(target) || btnPlaceSurface.contains(target) || btnFallbackPlace.contains(target)));

      const onOverlayTouchStart = (e) => {
        if (!this._xrLocked || isInsideBar(e.target)) return;
        if (e.touches.length === 1) {
          gesture = { mode: 'rotate', lastX: e.touches[0].clientX };
        } else if (e.touches.length >= 2) {
          gesture = {
            mode: 'pinch',
            startDist: Math.max(10, getTouchDist(e.touches[0], e.touches[1])),
            startScale: this._xrScaleFactor
          };
        }
      };
      const onOverlayTouchMove = (e) => {
        if (!this._xrLocked || !gesture) return;
        if (e.touches.length === 1 && gesture.mode === 'rotate') {
          const dx = e.touches[0].clientX - gesture.lastX;
          gesture.lastX = e.touches[0].clientX;
          this._xrRotYOffset += dx * 0.011;
          if (this.modelPivot) {
            this.modelPivot.rotation.y = this._xrRotYOffset;
            this.syncSunTransform({ updateShadow: true });
          }
        } else if (e.touches.length >= 2) {
          const dist = getTouchDist(e.touches[0], e.touches[1]);
          if (gesture.mode !== 'pinch') {
            gesture = { mode: 'pinch', startDist: Math.max(10, dist), startScale: this._xrScaleFactor };
          }
          this.applyXrScaleFactor(gesture.startScale * (dist / gesture.startDist));
        }
      };
      const onOverlayTouchEnd = (e) => {
        if (e.touches.length === 0) gesture = null;
        else if (e.touches.length === 1) gesture = { mode: 'rotate', lastX: e.touches[0].clientX };
      };
      overlay.addEventListener('touchstart', onOverlayTouchStart, { passive: true });
      overlay.addEventListener('touchmove', onOverlayTouchMove, { passive: true });
      overlay.addEventListener('touchend', onOverlayTouchEnd, { passive: true });
      overlay.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });

      this._xrController = this.renderer.xr.getController(0);
      this._onXrSelect = () => {
        if (this._xrLocked) return;
        if (this._xrReticle && this._xrReticle.visible) {
          const pos = new window.THREE.Vector3().setFromMatrixPosition(this._xrReticle.matrix);
          lockPlacedModel(pos, this._xrHitTestResultLast, this.renderer.xr.getReferenceSpace());
        }
      };
      this._xrController.addEventListener('select', this._onXrSelect);
      this.scene.add(this._xrController);

      this.dispatchEvent(new CustomEvent('ar-status', {
        detail: { platform: 'webxr', icon: 'smartphone', message: 'Escanea tu mesa y toca para fijar el modelo 3D' }
      }));

      this.renderer.setAnimationLoop((timestamp, frame) => {
        if (frame) {
          const refSpace = this.renderer.xr.getReferenceSpace();
          const activeSession = this.renderer.xr.getSession();
          if (!this._xrHitTestRequested && activeSession) {
            this._xrHitTestRequested = true;
            activeSession
              .requestReferenceSpace('viewer')
              .then((viewerSpace) => activeSession.requestHitTestSource({ space: viewerSpace }))
              .then((source) => {
                this._xrHitTestSource = source;
              })
              .catch(() => {
                this._xrHitTestSource = null;
              });
          }

          if (this._xrPlaced && this._xrAnchor && refSpace && frame.trackedAnchors && frame.trackedAnchors.has(this._xrAnchor)) {
            const anchorPose = frame.getPose(this._xrAnchor.anchorSpace, refSpace);
            if (anchorPose && this.modelPivot) {
              const p = anchorPose.transform.position;
              this._xrAnchorPos = new window.THREE.Vector3(p.x, p.y, p.z);
              const totalScale = this._xrSavedState.arBaseScale * this._xrScaleFactor;
              const lift = -(this._xrSavedState.unscaledMinY || 0) * totalScale;
              this.modelPivot.position.set(p.x, p.y + lift, p.z);
              if (this._xrGroundShadow) {
                this._xrGroundShadow.position.set(p.x, p.y + 0.002, p.z);
              }
            }
          } else if (!this._xrPlaced && this._xrHitTestSource && refSpace && this._xrReticle) {
            const results = frame.getHitTestResults(this._xrHitTestSource);
            if (results.length > 0) {
              const hit = results[0];
              const pose = hit.getPose(refSpace);
              if (pose) {
                this._xrHitTestResultLast = hit;
                this._xrReticle.visible = true;
                this._xrReticle.matrix.fromArray(pose.transform.matrix);
                btnPlaceSurface.style.display = 'inline-flex';
                btnFallbackPlace.style.display = 'none';
                if (statusPill) {
                  statusPill.textContent = 'Superficie detectada · Toca la pantalla o "Fijar en esta mesa"';
                }
              }
            } else {
              this._xrHitTestResultLast = null;
              this._xrReticle.visible = false;
              btnPlaceSurface.style.display = 'none';
              if (performance.now() - this._xrStartedAt > 2200) {
                btnFallbackPlace.style.display = 'inline-flex';
              }
            }
          } else if (!this._xrPlaced && performance.now() - this._xrStartedAt > 1800) {
            btnFallbackPlace.style.display = 'inline-flex';
          }
        }
        this.renderer.render(this.scene, this.camera);
        this.renderer.shadowMap.needsUpdate = false;
      });
      })
      .catch((err) => {
        this.cleanupWebXrState();
        handleXrFallback(err);
      });
  }

  stopWebXrAR() {
    if (this._xrSession) {
      const s = this._xrSession;
      this._xrSession = null;
      s.end().catch(() => {
        this.cleanupWebXrState();
      });
      return;
    }
    this.cleanupWebXrState();
  }

  cleanupWebXrState() {
    this._xrSession = null;
    this._xrHitTestSource = null;
    this._xrHitTestRequested = false;
    this._xrHitTestResultLast = null;
    this._xrPlaced = false;
    this._xrLocked = false;
    this._xrAnchorPos = null;

    if (this._xrAnchor) {
      try {
        if (typeof this._xrAnchor.delete === 'function') this._xrAnchor.delete();
      } catch {
        // Ignorar si la sesión ya liberó el ancla
      }
      this._xrAnchor = null;
    }

    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      this.renderer.xr.enabled = false;
    }
    if (this._xrReticle) {
      this.disposeThreeHelperObject(this._xrReticle);
      this._xrReticle = null;
    }
    if (this._xrGroundShadow) {
      this.disposeThreeHelperObject(this._xrGroundShadow);
      this._xrGroundShadow = null;
    }
    if (this._xrController) {
      if (this._onXrSelect) {
        this._xrController.removeEventListener('select', this._onXrSelect);
      }
      if (this._xrController.parent) this._xrController.parent.remove(this._xrController);
      this._xrController = null;
      this._onXrSelect = null;
    }
    if (this._xrOverlayEl) {
      this._xrOverlayEl.remove();
      this._xrOverlayEl = null;
    }
    if (this._xrSavedState) {
      const st = this._xrSavedState;
      this._xrSavedState = null;
      if (this.modelPivot) {
        this.modelPivot.position.copy(st.pivotPos);
        this.modelPivot.scale.copy(st.pivotScale);
        this.modelPivot.rotation.y = st.pivotRotY;
        this.modelPivot.visible = st.pivotVisible !== false;
      }
      this.autoRotate = st.autoRotate;
      this.updateRotateButtonLabel();
      this.syncSunTransform({ updateShadow: true });
      if (this.controls) {
        this.controls.enabled = st.controlsEnabled;
        this.controls.target.copy(st.cameraTarget);
      }
      if (this.camera) {
        this.camera.matrixAutoUpdate = true;
        this.camera.position.copy(st.cameraPos);
        if (Number.isFinite(st.cameraNear)) this.camera.near = st.cameraNear;
        if (Number.isFinite(st.cameraFar)) this.camera.far = st.cameraFar;
        this.camera.updateProjectionMatrix();
      }
      if (this.controls) this.controls.update();
      this.applyBackgroundStyle();
      this.applyLightingConfig();
    }
    this.requestRender({ durationMs: 1000 });
  }

  applySlamScaleFactor(nextFactor) {
    this._slamScaleFactor = Math.max(0.18, Math.min(4.5, nextFactor));
    if (!this.modelPivot || !this._slamSavedState) return;
    if (this._slamAnchorPos) {
      this._slamScaleFactor = this.applySpatialPlacement(
        this._slamSavedState,
        this._slamAnchorPos,
        this._slamScaleFactor,
        this._slamGroundShadow
      );
      return;
    }
    const totalScale = this._slamSavedState.arBaseScale * this._slamScaleFactor;
    this.modelPivot.scale.setScalar(totalScale);
  }

  /** Inicia sesión AR 6DoF markerless SLAM en el navegador (Android sin ARCore, iOS y WebGL2) usando @8thwall/engine-binary. */
  async startSlamCameraAR() {
    if (!this.modelPivot) return;
    if (this._slamSessionActive) return;

    const hasMedia =
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function';
    if (!hasMedia) {
      this.openArModal({
        modeHint: 'camera-denied',
        camError: 'La cámara Web en vivo requiere HTTPS.'
      });
      return;
    }

    // Pedir permisos iOS síncronamente dentro del clic del usuario antes de cualquier await
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().catch(() => {});
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }

    this.closeArModal();
    this.stopCameraAR({ silent: true });
    this.stopWebXrAR();
    if (this.isAerialMode) {
      this.exitAerialScanMode();
    }
    this.restoreModelRevealState();

    this._slamSessionActive = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const overlayWrap = document.createElement('div');
    overlayWrap.id = 'qr3d-xr8-overlay';
    overlayWrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#020617;touch-action:none;overflow:hidden;';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = Math.max(2, window.innerWidth || document.documentElement.clientWidth || 360);
      const vh = Math.max(2, window.innerHeight || document.documentElement.clientHeight || 640);
      canvas.width = Math.floor(vw * dpr);
      canvas.height = Math.floor(vh * dpr);
    };
    syncCanvasSize();
    overlayWrap.appendChild(canvas);

    const ui = this.buildWebXrOverlayDom({
      container: overlayWrap,
      onSmaller: () => this.applySlamScaleFactor(this._slamScaleFactor * 0.78),
      onBigger: () => this.applySlamScaleFactor(this._slamScaleFactor * 1.28),
      onRotate: () => {
        this._slamRotYOffset += Math.PI / 4;
        if (this.modelPivot) {
          this.modelPivot.rotation.y = this._slamRotYOffset;
        }
      },
      onExit: () => this.stopSlamCameraAR(),
      footerHtml:
        'AR 6DoF · XR Engine by <strong>Niantic Spatial</strong> · <a href="https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/LICENSE" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:underline;">Licencia</a>'
    });
    const { statusPill, btnPlaceSurface, btnFallbackPlace, btnRelocate } = ui;
    statusPill.textContent = 'Fijando modelo frente a ti en 6DoF...';
    document.body.appendChild(overlayWrap);
    this._slamOverlayEl = overlayWrap;

    let XR8;
    try {
      XR8 = await this.loadXr8SlamEngine();
    } catch (err) {
      this.stopSlamCameraAR({ silent: true });
      this.openArModal({
        modeHint: 'camera-denied',
        camError: (err && err.message) || 'No se pudo cargar el motor AR SLAM'
      });
      return;
    }

    if (!this._slamSessionActive || !this.isConnected) {
      this.stopSlamCameraAR({ silent: true });
      return;
    }

    const THREE = window.THREE;
    const arBaseScale = this.computeArUnitScale();
    const unscaledMinY = this.computeVisiblePivotBottomMinY();
    this._slamScaleFactor = 1;
    this._slamRotYOffset = 0;
    this._slamAnchorPos = null;
    this._slamSavedState = {
      pivotParent: this.modelPivot.parent || this.scene,
      pivotPos: this.modelPivot.position.clone(),
      pivotScale: this.modelPivot.scale.clone(),
      pivotRotY: this.modelPivot.rotation.y,
      pivotVisible: this.modelPivot.visible,
      autoRotate: this.autoRotate,
      arBaseScale,
      unscaledMinY,
      cleanupListeners: null
    };
    this.autoRotate = false;

    const startedAt = performance.now();
    let placed = false;
    let hasReticleHit = false;
    let autoPlacedOnStart = false;
    const lastHitPos = new THREE.Vector3();
    let sunLightSlam = null;

    const syncSlamLights = (targetVec) => {
      if (!sunLightSlam || !targetVec) return;
      sunLightSlam.position.set(targetVec.x + 3.2, targetVec.y + 6.0, targetVec.z + 3.2);
      sunLightSlam.target.position.copy(targetVec);
      sunLightSlam.target.updateMatrixWorld();
    };

    const lockSlamModel = (worldPos) => {
      if (!this.modelPivot || !this._slamSavedState || !worldPos) return;
      placed = true;
      this._slamAnchorPos = worldPos.clone();
      try {
        const xrCam = XR8.Threejs.xrScene().camera;
        if (xrCam) {
          this._slamRotYOffset = Math.atan2(xrCam.position.x - worldPos.x, xrCam.position.z - worldPos.z);
        }
      } catch {
        // Mantener orientación actual si la cámara aún no reporta pose
      }
      this.modelPivot.visible = true;
      this.modelPivot.rotation.set(0, this._slamRotYOffset, 0);
      this.applySlamScaleFactor(this._slamScaleFactor);
      syncSlamLights(this._slamAnchorPos);
      if (this._slamReticle) this._slamReticle.visible = false;
      if (this._slamGroundShadow) this._slamGroundShadow.visible = true;
      btnPlaceSurface.style.display = 'none';
      btnFallbackPlace.style.display = 'none';
      btnRelocate.style.display = 'inline-flex';
      statusPill.textContent =
        '¡Fijado en 6DoF! Camina alrededor 360°, arriba, abajo o acércate · Arrastra para rotar · Pellizca para escalar';
    };

    const unlockSlamModel = () => {
      placed = false;
      this._slamAnchorPos = null;
      if (this.modelPivot) this.modelPivot.visible = false;
      if (this._slamGroundShadow) this._slamGroundShadow.visible = false;
      btnRelocate.style.display = 'none';
      btnFallbackPlace.style.display = 'inline-flex';
      statusPill.textContent = 'Apunta lento a tu mesa, banco o piso y toca Fijar';
    };

    btnPlaceSurface.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasReticleHit) lockSlamModel(lastHitPos);
    });

    btnFallbackPlace.addEventListener('click', (e) => {
      e.stopPropagation();
      let xrCam = null;
      try {
        xrCam = XR8.Threejs.xrScene().camera;
      } catch {
        xrCam = null;
      }
      const camPos = new THREE.Vector3(0, 1.15, 0);
      const forward = new THREE.Vector3(0, 0, -1);
      if (xrCam) {
        camPos.copy(xrCam.position);
        forward.applyQuaternion(xrCam.quaternion);
      }
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
      forward.normalize();
      const targetPos = camPos.clone().addScaledVector(forward, 1.05);
      targetPos.y = camPos.y - 0.55;
      lockSlamModel(targetPos);
    });

    btnRelocate.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockSlamModel();
    });

    // Gestos táctiles: 1 dedo rota sobre su eje Y, 2 dedos escala, tap coloca si apunta al retículo
    let activeMode = null;
    let prevTouchX = 0;
    let prevPinchDist = 0;
    let touchMoved = false;

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        activeMode = 'drag';
        prevTouchX = e.touches[0].clientX;
        touchMoved = false;
      } else if (e.touches.length === 2) {
        activeMode = 'pinch';
        touchMoved = true;
        prevPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length === 1 && activeMode === 'drag') {
        const dx = e.touches[0].clientX - prevTouchX;
        if (Math.abs(dx) > 3) touchMoved = true;
        prevTouchX = e.touches[0].clientX;
        if (placed && this.modelPivot) {
          this._slamRotYOffset += dx * 0.0085;
          this.modelPivot.rotation.y = this._slamRotYOffset;
        }
      } else if (e.touches.length === 2 && activeMode === 'pinch') {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (prevPinchDist > 8 && dist > 8) {
          this.applySlamScaleFactor(this._slamScaleFactor * (dist / prevPinchDist));
          prevPinchDist = dist;
        }
      }
    };
    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        if (!placed && !touchMoved && hasReticleHit) {
          lockSlamModel(lastHitPos);
        }
        activeMode = null;
      } else if (e.touches.length === 1) {
        activeMode = 'drag';
        prevTouchX = e.touches[0].clientX;
      }
    };
    const onCanvasClick = () => {
      if (!placed && !touchMoved && hasReticleHit) {
        lockSlamModel(lastHitPos);
      }
    };
    const onWindowResize = () => {
      syncCanvasSize();
      try {
        const { camera: xrCam, renderer: xrRenderer } = XR8.Threejs.xrScene();
        if (xrRenderer) xrRenderer.setSize(canvas.width, canvas.height, false);
        if (xrCam) {
          xrCam.aspect = canvas.width / Math.max(1, canvas.height);
          xrCam.updateProjectionMatrix();
        }
      } catch {
        // Ignorar si XR8 aún está inicializando
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    canvas.addEventListener('click', onCanvasClick);
    window.addEventListener('resize', onWindowResize);

    this._slamSavedState.cleanupListeners = () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('click', onCanvasClick);
      window.removeEventListener('resize', onWindowResize);
    };

    try {
      XR8.clearCameraPipelineModules();
      XR8.addCameraPipelineModules([
        XR8.XrController.pipelineModule(),
        XR8.Threejs.pipelineModule(),
        {
          name: 'qr3d-slam-ar',
          onStart: () => {
            if (!this._slamSessionActive || !this.modelPivot) return;
            const { scene: xrScene, camera: xrCam, renderer: xrRenderer } = XR8.Threejs.xrScene();
            xrRenderer.toneMapping = THREE.ACESFilmicToneMapping;
            xrRenderer.toneMappingExposure = 1.08;
            xrRenderer.outputEncoding = THREE.sRGBEncoding;

            xrCam.position.set(0, 1.15, 0);
            xrCam.near = 0.02;
            xrCam.far = 100;
            xrCam.updateProjectionMatrix();
            XR8.XrController.updateCameraProjectionMatrix({
              origin: xrCam.position,
              facing: xrCam.quaternion,
              updateRecenterPoint: false
            });

            const hemi = new THREE.HemisphereLight(0xfffaf0, 0x64748b, 0.95);
            const amb = new THREE.AmbientLight(0xffffff, 0.55);
            sunLightSlam = new THREE.DirectionalLight(0xfff4d6, 1.35);
            sunLightSlam.position.set(3.2, 6.0, 3.2);
            const fill = new THREE.DirectionalLight(0xcbe4ff, 0.45);
            fill.position.set(-4, 3, -4);
            xrScene.add(hemi, amb, sunLightSlam, sunLightSlam.target, fill);

            this.modelPivot.visible = false;
            this.modelPivot.scale.setScalar(arBaseScale);
            this.modelPivot.rotation.set(0, 0, 0);
            xrScene.add(this.modelPivot);
            this.refreshPivotForRenderer(this.modelPivot);

            this._slamReticle = this.createArReticleMesh();
            this._slamReticle.matrixAutoUpdate = true;
            xrScene.add(this._slamReticle);

            this._slamGroundShadow = this.createGroundedShadowDisc();
            xrScene.add(this._slamGroundShadow);

            // Auto-anclar directamente en frente del usuario desde el primer frame
            // sin que necesite tocar ningún botón
            const autoPlaceInFront = () => {
              if (!this._slamSessionActive || placed || autoPlacedOnStart) return;
              autoPlacedOnStart = true;
              const { camera: cam } = XR8.Threejs.xrScene();
              const camPos = cam ? cam.position.clone() : new THREE.Vector3(0, 1.15, 0);
              const forward = new THREE.Vector3(0, 0, -1);
              if (cam) forward.applyQuaternion(cam.quaternion);
              forward.y = 0;
              if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
              forward.normalize();
              const targetPos = camPos.clone().addScaledVector(forward, 1.1);
              targetPos.y = camPos.y - 0.55;
              lockSlamModel(targetPos);
              statusPill.textContent =
                'Modelo fijado frente a ti · Camina alrededor, acércate o toca Reubicar para moverlo';
            };
            // Intentar auto-colocar después de que SLAM inicializa la pose (350ms)
            setTimeout(() => { try { autoPlaceInFront(); } catch {} }, 350);
          },
          onUpdate: () => {
            if (!this._slamSessionActive || placed || !this._slamReticle) return;

            // Mostrar el botón "Fijar aquí" inmediatamente desde el primer update
            if (btnFallbackPlace.style.display === 'none') {
              btnFallbackPlace.style.display = 'inline-flex';
            }

            let hits = null;
            try {
              hits = XR8.XrController.hitTest(0.5, 0.56, [
                'DETECTED_SURFACE',
                'ESTIMATED_SURFACE',
                'FEATURE_POINT'
              ]);
            } catch {
              hits = null;
            }
            if (hits && hits.length > 0) {
              const bestHit =
                hits.find((h) => h.type === 'DETECTED_SURFACE') ||
                hits.find((h) => h.type === 'ESTIMATED_SURFACE') ||
                hits[0];
              if (bestHit && bestHit.position) {
                hasReticleHit = true;
                lastHitPos.set(bestHit.position.x, bestHit.position.y, bestHit.position.z);
                this._slamReticle.position.copy(lastHitPos);
                this._slamReticle.visible = true;
                btnPlaceSurface.style.display = 'inline-flex';
                btnFallbackPlace.style.display = 'inline-flex';
                statusPill.textContent =
                  bestHit.type === 'DETECTED_SURFACE'
                    ? 'Superficie detectada: toca "Fijar en esta mesa" para anclar en 6DoF'
                    : 'Apunta a tu mesa o banco y toca "Fijar en esta mesa"';
                return;
              }
            }
            hasReticleHit = false;
            this._slamReticle.visible = false;
            btnPlaceSurface.style.display = 'none';
            btnFallbackPlace.style.display = 'inline-flex';
            statusPill.textContent =
              'Mueve lento el teléfono o toca "Fijar aquí" para anclar frente a ti';
          },
          onCameraStatusChange: ({ status, reason }) => {
            if (!this._slamSessionActive) return;
            if (status === 'requesting') {
              statusPill.textContent = 'Permite el acceso a la cámara trasera para AR 6DoF...';
            } else if (status === 'hasStream') {
              statusPill.textContent = 'Apunta lento a tu mesa, banco o piso para detectar superficie...';
            } else if (status === 'failed') {
              const reasonText =
                typeof reason === 'string'
                  ? reason
                  : (reason && reason.message) || 'No se pudo iniciar la cámara trasera';
              this.stopSlamCameraAR({ silent: true });
              this.openArModal({ modeHint: 'camera-denied', camError: reasonText });
            }
          },
          onException: (err) => {
            console.warn('[3DQR XR8 SLAM]', err);
            if (!this._slamSessionActive) return;
            const errMsg = (err && err.message) || String(err || 'Error WebGL/SLAM');
            this.stopSlamCameraAR({ silent: true });
            this.openArModal({
              modeHint: 'camera-denied',
              camError: `El dispositivo no pudo ejecutar SLAM (${errMsg}). Puedes usar Cámara 3DoF o Scene Viewer.`
            });
          }
        }
      ]);

      XR8.XrController.configure({
        scale: 'absolute',
        disableWorldTracking: false,
        enableLighting: false
      });

      XR8.run({
        canvas,
        cameraConfig: { direction: XR8.XrConfig.camera().BACK },
        allowedDevices: XR8.XrConfig.device().ANY
      });
    } catch (err) {
      this.stopSlamCameraAR({ silent: true });
      this.openArModal({
        modeHint: 'camera-denied',
        camError: (err && err.message) || 'No se pudo iniciar XR8 SLAM'
      });
    }
  }

  /** Detiene XR8 SLAM y restaura el modelo, luces y bucle principal de Three.js. */
  stopSlamCameraAR({ silent = false } = {}) {
    if (!this._slamSessionActive && !this._slamOverlayEl && !this._slamSavedState) {
      return;
    }
    this._slamSessionActive = false;

    if (window.XR8) {
      try {
        if (typeof window.XR8.stop === 'function') window.XR8.stop();
      } catch {
        // Ignorar si aún no arrancó
      }
      try {
        if (typeof window.XR8.clearCameraPipelineModules === 'function') {
          window.XR8.clearCameraPipelineModules();
        }
      } catch {
        // Ignorar
      }
    }

    if (this._slamReticle) {
      this.disposeThreeHelperObject(this._slamReticle);
      this._slamReticle = null;
    }
    if (this._slamGroundShadow) {
      this.disposeThreeHelperObject(this._slamGroundShadow);
      this._slamGroundShadow = null;
    }

    if (this._slamSavedState) {
      const st = this._slamSavedState;
      this._slamSavedState = null;
      if (typeof st.cleanupListeners === 'function') {
        st.cleanupListeners();
      }
      if (this.modelPivot) {
        const targetParent = st.pivotParent || this.scene;
        if (targetParent && this.modelPivot.parent !== targetParent) {
          targetParent.add(this.modelPivot);
          this.refreshPivotForRenderer(this.modelPivot);
        }
        this.modelPivot.position.copy(st.pivotPos);
        this.modelPivot.scale.copy(st.pivotScale);
        this.modelPivot.rotation.set(0, st.pivotRotY, 0);
        this.modelPivot.visible = st.pivotVisible !== false;
      }
      this.autoRotate = st.autoRotate;
      this.updateRotateButtonLabel();
      this.syncSunTransform({ updateShadow: true });
    }

    if (this._slamOverlayEl) {
      this._slamOverlayEl.remove();
      this._slamOverlayEl = null;
    }

    this._slamAnchorPos = null;
    if (!silent) {
      this.requestRender({ durationMs: 1000 });
    }
  }

  computeQuaternionFromDeviceOrientation(alphaDeg, betaDeg, gammaDeg, screenAngleDeg) {
    const THREE = window.THREE;
    const degToRad = Math.PI / 180;
    const alpha = (alphaDeg || 0) * degToRad;
    const beta = (betaDeg || 0) * degToRad;
    const gamma = (gammaDeg || 0) * degToRad;
    const orient = (screenAngleDeg || 0) * degToRad;

    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const out = new THREE.Quaternion();

    euler.set(beta, alpha, -gamma, 'YXZ');
    out.setFromEuler(euler);
    out.multiply(q1);
    out.multiply(q0.setFromAxisAngle(zee, -orient));
    return out;
  }

  extractYawPitchFromQuat(rawQuat) {
    const THREE = window.THREE;
    if (!rawQuat || !THREE) return null;
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(rawQuat);
    const horizLen = Math.hypot(look.x, look.z);
    let yaw = 0;
    if (horizLen > 0.08) {
      yaw = Math.atan2(-look.x, -look.z);
      this._camArLastValidYaw = yaw;
    } else if (Number.isFinite(this._camArLastValidYaw)) {
      yaw = this._camArLastValidYaw;
    }
    const pitch = Math.asin(THREE.MathUtils.clamp(look.y, -0.94, 0.94));
    return { yaw, pitch };
  }

  getCameraArAnchorCenter(distance = 1.6) {
    const THREE = window.THREE;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    return fwd.multiplyScalar(distance);
  }

  anchorCameraArInFront({ resetScale = false } = {}) {
    if (!this.modelPivot || !this.camera || !window.THREE) return;
    const st = this._arCameraSavedState;
    if (!st) return;

    if (resetScale) {
      this._camArScaleFactor = 1;
      this._camArElevOffset = -0.28;
      this._camArRotYOffset = 0;
    }
    this._camArAnchorDir = this.getCameraArAnchorCenter(1).normalize();
    this._camArAnchorDistance = 1.55;
    this._camArAnchored = true;

    const dirX = this._camArAnchorDir.x;
    const dirZ = this._camArAnchorDir.z;
    this._camArRotYOffset = Math.atan2(-dirX, -dirZ);

    if (this._camArGroundShadow) {
      this._camArGroundShadow.visible = true;
    }

    const anchorBtn = this.shadowRoot && this.shadowRoot.getElementById('ar-cam-anchor');
    if (anchorBtn) {
      anchorBtn.innerHTML = `${renderIcon('target', { size: 14 })}<span>Reubicar</span>`;
    }
    const pill = this.shadowRoot && this.shadowRoot.getElementById('ar-camera-pill');
    if (pill) {
      pill.textContent = 'Cámara 3DoF (sin WebXR 6DoF) · Gira para mirar alrededor; arrastra para rotar el edificio y pellizca para acercar';
    }
    this.updateCameraArPose();
  }

  toggleCameraArAnchor() {
    if (!this._isCameraArActive) return;
    if (this._camArHasGyro) {
      this.anchorCameraArInFront({ resetScale: false });
      this.showToastMessage('Modelo fijado frente a tu cámara', 2400, 'pin');
    } else if (this.controls && this.defaultView) {
      this.controls.reset();
      this.requestRender({ durationMs: 400 });
    }
  }

  adjustCameraArScale(mult) {
    if (!this.modelPivot || !this._isCameraArActive) return;
    if (this._camArHasGyro && this._arCameraSavedState) {
      this._camArScaleFactor = Math.max(0.2, Math.min(4.0, this._camArScaleFactor * mult));
      this.updateCameraArPose();
    } else {
      const next = Math.max(0.2, Math.min(4.0, this.modelPivot.scale.x * mult));
      this.modelPivot.scale.setScalar(next);
      this.syncSunTransform({ updateShadow: true });
    }
    this.requestRender({ durationMs: 400 });
  }

  updateCameraArPose() {
    if (!this._isCameraArActive || !this._camArHasGyro || !this.camera || !this.modelPivot || !window.THREE) return;
    let rawQuat = null;
    if (this._camArSensorQuat) {
      rawQuat = this._camArSensorQuat;
    } else if (this._camArOrientation) {
      const { alpha, beta, gamma } = this._camArOrientation;
      rawQuat = this.computeQuaternionFromDeviceOrientation(alpha, beta, gamma, this._camArScreenAngle);
    }
    const targetYawPitch = rawQuat ? this.extractYawPitchFromQuat(rawQuat) : null;
    if (targetYawPitch) {
      if (!this._camArAnchored || !Number.isFinite(this._camArSmoothYaw)) {
        this._camArSmoothYaw = targetYawPitch.yaw;
        this._camArSmoothPitch = targetYawPitch.pitch;
      } else {
        const dyaw = Math.atan2(
          Math.sin(targetYawPitch.yaw - this._camArSmoothYaw),
          Math.cos(targetYawPitch.yaw - this._camArSmoothYaw)
        );
        this._camArSmoothYaw += dyaw * 0.55;
        this._camArSmoothPitch += (targetYawPitch.pitch - this._camArSmoothPitch) * 0.55;
      }
      this.camera.quaternion.setFromEuler(
        new window.THREE.Euler(this._camArSmoothPitch, this._camArSmoothYaw, 0, 'YXZ')
      );
      this.camera.position.set(0, 0, 0);
    }

    if (!this._camArAnchored || !this._camArAnchorDir) {
      this.anchorCameraArInFront({ resetScale: true });
      return;
    }

    const st = this._arCameraSavedState;
    const totalScale = (st ? st.arBaseScale : 1) * this._camArScaleFactor;
    const dist = Math.max(0.45, Math.min(4.5, this._camArAnchorDistance));
    const lift = -(st ? st.unscaledMinY : 0) * totalScale;
    const ax = this._camArAnchorDir.x * dist;
    const ay = this._camArElevOffset;
    const az = this._camArAnchorDir.z * dist;

    this.modelPivot.scale.setScalar(totalScale);
    this.modelPivot.rotation.y = this._camArRotYOffset;
    this.modelPivot.position.set(ax, ay + lift, az);

    if (this._camArGroundShadow) {
      const span = Math.max(0.45, (this.framingRadius || 1) * 2.1 * totalScale);
      this._camArGroundShadow.position.set(ax, ay + 0.002, az);
      this._camArGroundShadow.scale.set(span, span, 1);
    }
    this.syncSunTransform({ updateShadow: false });
  }

  async startCameraAR({ keepScale = false } = {}) {
    const videoEl = this.shadowRoot && this.shadowRoot.getElementById('ar-camera-video');
    if (!videoEl) return;

    const env = this.getArEnvironmentInfo();
    if (!env.hasCameraApi) {
      const msg = env.isHttpsOrigin
        ? 'Tu navegador no permite acceso a cámara en este contexto.'
        : 'La cámara web en móvil requiere abrir la vista por HTTPS (o localhost en PC).';
      this.showToastMessage(msg, 4800, 'alert-triangle');
      this.dispatchEvent(new CustomEvent('ar-status', { detail: { platform: 'camera', icon: 'alert-triangle', message: msg } }));
      return;
    }

    // Solicitar permiso de sensores de orientación dentro del gesto de clic (iOS 13+)
    if (
      typeof window !== 'undefined' &&
      window.DeviceOrientationEvent &&
      typeof window.DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        await window.DeviceOrientationEvent.requestPermission();
      } catch {
        // Continuar aunque el usuario deniegue giroscopio
      }
    }

    try {
      this.stopSlamCameraAR({ silent: true });
      this.stopCameraAR({ silent: true, keepUiState: keepScale });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: this._arCameraFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      if (!this.isConnected) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this._arCameraStream = stream;
      this._isCameraArActive = true;
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});

      if (this.isAerialMode) {
        this.exitAerialScanMode();
      }
      this.restoreModelRevealState();

      if (!keepScale && this.modelPivot && this.camera) {
        const arBaseScale = this.computeArUnitScale();
        const unscaledMinY = this.computeVisiblePivotBottomMinY();
        this._arCameraBaseScale = this.modelPivot.scale.x || 1;
        this._arCameraSavedState = {
          pivotPos: this.modelPivot.position.clone(),
          pivotScale: this.modelPivot.scale.clone(),
          pivotRotY: this.modelPivot.rotation.y,
          cameraPos: this.camera.position.clone(),
          cameraTarget: this.controls ? this.controls.target.clone() : new window.THREE.Vector3(),
          cameraNear: this.camera.near,
          cameraFar: this.camera.far,
          controlsEnabled: this.controls ? this.controls.enabled : true,
          autoRotate: this.autoRotate,
          arBaseScale,
          unscaledMinY
        };
        this._camArScaleFactor = 1;
        this._camArElevOffset = -0.28;
        this._camArRotYOffset = 0;
        this._camArAnchorDistance = 1.55;
        this._camArHasGyro = false;
        this._camArAnchored = false;
        this._camArOrientation = null;
        this._camArSensorQuat = null;
        this._camArLastValidYaw = 0;
        this._camArSmoothYaw = null;
        this._camArSmoothPitch = 0;
      }

      this._camArScreenAngle = (window.screen && window.screen.orientation && Number(window.screen.orientation.angle)) || Number(window.orientation) || 0;

      if (this.camera) {
        this.camera.near = 0.02;
        this.camera.far = 120;
        this.camera.updateProjectionMatrix();
      }
      if (!this._camArGroundShadow && this.scene && window.THREE) {
        this._camArGroundShadow = this.createGroundedShadowDisc();
        this.scene.add(this._camArGroundShadow);
      }

      const canvas = this.shadowRoot && this.shadowRoot.getElementById('viewport');
      const anchorBtn = this.shadowRoot && this.shadowRoot.getElementById('ar-cam-anchor');
      const pill = this.shadowRoot && this.shadowRoot.getElementById('ar-camera-pill');
      if (pill) {
        pill.textContent = env.isMobile
          ? 'Buscando sensores del celular... Arrastra o pellizca para inspeccionar'
          : 'Vista previa con cámara web · Arrastra para rotar y usa rueda/pellizco para acercar';
      }
      if (anchorBtn) {
        anchorBtn.style.display = env.isMobile ? 'inline-flex' : 'none';
        anchorBtn.innerHTML = `${renderIcon('pin', { size: 14 })}<span>Fijar aquí</span>`;
      }

      if (!keepScale) {
        let orientationSensor = null;
        const THREE = window.THREE;
        const w3cToThreeQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

        const activateGyroUi = () => {
          if (!this._camArHasGyro) {
            this._camArHasGyro = true;
            if (this.controls) this.controls.enabled = false;
            if (anchorBtn) anchorBtn.style.display = 'inline-flex';
            this.anchorCameraArInFront({ resetScale: false });
          }
          this.requestRender({ durationMs: 300 });
        };

        // Intentar Generic Sensor API sin gimbal lock en Chrome Android
        if (typeof window.RelativeOrientationSensor === 'function') {
          try {
            orientationSensor = new window.RelativeOrientationSensor({ frequency: 60, referenceFrame: 'screen' });
            orientationSensor.addEventListener('reading', () => {
              if (!this._isCameraArActive || !orientationSensor.quaternion) return;
              const q = orientationSensor.quaternion;
              const sensorThree = new THREE.Quaternion(q[0], q[1], q[2], q[3]);
              this._camArSensorQuat = w3cToThreeQuat.clone().multiply(sensorThree);
              activateGyroUi();
            });
            orientationSensor.addEventListener('error', () => {
              this._camArSensorQuat = null;
              orientationSensor = null;
            });
            orientationSensor.start();
          } catch {
            orientationSensor = null;
          }
        }

        const onDeviceOrient = (e) => {
          if (!this._isCameraArActive || this._camArSensorQuat) return;
          if (!Number.isFinite(e.alpha) || !Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
          this._camArOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
          activateGyroUi();
        };

        const onScreenOrient = () => {
          this._camArScreenAngle = (window.screen && window.screen.orientation && Number(window.screen.orientation.angle)) || Number(window.orientation) || 0;
        };

        let touchInfo = null;
        const getTouchDist = (t0, t1) => Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const onTouchStart = (e) => {
          if (!this._isCameraArActive || !this._camArHasGyro) return;
          if (e.touches.length === 1) {
            touchInfo = { mode: 'drag', lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
          } else if (e.touches.length >= 2) {
            touchInfo = {
              mode: 'pinch',
              startDist: Math.max(10, getTouchDist(e.touches[0], e.touches[1])),
              startAnchorDist: this._camArAnchorDistance
            };
          }
        };
        const onTouchMove = (e) => {
          if (!this._isCameraArActive || !this._camArHasGyro || !touchInfo) return;
          if (e.touches.length === 1 && touchInfo.mode === 'drag') {
            const dx = e.touches[0].clientX - touchInfo.lastX;
            const dy = e.touches[0].clientY - touchInfo.lastY;
            touchInfo.lastX = e.touches[0].clientX;
            touchInfo.lastY = e.touches[0].clientY;
            this._camArRotYOffset += dx * 0.011;
            this._camArElevOffset = Math.max(-1.3, Math.min(0.85, this._camArElevOffset - dy * 0.0035));
            this.requestRender({ durationMs: 300 });
          } else if (e.touches.length >= 2) {
            const d = getTouchDist(e.touches[0], e.touches[1]);
            if (touchInfo.mode !== 'pinch') {
              touchInfo = { mode: 'pinch', startDist: Math.max(10, d), startAnchorDist: this._camArAnchorDistance };
            }
            this._camArAnchorDistance = Math.max(0.45, Math.min(4.5, touchInfo.startAnchorDist * (touchInfo.startDist / d)));
            this.requestRender({ durationMs: 300 });
          }
        };
        const onTouchEnd = () => { touchInfo = null; };

        window.addEventListener('deviceorientation', onDeviceOrient);
        window.addEventListener('orientationchange', onScreenOrient);
        if (canvas) {
          canvas.addEventListener('touchstart', onTouchStart, { passive: true });
          canvas.addEventListener('touchmove', onTouchMove, { passive: true });
          canvas.addEventListener('touchend', onTouchEnd, { passive: true });
        }

        this._camArCleanupFn = () => {
          if (orientationSensor) {
            try { orientationSensor.stop(); } catch {}
            orientationSensor = null;
          }
          window.removeEventListener('deviceorientation', onDeviceOrient);
          window.removeEventListener('orientationchange', onScreenOrient);
          if (canvas) {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
          }
        };
      }

      this.closeArModal();

      const host = this.shadowRoot && this.shadowRoot.host;
      if (host) host.classList.add('ar-camera-active');
      if (this.scene) this.scene.background = null;
      if (this.renderer) this.renderer.setClearColor(0x000000, 0);
      this.requestRender({ durationMs: 1200 });

      const msg = env.isMobile
        ? 'Cámara activa · Fija el modelo y mueve el celular para explorarlo'
        : 'Vista previa con cámara web activa';
      this.showToastMessage(msg, 3600, 'camera');
      this.dispatchEvent(new CustomEvent('ar-status', { detail: { platform: 'camera', icon: 'camera', message: msg } }));
    } catch (err) {
      const msg = `No se pudo iniciar la cámara: ${err.message || 'permiso denegado'}`;
      this.showToastMessage(msg, 4500, 'alert-triangle');
      this.dispatchEvent(new CustomEvent('ar-status', { detail: { platform: 'camera', icon: 'alert-triangle', error: err.message, message: msg } }));
    }
  }

  stopCameraAR({ silent = false, keepUiState = false } = {}) {
    if (this._arCameraStream) {
      for (const track of this._arCameraStream.getTracks()) {
        track.stop();
      }
      this._arCameraStream = null;
    }
    const videoEl = this.shadowRoot && this.shadowRoot.getElementById('ar-camera-video');
    if (videoEl) {
      videoEl.srcObject = null;
    }
    if (keepUiState) return;

    if (this._camArCleanupFn) {
      this._camArCleanupFn();
      this._camArCleanupFn = null;
    }
    if (this._camArGroundShadow) {
      this.disposeThreeHelperObject(this._camArGroundShadow);
      this._camArGroundShadow = null;
    }

    this._isCameraArActive = false;
    this._camArHasGyro = false;
    this._camArAnchored = false;
    this._camArOrientation = null;
    this._camArSensorQuat = null;
    this._camArLastValidYaw = 0;
    this._camArAnchorDir = null;

    const host = this.shadowRoot && this.shadowRoot.host;
    if (host) host.classList.remove('ar-camera-active');

    if (this._arCameraSavedState) {
      const st = this._arCameraSavedState;
      this._arCameraSavedState = null;
      if (this.modelPivot) {
        this.modelPivot.position.copy(st.pivotPos);
        this.modelPivot.scale.copy(st.pivotScale);
        this.modelPivot.rotation.y = st.pivotRotY;
      }
      this.autoRotate = st.autoRotate;
      this.updateRotateButtonLabel();
      this.syncSunTransform({ updateShadow: true });
      if (this.controls) {
        this.controls.enabled = st.controlsEnabled;
        this.controls.target.copy(st.cameraTarget);
      }
      if (this.camera) {
        this.camera.position.copy(st.cameraPos);
        if (Number.isFinite(st.cameraNear)) this.camera.near = st.cameraNear;
        if (Number.isFinite(st.cameraFar)) this.camera.far = st.cameraFar;
        this.camera.updateProjectionMatrix();
      }
      if (this.controls) this.controls.update();
    } else if (this.modelPivot && Number.isFinite(this._arCameraBaseScale)) {
      this.modelPivot.scale.setScalar(this._arCameraBaseScale);
    }

    this.applyBackgroundStyle();
    this.applyLightingConfig();
    this.requestRender({ durationMs: 600 });
    if (!silent) {
      this.showToastMessage('Modo Cámara cerrado', 2400, 'camera');
    }
  }

  openArModal({ modeHint = 'auto', webXrError = '', camError = '' } = {}) {
    const modal = this.shadowRoot && this.shadowRoot.getElementById('ar-modal');
    const descEl = this.shadowRoot && this.shadowRoot.getElementById('ar-modal-desc');
    const warnEl = this.shadowRoot && this.shadowRoot.getElementById('ar-modal-warn');
    const qrBox = this.shadowRoot && this.shadowRoot.getElementById('ar-modal-qr-box');
    const qrImg = this.shadowRoot && this.shadowRoot.getElementById('ar-modal-qr-img');
    const urlInput = this.shadowRoot && this.shadowRoot.getElementById('ar-modal-url-input');
    const actionsEl = this.shadowRoot && this.shadowRoot.getElementById('ar-modal-actions');
    if (!modal || !descEl || !warnEl || !actionsEl) return;

    const env = this.getArEnvironmentInfo();
    const viewUrl = this.getPublicViewUrl();
    const viewQrEndpoint = this.getEndpoint('viewQr');

    if (urlInput) urlInput.value = viewUrl;
    if (qrImg && viewQrEndpoint) {
      qrImg.src = `${viewQrEndpoint}?t=${Date.now()}`;
      if (qrBox) qrBox.style.display = 'flex';
    } else if (qrBox) {
      qrBox.style.display = 'none';
    }

    if (env.isIOS) {
      descEl.textContent = env.isNonSafariIos
        ? 'Usa "AR Espacial 6DoF en Cámara" aquí mismo, o abre en Safari / AR Quick Look para fijar el modelo sobre tu mesa y caminar 360°.'
        : 'Toca "Abrir en AR Quick Look" o "AR Espacial 6DoF en Cámara" para fijar el objeto sobre tu mesa y explorarlo caminando alrededor 360°.';
    } else if (env.isAndroid) {
      descEl.textContent = env.isInAppWebView
        ? 'Estás dentro de un visor interno (WhatsApp/QR). Puedes probar "AR Espacial 6DoF en Cámara" aquí o abrir en Google Chrome para mayor fluidez.'
        : 'Fija el objeto 3D sobre tu mesa, banco o piso con seguimiento espacial 6DoF para caminar 360°, verlo por arriba, por abajo o acercar la cámara.';
    } else {
      descEl.textContent = 'Para fijar el modelo en una mesa real y recorrerlo moviendo y acercando la cámara (6DoF), escanea este QR con tu celular Android o iPhone, o prueba AR SLAM en cámara.';
    }

    let warningText = '';
    if (camError) {
      warningText = camError;
    } else if (env.isLocalHost || !env.isHttpsOrigin) {
      warningText = 'Estás en entorno local/HTTP. La Realidad Aumentada móvil en cámara exige abrir una URL pública HTTPS.';
    } else if (modeHint === 'webxr-denied') {
      warningText = `WebXR no pudo iniciar (${webXrError || 'ARCore no disponible en este navegador'}). Usa "AR Espacial 6DoF en Cámara (XR8 SLAM)" abajo.`;
    } else if (modeHint === 'sceneviewer-fallback') {
      warningText = 'Google Scene Viewer no se abrió en este teléfono. Usa "AR Espacial 6DoF en Cámara (XR8 SLAM)" para fijar y rodear el modelo directamente aquí.';
    }
    warnEl.textContent = warningText;
    warnEl.style.display = warningText ? 'block' : 'none';

    actionsEl.innerHTML = '';

    if (env.isIOS && env.absUsdzUrl) {
      const iosBtn = this.createIosQuickLookAnchor(env.absUsdzUrl, {
        labelText: 'Abrir en AR Quick Look (iOS)',
        className: 'ar-btn-primary'
      });
      actionsEl.appendChild(iosBtn);
    }

    if (env.isAndroid && env.isInAppWebView && env.androidChromeIntentUrl) {
      const chromeBtn = document.createElement('a');
      chromeBtn.className = 'ar-btn-primary';
      chromeBtn.href = env.androidChromeIntentUrl;
      chromeBtn.innerHTML = `${renderIcon('globe', { size: 15 })}<span>Abrir en Google Chrome (AR completo)</span>`;
      actionsEl.appendChild(chromeBtn);
    }

    if (env.isAndroid && env.webXrSupported) {
      const xrBtn = document.createElement('button');
      xrBtn.type = 'button';
      xrBtn.className = env.isInAppWebView ? 'ar-btn-secondary' : 'ar-btn-primary';
      xrBtn.innerHTML = `${renderIcon('scan', { size: 15 })}<span>Iniciar AR Espacial en Mesa (WebXR 6DoF)</span>`;
      xrBtn.addEventListener('click', () => this.startWebXrAR());
      actionsEl.appendChild(xrBtn);
    }

    if (env.hasCameraApi && (env.isHttpsOrigin || env.isLocalHost)) {
      const slamBtn = document.createElement('button');
      slamBtn.type = 'button';
      const makeSlamPrimary = !env.isMobile || (env.isAndroid && !env.webXrSupported && !env.isInAppWebView);
      slamBtn.className = makeSlamPrimary ? 'ar-btn-primary' : 'ar-btn-secondary';
      slamBtn.innerHTML = `${renderIcon('scan', { size: 15 })}<span>AR Espacial 6DoF en Cámara (SLAM)</span>`;
      slamBtn.addEventListener('click', () => this.startSlamCameraAR());
      actionsEl.appendChild(slamBtn);
    }

    if (env.isAndroid && env.absArModelUrl && env.isHttpsOrigin && !env.isLocalHost) {
      const svBtn = document.createElement('a');
      svBtn.className = 'ar-btn-secondary';
      svBtn.href = this.buildAndroidSceneViewerIntent(env.absArModelUrl);
      svBtn.innerHTML = `${renderIcon('smartphone', { size: 15 })}<span>Abrir en Google Scene Viewer (6DoF)</span>`;
      actionsEl.appendChild(svBtn);
    }

    if (env.hasCameraApi) {
      const camBtn = document.createElement('button');
      camBtn.type = 'button';
      camBtn.className = 'ar-btn-secondary';
      const camLabel = env.isMobile ? 'Cámara 3DoF (respaldo sin caminar)' : 'Vista previa con Cámara Web (3DoF)';
      camBtn.innerHTML = `${renderIcon('camera', { size: 15 })}<span>${camLabel}</span>`;
      camBtn.addEventListener('click', () => this.startCameraAR());
      actionsEl.appendChild(camBtn);
    }

    this._arModalOpen = true;
    modal.classList.add('open');

    const statusMsg = env.isMobile
      ? 'Opciones de Realidad Aumentada abiertas'
      : 'Escanea el QR con tu celular para AR espacial en mesa';
    this.dispatchEvent(new CustomEvent('ar-status', {
      detail: { platform: env.isIOS ? 'ios' : (env.isAndroid ? 'android' : 'desktop'), icon: 'smartphone', message: statusMsg }
    }));
  }

  closeArModal() {
    this._arModalOpen = false;
    const modal = this.shadowRoot && this.shadowRoot.getElementById('ar-modal');
    if (modal) modal.classList.remove('open');
  }

  launchAR() {
    const modelEndpoint = this.getEndpoint('model');
    if (!modelEndpoint) {
      this.showToastMessage('Aún no hay un modelo 3D disponible para AR', 3500, 'alert-triangle');
      return;
    }

    const env = this.getArEnvironmentInfo();

    if (env.isIOS && env.absUsdzUrl) {
      if (env.isNonSafariIos) {
        this.openArModal({ modeHint: 'ios-browser' });
        return;
      }
      this.triggerIosQuickLook(env.absUsdzUrl);
      return;
    }

    if (env.isAndroid) {
      const hasXrApi = typeof navigator !== 'undefined' && navigator.xr && typeof navigator.xr.requestSession === 'function';
      if (this._webXrSupported === true || (this._webXrSupported === null && hasXrApi)) {
        this.startWebXrAR();
        return;
      }
      if (env.isInAppWebView) {
        this.openArModal({ modeHint: 'android-webview' });
        return;
      }
      if (env.hasCameraApi && (env.isHttpsOrigin || env.isLocalHost)) {
        this.startSlamCameraAR();
        return;
      }
      if (env.isHttpsOrigin && !env.isLocalHost && env.absArModelUrl) {
        this.triggerAndroidSceneViewer(env.absArModelUrl);
        return;
      }
      this.openArModal({ modeHint: 'android-http' });
      return;
    }

    this.openArModal({ modeHint: 'desktop' });
  }

  showToastMessage(text, durationMs = 3500, iconName = null) {
    const toast = this.shadowRoot.getElementById('scan-toast');
    if (!toast) return;
    if (text) {
      toast.innerHTML = '';
      if (iconName) {
        const iconWrap = document.createElement('span');
        iconWrap.style.display = 'inline-flex';
        iconWrap.style.alignItems = 'center';
        iconWrap.innerHTML = renderIcon(iconName, { size: 15 });
        toast.appendChild(iconWrap);
      }
      toast.appendChild(document.createTextNode(text));
    }
    toast.classList.add('show');
    if (this._arToastTimer) clearTimeout(this._arToastTimer);
    this._arToastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, durationMs);
  }

  showScanToast() {
    this.showToastMessage('¡QR escaneado! Nuevo código activo', 3500, 'sparkles');
  }
}

if (!customElements.get('qr-3d-viewer')) {
  customElements.define('qr-3d-viewer', Qr3dViewer);
}

export default Qr3dViewer;
