/**
 * Presets y sanitización de configuración visual del visor 3D (Modo Automático y Manual).
 * Se almacena dentro de qr_items.metadata.viewerConfig sin alterar el esquema de base de datos.
 */

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

const VALID_MODES = new Set(['auto', 'manual']);
const VALID_PRESETS = new Set([
  'auto',
  'archaeological',
  'museum_night',
  'studio',
  'outdoor',
  'warm_sand',
  'transparent',
  'custom'
]);
const VALID_FIX_SRGB = new Set(['auto', 'on', 'off']);
const VALID_EDGE_MODES = new Set(['smart', 'all', 'off']);
const VALID_CAMERA_MODES = new Set(['smooth', 'direct']);
const VALID_SUN_MODES = new Set(['scene', 'model']);
const VALID_BG_PRESETS = new Set([
  'auto',
  'warm_dark',
  'slate',
  'night',
  'light_studio',
  'outdoor',
  'warm_sand',
  'transparent',
  'custom'
]);
const VALID_UI_THEMES = new Set(['auto', 'dark', 'light', 'custom']);
const VALID_QR_REVEAL_STYLES = new Set(['fade', 'blocks']);

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeHexColor(value, fallback = '#1a1612') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

export function sanitizeOptionalHexColor(value, fallback = null) {
  if (value === undefined) return fallback;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : fallback;
}

function sanitizeVec3(arr) {
  if (!Array.isArray(arr) || arr.length !== 3) return null;
  const nums = arr.map(Number);
  if (!nums.every(Number.isFinite)) return null;
  return nums.map((n) => Math.round(n * 1000) / 1000);
}

function sanitizeCameraPose(pose) {
  if (!pose || typeof pose !== 'object') return null;
  const position = sanitizeVec3(pose.position);
  const target = sanitizeVec3(pose.target);
  if (!position || !target) return null;
  const pivotRotY = Number.isFinite(Number(pose.pivotRotY))
    ? Math.round(Number(pose.pivotRotY) * 10000) / 10000
    : 0;
  return { position, target, pivotRotY };
}

function parseJsonObject(rawInput) {
  let parsed = rawInput;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch {
      parsed = {};
    }
  }
  return parsed && typeof parsed === 'object' ? parsed : {};
}

/**
 * Normaliza y valida la configuración visual del visor recibida desde el cliente.
 * Si mode === 'auto', restaura los valores del perfil automático preservando preferencias explícitas opcionales.
 */
export function sanitizeViewerConfig(rawInput) {
  const parsed = parseJsonObject(rawInput);

  const inferredMode =
    !VALID_MODES.has(parsed.mode) && parsed.preset && parsed.preset !== 'auto' && VIEWER_PRESETS[parsed.preset]
      ? 'manual'
      : parsed.mode;
  const mode = VALID_MODES.has(inferredMode) ? inferredMode : 'auto';
  if (mode === 'auto') {
    const bgPreset = VALID_BG_PRESETS.has(parsed.backgroundPreset)
      ? parsed.backgroundPreset
      : VIEWER_PRESETS.auto.backgroundPreset;
    const bgColor = bgPreset === 'custom'
      ? sanitizeHexColor(parsed.backgroundColor, VIEWER_PRESETS.auto.backgroundColor)
      : (VIEWER_PRESETS[bgPreset]?.backgroundColor || VIEWER_PRESETS.auto.backgroundColor);
    return {
      ...VIEWER_PRESETS.auto,
      backgroundPreset: bgPreset,
      backgroundColor: bgColor,
      sunMode: VALID_SUN_MODES.has(parsed.sunMode) ? parsed.sunMode : VIEWER_PRESETS.auto.sunMode,
      autoRotate: typeof parsed.autoRotate === 'boolean' ? parsed.autoRotate : VIEWER_PRESETS.auto.autoRotate,
      cameraMode: VALID_CAMERA_MODES.has(parsed.cameraMode) ? parsed.cameraMode : VIEWER_PRESETS.auto.cameraMode,
      cameraPose: sanitizeCameraPose(parsed.cameraPose),
      uiTheme: VALID_UI_THEMES.has(parsed.uiTheme) ? parsed.uiTheme : VIEWER_PRESETS.auto.uiTheme,
      accentColor: sanitizeOptionalHexColor(parsed.accentColor, VIEWER_PRESETS.auto.accentColor),
      surfaceColor: sanitizeOptionalHexColor(parsed.surfaceColor, VIEWER_PRESETS.auto.surfaceColor),
      textColor: sanitizeOptionalHexColor(parsed.textColor, VIEWER_PRESETS.auto.textColor),
      showToolbar: typeof parsed.showToolbar === 'boolean' ? parsed.showToolbar : VIEWER_PRESETS.auto.showToolbar,
      showHint: typeof parsed.showHint === 'boolean' ? parsed.showHint : VIEWER_PRESETS.auto.showHint,
      qrRevealStyle: VALID_QR_REVEAL_STYLES.has(parsed.qrRevealStyle)
        ? parsed.qrRevealStyle
        : VIEWER_PRESETS.auto.qrRevealStyle
    };
  }

  const presetKey = VALID_PRESETS.has(parsed.preset) ? parsed.preset : 'custom';
  const base = VIEWER_PRESETS[presetKey] || VIEWER_PRESETS.auto;

  return {
    mode: 'manual',
    preset: presetKey,
    exposure: clampNum(parsed.exposure, 0.4, 2.0, base.exposure),
    sunAzimuth: clampNum(parsed.sunAzimuth, -180, 180, base.sunAzimuth),
    sunElevation: clampNum(parsed.sunElevation, 10, 85, base.sunElevation),
    sunIntensity: clampNum(parsed.sunIntensity, 0.2, 3.0, base.sunIntensity),
    sunMode: VALID_SUN_MODES.has(parsed.sunMode) ? parsed.sunMode : base.sunMode,
    ambientIntensity: clampNum(parsed.ambientIntensity, 0.0, 1.0, base.ambientIntensity),
    colorBoost: clampNum(parsed.colorBoost, 0.6, 1.6, base.colorBoost),
    fixSrgb: VALID_FIX_SRGB.has(parsed.fixSrgb) ? parsed.fixSrgb : base.fixSrgb,
    edgeMode: VALID_EDGE_MODES.has(parsed.edgeMode) ? parsed.edgeMode : base.edgeMode,
    backgroundPreset: VALID_BG_PRESETS.has(parsed.backgroundPreset)
      ? parsed.backgroundPreset
      : base.backgroundPreset,
    backgroundColor: sanitizeHexColor(parsed.backgroundColor, base.backgroundColor),
    showTotem: typeof parsed.showTotem === 'boolean' ? parsed.showTotem : base.showTotem,
    autoRotate: typeof parsed.autoRotate === 'boolean' ? parsed.autoRotate : base.autoRotate,
    cameraMode: VALID_CAMERA_MODES.has(parsed.cameraMode) ? parsed.cameraMode : base.cameraMode,
    cameraPose: sanitizeCameraPose(parsed.cameraPose),
    uiTheme: VALID_UI_THEMES.has(parsed.uiTheme) ? parsed.uiTheme : base.uiTheme,
    accentColor: sanitizeOptionalHexColor(parsed.accentColor, base.accentColor),
    surfaceColor: sanitizeOptionalHexColor(parsed.surfaceColor, base.surfaceColor),
    textColor: sanitizeOptionalHexColor(parsed.textColor, base.textColor),
    showToolbar: typeof parsed.showToolbar === 'boolean' ? parsed.showToolbar : base.showToolbar,
    showHint: typeof parsed.showHint === 'boolean' ? parsed.showHint : base.showHint,
    qrRevealStyle: VALID_QR_REVEAL_STYLES.has(parsed.qrRevealStyle)
      ? parsed.qrRevealStyle
      : base.qrRevealStyle
  };
}

/**
 * Normaliza la configuración visual por defecto de un sitio/tenant.
 * Permite almacenar presets, tema UI, visibilidad de controles y colores por defecto de QR.
 */
export function sanitizeTenantDefaultConfig(rawInput) {
  if (rawInput === null || rawInput === undefined || rawInput === '') {
    return {};
  }
  const parsed = parseJsonObject(rawInput);
  if (Object.keys(parsed).length === 0) {
    return {};
  }
  if (parsed.reset === true || parsed.enabled === false) {
    return {};
  }

  const viewerCfg = sanitizeViewerConfig(parsed);
  const qrColorPrimary = sanitizeOptionalHexColor(parsed.qrColorPrimary ?? parsed.color_primary, null);
  const qrColorSecondary = sanitizeOptionalHexColor(parsed.qrColorSecondary ?? parsed.color_secondary, null);

  return {
    ...viewerCfg,
    qrColorPrimary,
    qrColorSecondary
  };
}

/**
 * Resuelve el viewerConfig efectivo respetando cascada:
 * configuración explícita del QR > tema por defecto del Tenant > preset auto por defecto.
 */
export function resolveEffectiveViewerConfig(qrViewerConfig, tenantDefaultConfig = null, hasCustomViewerConfig = undefined) {
  const tenantRaw = parseJsonObject(tenantDefaultConfig);
  const hasTenantDefaults = Object.keys(tenantRaw).length > 0;
  const tenantCfg = hasTenantDefaults ? sanitizeTenantDefaultConfig(tenantRaw) : null;

  const qrRaw = parseJsonObject(qrViewerConfig);
  const qrHasKeys = Object.keys(qrRaw).length > 0 && qrRaw.inheritTenant !== true;
  const useCustomQr = hasCustomViewerConfig === true || (hasCustomViewerConfig === undefined && qrHasKeys);

  if (!useCustomQr) {
    if (tenantCfg) {
      const { qrColorPrimary, qrColorSecondary, ...viewerPart } = tenantCfg;
      return sanitizeViewerConfig(viewerPart);
    }
    return sanitizeViewerConfig({});
  }

  const sanitizedQr = sanitizeViewerConfig(qrRaw);
  if (!tenantCfg) {
    return sanitizedQr;
  }

  // Heredar tokens de UI/tema del tenant cuando el QR no los fijó explícitamente
  return {
    ...sanitizedQr,
    uiTheme: qrRaw.uiTheme !== undefined ? sanitizedQr.uiTheme : (tenantCfg.uiTheme || sanitizedQr.uiTheme),
    accentColor: qrRaw.accentColor !== undefined ? sanitizedQr.accentColor : (tenantCfg.accentColor ?? sanitizedQr.accentColor),
    surfaceColor: qrRaw.surfaceColor !== undefined ? sanitizedQr.surfaceColor : (tenantCfg.surfaceColor ?? sanitizedQr.surfaceColor),
    textColor: qrRaw.textColor !== undefined ? sanitizedQr.textColor : (tenantCfg.textColor ?? sanitizedQr.textColor),
    showToolbar: qrRaw.showToolbar !== undefined ? sanitizedQr.showToolbar : tenantCfg.showToolbar,
    showHint: qrRaw.showHint !== undefined ? sanitizedQr.showHint : tenantCfg.showHint,
    qrRevealStyle: qrRaw.qrRevealStyle !== undefined ? sanitizedQr.qrRevealStyle : (tenantCfg.qrRevealStyle || sanitizedQr.qrRevealStyle)
  };
}
