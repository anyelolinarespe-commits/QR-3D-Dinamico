import { db } from '../db/pool.js';
import { config } from '../config/env.js';
import { eventBus } from '../config/redis.js';
import { generateQrMatrix, generateQrPngBuffer } from '../services/qr.service.js';
import {
  sanitizeOptionalHexColor,
  sanitizeViewerConfig,
  VIEWER_PRESETS
} from '../services/viewerConfig.service.js';
import {
  buildScanUrl,
  buildViewUrl,
  ensureQrPngForBaseUrl,
  getDailyStatsForQr,
  parseMetadata,
  resolveRequestBaseUrl,
  sendCachedBinaryAsset,
  sendCachedGlbModel,
  serializePublicViewData
} from '../services/qrLink.service.js';
import { buildArModelForItem } from '../services/arModel.service.js';
import { getIconMap, renderIcon } from '../../widget/icons.js';

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderStatusPage({ statusTitle, badgeText, message, iconName = 'lock' }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${escapeHtml(statusTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body {
      background: radial-gradient(circle at 50% 30%, #171923 0%, #090b10 100%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 18px;
      padding: 36px 28px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
    }
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: rgba(239, 68, 68, 0.12);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
      margin: 0 auto 14px;
    }
    .badge {
      display: inline-block;
      background: rgba(239, 68, 68, 0.14);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 9999px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 14px;
    }
    h1 { font-size: 21px; font-weight: 800; margin-bottom: 10px; color: #f8fafc; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.55; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${renderIcon(iconName, { size: 30 })}</div>
    <span class="badge">${escapeHtml(badgeText)}</span>
    <h1>${escapeHtml(statusTitle)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

function parseQueryBool(val) {
  if (val === undefined || val === null || val === '') return null;
  const norm = String(val).trim().toLowerCase();
  if (norm === '1' || norm === 'true' || norm === 'yes' || norm === 'on') return true;
  if (norm === '0' || norm === 'false' || norm === 'no' || norm === 'off') return false;
  return null;
}

function resolveViewOptions(baseViewerConfig, query = {}) {
  const cfg = { ...baseViewerConfig };
  const attrs = {};
  const q = query && typeof query === 'object' ? query : {};

  const embed = parseQueryBool(q.embed) === true;
  const rawTheme = typeof q.theme === 'string' ? q.theme.trim().toLowerCase() : (typeof q.preset === 'string' ? q.preset.trim().toLowerCase() : '');
  const themeAliases = { light: 'warm_sand', dark: 'warm_dark', munay: 'warm_sand' };
  const resolvedPreset = themeAliases[rawTheme] || rawTheme;
  if (resolvedPreset && VIEWER_PRESETS[resolvedPreset]) {
    Object.assign(cfg, VIEWER_PRESETS[resolvedPreset]);
    attrs.theme = resolvedPreset;
  }

  const rawUiTheme = typeof q.ui_theme === 'string' ? q.ui_theme.trim().toLowerCase() : '';
  if (['auto', 'light', 'dark', 'custom'].includes(rawUiTheme)) {
    cfg.uiTheme = rawUiTheme;
    attrs['ui-theme'] = rawUiTheme;
  }

  const transparentParam = parseQueryBool(q.transparent);
  if (transparentParam === true || String(q.bg || '').trim().toLowerCase() === 'transparent') {
    cfg.backgroundPreset = 'transparent';
    attrs.transparent = 'true';
  } else if (typeof q.bg === 'string' && q.bg.trim()) {
    const bgHex = sanitizeOptionalHexColor(q.bg, null);
    if (bgHex) {
      cfg.mode = 'manual';
      cfg.preset = 'custom';
      cfg.backgroundPreset = 'custom';
      cfg.backgroundColor = bgHex;
      attrs['bg-color'] = bgHex;
    } else if (VIEWER_PRESETS[q.bg.trim().toLowerCase()]) {
      cfg.backgroundPreset = q.bg.trim().toLowerCase();
      attrs['bg-preset'] = cfg.backgroundPreset;
    }
  }

  const accentHex = sanitizeOptionalHexColor(q.accent, null);
  if (accentHex) {
    cfg.accentColor = accentHex;
    attrs['accent-color'] = accentHex;
  }
  const surfaceHex = sanitizeOptionalHexColor(q.surface, null);
  if (surfaceHex) {
    cfg.surfaceColor = surfaceHex;
    attrs['surface-color'] = surfaceHex;
  }
  const textHex = sanitizeOptionalHexColor(q.text, null);
  if (textHex) {
    cfg.textColor = textHex;
    attrs['text-color'] = textHex;
  }

  const toolbarParam = parseQueryBool(q.toolbar);
  if (toolbarParam !== null) {
    cfg.showToolbar = toolbarParam;
    attrs['hide-toolbar'] = toolbarParam ? 'false' : 'true';
  }

  const hintParam = parseQueryBool(q.hint);
  if (hintParam !== null) {
    cfg.showHint = hintParam;
    attrs['hide-hint'] = hintParam ? 'false' : 'true';
  }

  const totemParam = parseQueryBool(q.totem);
  if (totemParam !== null) {
    cfg.showTotem = totemParam;
    attrs['show-totem'] = totemParam ? 'true' : 'false';
  }

  const revealParam = typeof q.reveal === 'string' ? q.reveal.trim().toLowerCase() : '';
  if (revealParam === 'blocks' || revealParam === 'fade') {
    cfg.qrRevealStyle = revealParam;
    attrs['qr-reveal'] = revealParam;
  }

  const badgeParam = parseQueryBool(q.badge);
  const hideBadge = embed ? (badgeParam === null ? false : !badgeParam) : (badgeParam === null ? true : !badgeParam);

  return {
    embed,
    hideBadge,
    attrs,
    viewerConfig: sanitizeViewerConfig(cfg)
  };
}

function isLightUiConfig(cfg) {
  if (cfg.uiTheme === 'light') return true;
  if (cfg.uiTheme === 'dark') return false;
  if (['warm_sand', 'light_studio', 'outdoor', 'transparent'].includes(cfg.backgroundPreset)) return true;
  if (cfg.backgroundPreset === 'custom' && /^#[0-9a-fA-F]{6}$/.test(cfg.backgroundColor || '')) {
    const hex = cfg.backgroundColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 155;
  }
  return false;
}

function renderEmbedOnlyPage(viewData, options) {
  const safeTitle = escapeHtml(viewData.title);
  const safeToken = escapeHtml(viewData.viewToken);
  const cfg = options.viewerConfig;
  const isTransparent = cfg.backgroundPreset === 'transparent';
  const isLight = isLightUiConfig(cfg);

  const attrPairs = [
    `id="unified-viewer"`,
    `view-token="${safeToken}"`,
    `ar-title="${safeTitle}"`,
    `flat="true"`,
    `hide-badge="${options.hideBadge ? 'true' : 'false'}"`,
    `viewer-config="${escapeHtml(JSON.stringify(cfg))}"`,
    `width="100%"`,
    `height="100%"`
  ];
  for (const [k, v] of Object.entries(options.attrs)) {
    attrPairs.push(`${escapeHtml(k)}="${escapeHtml(v)}"`);
  }

  const cssVars = [];
  if (cfg.accentColor) {
    cssVars.push(`--qr3d-accent:${escapeHtml(cfg.accentColor)};`);
    cssVars.push(`--qr3d-toast-bg:${escapeHtml(cfg.accentColor)};`);
  }
  if (cfg.surfaceColor) cssVars.push(`--qr3d-surface:${escapeHtml(cfg.surfaceColor)};`);
  if (cfg.textColor) cssVars.push(`--qr3d-text:${escapeHtml(cfg.textColor)};`);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${safeTitle}</title>
  <script src="/widget/3dqr-viewer.js" type="module"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${isTransparent ? 'transparent' : (isLight ? '#f4efe6' : '#070a11')};
    }
    qr-3d-viewer {
      width: 100%;
      height: 100%;
      display: block;
      ${cssVars.join(' ')}
    }
  </style>
</head>
<body>
  <qr-3d-viewer ${attrPairs.join(' ')}></qr-3d-viewer>
</body>
</html>`;
}

function renderUnifiedViewPage(viewData, query = {}) {
  const options = resolveViewOptions(viewData.viewerConfig, query);
  if (options.embed) {
    return renderEmbedOnlyPage(viewData, options);
  }

  const effectiveCfg = options.viewerConfig;
  const isLightUi = isLightUiConfig(effectiveCfg);
  const accentHex = effectiveCfg.accentColor || (isLightUi ? '#0f3d2e' : '#0284c7');
  const pageBgCss = isLightUi
    ? (effectiveCfg.backgroundPreset === 'custom' && effectiveCfg.backgroundColor
        ? `radial-gradient(circle at 30% 20%, ${escapeHtml(effectiveCfg.backgroundColor)} 0%, #e7dfd0 85%)`
        : 'radial-gradient(circle at 30% 20%, #faf8f4 0%, #ebe3d5 80%)')
    : 'radial-gradient(circle at 30% 20%, #141c2f 0%, #070a11 72%)';
  const panelBgCss = escapeHtml(effectiveCfg.surfaceColor || (isLightUi ? 'rgba(255, 255, 255, 0.94)' : '#101624'));
  const dockBgCss = escapeHtml(effectiveCfg.surfaceColor || (isLightUi ? 'rgba(255, 255, 255, 0.96)' : 'rgba(16, 22, 36, 0.92)'));
  const textMainCss = escapeHtml(effectiveCfg.textColor || (isLightUi ? '#0f172a' : '#f8fafc'));
  const mutedCss = isLightUi ? '#475569' : '#94a3b8';
  const borderCss = isLightUi ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148, 163, 184, 0.16)';
  const safeTitle = escapeHtml(viewData.title);
  const safeDesc = escapeHtml(viewData.description);
  const safeToken = escapeHtml(viewData.viewToken);
  const isStatic = viewData.linkMode === 'static';
  const extraViewerAttrs = Object.entries(options.attrs)
    .map(([k, v]) => `${escapeHtml(k)}="${escapeHtml(v)}"`)
    .join(' ');
  const initialDataJson = JSON.stringify({
    viewToken: viewData.viewToken,
    linkMode: viewData.linkMode,
    rotationStrategy: viewData.rotationStrategy,
    rotationIntervalSeconds: viewData.rotationIntervalSeconds,
    nextRotationAt: viewData.nextRotationAt,
    lastRotatedAt: viewData.lastRotatedAt,
    rotationCount: viewData.rotationCount,
    scanCount: viewData.scanCount,
    dailyScans: viewData.dailyScans,
    dailyUniqueVisitors: viewData.dailyUniqueVisitors,
    todayDate: viewData.todayDate,
    isActive: viewData.isActive,
    viewEnabled: viewData.viewEnabled
  }).replace(/</g, '\\u003c');

  let modeBadgeHtml = `${renderIcon('lock', { size: 14 })}<span>QR Estático · Enlace Fijo</span>`;
  let modeHelpText = 'Este código QR es estático: su enlace permanece fijo de forma permanente.';
  if (!isStatic) {
    if (viewData.rotationStrategy === 'timed') {
      modeBadgeHtml = `${renderIcon('refresh', { size: 14 })}<span>QR Dinámico · Cambia cada ${viewData.rotationIntervalSeconds}s</span>`;
      modeHelpText = `Este enlace cambia automáticamente cada ${viewData.rotationIntervalSeconds} segundos en tiempo real.`;
    } else if (viewData.rotationStrategy === 'dynamic') {
      modeBadgeHtml = `${renderIcon('zap', { size: 14 })}<span>QR Dinámico · Cada ${viewData.rotationIntervalSeconds}s y por escaneo</span>`;
      modeHelpText = `El código rota automáticamente cada ${viewData.rotationIntervalSeconds}s y también tras cada escaneo.`;
    } else {
      modeBadgeHtml = `${renderIcon('zap', { size: 14 })}<span>QR Dinámico · 1 Solo Uso</span>`;
      modeHelpText = 'Este código cambia automáticamente cada vez que es escaneado.';
    }
  }

  const viewIconsJson = JSON.stringify(
    getIconMap(['lock', 'refresh', 'zap', 'scan', 'smartphone', 'undo', 'user', 'pause', 'alert-triangle'], { size: 15 })
  ).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${safeTitle} — Vista 3D + QR</title>
  <script src="/widget/3dqr-viewer.js" type="module"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: ${isLightUi ? '#f5efe6' : '#070a11'};
      --panel: ${panelBgCss};
      --dock-bg: ${dockBgCss};
      --panel-border: ${borderCss};
      --text: ${textMainCss};
      --muted: ${mutedCss};
      --accent: ${escapeHtml(accentHex)};
      --accent-green: ${isLightUi ? '#0f3d2e' : '#22c55e'};
      --accent-amber: #f59e0b;
    }
    html, body {
      height: 100%;
      background: ${pageBgCss};
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 18px;
      gap: 16px;
      max-width: 1440px;
      margin: 0 auto;
    }
    .topbar {
      background: var(--dock-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .title-block h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .title-block p {
      font-size: 13px;
      color: var(--muted);
      margin-top: 3px;
      max-width: 720px;
    }
    .status-pills {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid;
    }
    .pill-static {
      background: ${isLightUi ? 'rgba(14, 116, 144, 0.10)' : 'rgba(56, 189, 248, 0.14)'};
      color: ${isLightUi ? '#0e7490' : '#7dd3fc'};
      border-color: ${isLightUi ? 'rgba(14, 116, 144, 0.28)' : 'rgba(56, 189, 248, 0.35)'};
    }
    .pill-dynamic {
      background: ${isLightUi ? 'rgba(217, 119, 6, 0.10)' : 'rgba(245, 158, 11, 0.16)'};
      color: ${isLightUi ? '#b45309' : '#fcd34d'};
      border-color: ${isLightUi ? 'rgba(217, 119, 6, 0.28)' : 'rgba(245, 158, 11, 0.38)'};
    }
    .pill-live {
      background: ${isLightUi ? 'rgba(15, 61, 46, 0.10)' : 'rgba(34, 197, 94, 0.14)'};
      color: ${isLightUi ? '#065f46' : '#86efac'};
      border-color: ${isLightUi ? 'rgba(15, 61, 46, 0.28)' : 'rgba(34, 197, 94, 0.34)'};
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.85); }
    }

    .unified-stage {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 16px;
      align-items: stretch;
      min-height: 560px;
    }

    .model-card {
      position: relative;
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      overflow: hidden;
      min-height: 520px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
    }

    @media (max-width: 960px) {
      .unified-stage {
        grid-template-columns: 1fr;
        min-height: auto;
      }
      .model-card {
        min-height: 340px;
        height: 46vh;
      }
    }

    .qr-dock {
      background: var(--dock-bg);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 16px;
      box-shadow: ${isLightUi ? '0 16px 36px rgba(15, 23, 42, 0.10)' : '0 20px 40px rgba(0, 0, 0, 0.45)'};
      position: relative;
      overflow: hidden;
    }
    .qr-dock-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .qr-dock-head h2 {
      font-size: 16px;
      font-weight: 800;
      color: var(--text);
    }
    .qr-tag {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 9999px;
      background: ${isLightUi ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.07)'};
      color: ${isLightUi ? '#334155' : '#cbd5e1'};
    }
    .qr-frame-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .qr-frame {
      width: 100%;
      max-width: 268px;
      aspect-ratio: 1 / 1;
      background: #ffffff;
      border-radius: 16px;
      padding: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${isLightUi ? '0 10px 24px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(15, 23, 42, 0.08)' : '0 14px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.14)'};
      position: relative;
      transition: transform 0.28s ease, box-shadow 0.28s ease;
    }
    .qr-frame.rotated-flash {
      transform: scale(1.03);
      box-shadow: 0 0 30px rgba(34, 197, 94, 0.42), 0 0 0 2px #22c55e;
    }
    #dock-qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      transition: opacity 0.24s ease, transform 0.24s ease;
    }
    #dock-qr-img.updating {
      opacity: 0.2;
      transform: scale(0.92);
    }

    .countdown-box {
      width: 100%;
      background: ${isLightUi ? 'rgba(15, 23, 42, 0.04)' : 'rgba(15, 23, 42, 0.85)'};
      border: 1px solid ${isLightUi ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148, 163, 184, 0.18)'};
      border-radius: 12px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .countdown-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: ${isLightUi ? '#334155' : '#cbd5e1'};
      font-weight: 600;
    }
    .countdown-timer {
      font-family: monospace;
      font-size: 13px;
      color: ${isLightUi ? '#b45309' : '#fcd34d'};
      font-weight: 700;
    }
    .progress-track {
      width: 100%;
      height: 6px;
      border-radius: 9999px;
      background: ${isLightUi ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.08)'};
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #f59e0b, #22c55e);
      transition: width 0.25s linear;
    }

    .info-panel {
      background: ${isLightUi ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255, 255, 255, 0.035)'};
      border: 1px solid ${isLightUi ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)'};
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 12.5px;
      color: ${isLightUi ? '#334155' : '#cbd5e1'};
      line-height: 1.5;
    }
    .daily-counter-card {
      background: ${isLightUi ? 'rgba(15, 61, 46, 0.06)' : 'linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(34, 197, 94, 0.1))'};
      border: 1px solid ${isLightUi ? 'rgba(15, 61, 46, 0.22)' : 'rgba(56, 189, 248, 0.3)'};
      border-radius: 12px;
      padding: 11px 13px;
      margin-bottom: 10px;
      transition: box-shadow 0.25s ease, transform 0.25s ease;
    }
    .daily-counter-card.pulse {
      box-shadow: 0 0 22px rgba(34, 197, 94, 0.35);
      transform: scale(1.015);
    }
    .daily-counter-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      font-weight: 700;
      color: ${isLightUi ? '#0f3d2e' : '#bae6fd'};
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .daily-date-chip {
      font-family: monospace;
      font-size: 11px;
      color: ${isLightUi ? '#065f46' : '#86efac'};
      background: ${isLightUi ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.16)'};
      padding: 2px 7px;
      border-radius: 9999px;
      border: 1px solid rgba(52, 211, 153, 0.35);
    }
    .daily-counter-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .daily-metric {
      background: ${isLightUi ? '#ffffff' : 'rgba(15, 23, 42, 0.65)'};
      border: 1px solid ${isLightUi ? 'rgba(15, 23, 42, 0.10)' : 'rgba(148, 163, 184, 0.16)'};
      border-radius: 9px;
      padding: 8px 10px;
      text-align: center;
    }
    .daily-metric-value {
      display: block;
      font-size: 20px;
      font-weight: 800;
      color: ${isLightUi ? '#0f172a' : '#ffffff'};
      line-height: 1.15;
    }
    .daily-metric-label {
      display: block;
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
    }
    .meta-rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid ${isLightUi ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)'};
      font-size: 12px;
      color: var(--muted);
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .meta-row strong {
      color: ${isLightUi ? '#0f172a' : '#e2e8f0'};
      font-weight: 700;
    }

    .btn-aerial-toggle {
      width: 100%;
      background: ${effectiveCfg.accentColor ? escapeHtml(effectiveCfg.accentColor) : (isLightUi ? '#0f3d2e' : 'linear-gradient(135deg, #0284c7, #2563eb)')};
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.15s ease, filter 0.2s ease;
    }
    .btn-aerial-toggle:hover { filter: brightness(1.1); }
    .btn-aerial-toggle:active { transform: scale(0.98); }
    .btn-aerial-toggle.active {
      background: linear-gradient(135deg, #d97706, #f59e0b);
    }

    .toast-banner {
      position: fixed;
      bottom: 22px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #059669;
      color: #fff;
      padding: 10px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.45);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease, transform 0.3s ease;
      z-index: 50;
    }
    .toast-banner.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .paused-overlay {
      position: fixed;
      inset: 0;
      background: rgba(7, 10, 17, 0.92);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 100;
    }
    .paused-overlay.active { display: flex; }
    .paused-card {
      background: #111827;
      border: 1px solid rgba(239, 68, 68, 0.45);
      border-radius: 18px;
      padding: 32px;
      max-width: 420px;
      text-align: center;
    }
    .paused-card h2 { font-size: 20px; color: #fca5a5; margin-bottom: 8px; }
    .paused-card p { font-size: 14px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="page">
    <header class="topbar">
      <div class="title-block">
        <h1>${safeTitle}</h1>
        ${safeDesc ? `<p>${safeDesc}</p>` : ''}
      </div>
      <div class="status-pills">
        <span id="mode-pill" class="pill ${isStatic ? 'pill-static' : 'pill-dynamic'}">${modeBadgeHtml}</span>
        <span class="pill pill-live"><span class="live-dot"></span><span id="live-status-text">En vivo</span></span>
      </div>
    </header>

    <main class="unified-stage">
      <section class="model-card" aria-label="Visor de Modelo 3D">
        <qr-3d-viewer
          id="unified-viewer"
          view-token="${safeToken}"
          ar-title="${safeTitle}"
          viewer-config="${escapeHtml(JSON.stringify(effectiveCfg))}"
          hide-badge="${options.hideBadge ? 'true' : 'false'}"
          ${extraViewerAttrs}
          width="100%"
          height="100%">
        </qr-3d-viewer>
      </section>

      <aside class="qr-dock" aria-label="Código QR vinculado al modelo 3D">
        <div class="qr-dock-head">
          <h2>Escanea el Código QR</h2>
          <span class="qr-tag" id="qr-tag-mode">${isStatic ? 'Estático' : 'Dinámico'}</span>
        </div>

        <div class="qr-frame-wrap">
          <div class="qr-frame" id="qr-frame-box">
            <img id="dock-qr-img" src="/view/${safeToken}/image?t=${Date.now()}" alt="Código QR activo" />
          </div>

          <div class="countdown-box" id="countdown-box" style="${viewData.rotationIntervalSeconds > 0 ? '' : 'display:none;'}">
            <div class="countdown-row">
              <span>Próximo enlace automático</span>
              <span class="countdown-timer" id="countdown-timer">--s</span>
            </div>
            <div class="progress-track">
              <div class="progress-bar" id="countdown-progress"></div>
            </div>
          </div>
        </div>

        <div>
          <div class="daily-counter-card" id="daily-counter-card">
            <div class="daily-counter-head">
              <span style="display:inline-flex;align-items:center;gap:6px;">${renderIcon('bar-chart', { size: 14 })}<span>Ingresos de hoy</span></span>
              <span class="daily-date-chip" id="meta-today-date">${escapeHtml(viewData.todayDate || '')}</span>
            </div>
            <div class="daily-counter-grid">
              <div class="daily-metric">
                <span class="daily-metric-value" id="meta-daily-visitors">${Number(viewData.dailyUniqueVisitors || 0)}</span>
                <span class="daily-metric-label">Personas únicas</span>
              </div>
              <div class="daily-metric">
                <span class="daily-metric-value" id="meta-daily-scans">${Number(viewData.dailyScans || 0)}</span>
                <span class="daily-metric-label">Ingresos al link</span>
              </div>
            </div>
          </div>

          <div class="info-panel">
            <div id="mode-help-text">${escapeHtml(modeHelpText)}</div>
            <div class="meta-rows">
              <div class="meta-row">
                <span>Total acumulado</span>
                <strong id="meta-total-scans">${Number(viewData.scanCount || 0)}</strong>
              </div>
              <div class="meta-row">
                <span>Último enlace activo</span>
                <strong id="meta-last-rotated">—</strong>
              </div>
              <div class="meta-row" id="meta-rotations-row" style="${isStatic ? 'display:none;' : ''}">
                <span>Rotaciones de enlace</span>
                <strong id="meta-rotations">${Number(viewData.rotationCount || 0)}</strong>
              </div>
            </div>
          </div>

          <button type="button" id="btn-toggle-aerial" class="btn-aerial-toggle" style="margin-top: 12px;">
            ${renderIcon('scan', { size: 16 })}<span>Ver QR sobre el Modelo (90°)</span>
          </button>
          <button type="button" id="btn-view-ar" class="btn-aerial-toggle" style="margin-top: 8px; background: linear-gradient(135deg, #059669, #10b981);">
            ${renderIcon('smartphone', { size: 16 })}<span>Ver en Realidad Aumentada (AR)</span>
          </button>
        </div>
      </aside>
    </main>
  </div>

  <div class="toast-banner" id="view-toast">${renderIcon('refresh', { size: 15 })}<span>Nuevo enlace QR activo</span></div>

  <div class="paused-overlay" id="paused-overlay">
    <div class="paused-card">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:16px;background:rgba(239,68,68,0.14);color:#fca5a5;border:1px solid rgba(239,68,68,0.35);margin:0 auto 14px;">${renderIcon('pause', { size: 30 })}</div>
      <h2>Vista Temporalmente Desactivada</h2>
      <p id="paused-reason">Esta vista 3D-QR ha sido pausada o deshabilitada por su propietario.</p>
    </div>
  </div>

  <script>
    const state = ${initialDataJson};
    const VIEW_ICONS = ${viewIconsJson};
    const viewerEl = document.getElementById('unified-viewer');
    const dockImg = document.getElementById('dock-qr-img');
    const qrFrameBox = document.getElementById('qr-frame-box');
    const countdownBox = document.getElementById('countdown-box');
    const countdownTimer = document.getElementById('countdown-timer');
    const countdownProgress = document.getElementById('countdown-progress');
    const metaLastRotated = document.getElementById('meta-last-rotated');
    const metaRotations = document.getElementById('meta-rotations');
    const dailyCounterCard = document.getElementById('daily-counter-card');
    const metaTodayDate = document.getElementById('meta-today-date');
    const metaDailyVisitors = document.getElementById('meta-daily-visitors');
    const metaDailyScans = document.getElementById('meta-daily-scans');
    const metaTotalScans = document.getElementById('meta-total-scans');
    const btnAerial = document.getElementById('btn-toggle-aerial');
    const btnViewAr = document.getElementById('btn-view-ar');
    const toastEl = document.getElementById('view-toast');
    const pausedOverlay = document.getElementById('paused-overlay');
    let toastTimer = null;

    function formatTime(iso) {
      if (!iso) return 'Actual';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return 'Actual';
      return d.toLocaleTimeString();
    }

    function showUpdateToast(text, iconName = 'refresh') {
      toastEl.innerHTML = '';
      if (iconName && VIEW_ICONS[iconName]) {
        const iconSpan = document.createElement('span');
        iconSpan.style.display = 'inline-flex';
        iconSpan.style.alignItems = 'center';
        iconSpan.innerHTML = VIEW_ICONS[iconName];
        toastEl.appendChild(iconSpan);
      }
      toastEl.appendChild(document.createTextNode(text || 'Nuevo enlace QR activo'));
      toastEl.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
    }

    const modePill = document.getElementById('mode-pill');
    const qrTagMode = document.getElementById('qr-tag-mode');
    const modeHelpText = document.getElementById('mode-help-text');
    const metaRotationsRow = document.getElementById('meta-rotations-row');

    function syncModeUI() {
      const isStatic = state.linkMode === 'static';
      modePill.className = 'pill ' + (isStatic ? 'pill-static' : 'pill-dynamic');
      qrTagMode.textContent = isStatic ? 'Estático' : 'Dinámico';
      metaRotationsRow.style.display = isStatic ? 'none' : '';
      if (isStatic) {
        modePill.innerHTML = VIEW_ICONS.lock + '<span>QR Estático · Enlace Fijo</span>';
        modeHelpText.textContent = 'Este código QR es estático: su enlace permanece fijo de forma permanente.';
      } else if (state.rotationStrategy === 'timed') {
        modePill.innerHTML = VIEW_ICONS.refresh + '<span>QR Dinámico · Cambia cada ' + state.rotationIntervalSeconds + 's</span>';
        modeHelpText.textContent = 'Este enlace cambia automáticamente cada ' + state.rotationIntervalSeconds + ' segundos en tiempo real.';
      } else if (state.rotationStrategy === 'dynamic') {
        modePill.innerHTML = VIEW_ICONS.zap + '<span>QR Dinámico · Cada ' + state.rotationIntervalSeconds + 's y por escaneo</span>';
        modeHelpText.textContent = 'El código rota automáticamente cada ' + state.rotationIntervalSeconds + 's y también tras cada escaneo.';
      } else {
        modePill.innerHTML = VIEW_ICONS.zap + '<span>QR Dinámico · 1 Solo Uso</span>';
        modeHelpText.textContent = 'Este código cambia automáticamente cada vez que es escaneado.';
      }
    }

    function flashQrCard() {
      qrFrameBox.classList.add('rotated-flash');
      setTimeout(() => qrFrameBox.classList.remove('rotated-flash'), 900);
    }

    function syncCountdownUI() {
      const intervalSec = Number(state.rotationIntervalSeconds || 0);
      if (state.linkMode === 'static' || intervalSec <= 0 || !state.nextRotationAt) {
        countdownBox.style.display = 'none';
        return;
      }
      countdownBox.style.display = 'flex';
      const remainingMs = Math.max(0, Date.parse(state.nextRotationAt) - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);
      countdownTimer.textContent = remainingSec + 's';
      const pct = Math.max(0, Math.min(100, (remainingMs / (intervalSec * 1000)) * 100));
      countdownProgress.style.width = pct + '%';
    }

    metaLastRotated.textContent = formatTime(state.lastRotatedAt);
    syncModeUI();
    syncCountdownUI();
    setInterval(syncCountdownUI, 250);

    btnAerial.addEventListener('click', () => {
      if (!viewerEl) return;
      if (viewerEl.isAerialMode) {
        viewerEl.exitAerialScanMode();
        btnAerial.classList.remove('active');
        btnAerial.innerHTML = VIEW_ICONS.scan + '<span>Ver QR sobre el Modelo (90°)</span>';
      } else {
        viewerEl.enterAerialScanMode();
        btnAerial.classList.add('active');
        btnAerial.innerHTML = VIEW_ICONS.undo + '<span>Volver a Vista 3D</span>';
      }
    });

    if (btnViewAr) {
      btnViewAr.addEventListener('click', () => {
        if (viewerEl && typeof viewerEl.launchAR === 'function') {
          viewerEl.launchAR();
        }
      });
    }

    viewerEl.addEventListener('ar-status', (e) => {
      const msg = e?.detail?.message;
      const iconName = e?.detail?.icon || 'smartphone';
      if (msg) showUpdateToast(msg, iconName);
    });

    viewerEl.addEventListener('qr-visual-update', (e) => {
      const detail = e.detail || {};
      if (detail.src) {
        dockImg.src = detail.src;
      }
      if (typeof detail.isAerial === 'boolean') {
        btnAerial.classList.toggle('active', detail.isAerial);
        btnAerial.innerHTML = detail.isAerial
          ? (VIEW_ICONS.undo + '<span>Volver a Vista 3D</span>')
          : (VIEW_ICONS.scan + '<span>Ver QR sobre el Modelo (90°)</span>');
      }
    });

    function applyLinkMetaPatch(detail) {
      if (detail.rotationIntervalSeconds !== undefined) {
        state.rotationIntervalSeconds = Number(detail.rotationIntervalSeconds || 0);
      }
      if (detail.rotationStrategy) state.rotationStrategy = detail.rotationStrategy;
      if (detail.linkMode) state.linkMode = detail.linkMode;
      if (detail.nextRotationAt !== undefined) state.nextRotationAt = detail.nextRotationAt;
      syncModeUI();
      syncCountdownUI();
    }

    function applyScanCounters(detail) {
      if (!detail || typeof detail !== 'object') return;
      let changed = false;
      if (detail.todayDate && metaTodayDate) {
        state.todayDate = detail.todayDate;
        metaTodayDate.textContent = String(detail.todayDate);
      }
      if (detail.dailyUniqueVisitors !== undefined && metaDailyVisitors) {
        state.dailyUniqueVisitors = Number(detail.dailyUniqueVisitors || 0);
        metaDailyVisitors.textContent = String(state.dailyUniqueVisitors);
        changed = true;
      }
      if (detail.dailyScans !== undefined && metaDailyScans) {
        state.dailyScans = Number(detail.dailyScans || 0);
        metaDailyScans.textContent = String(state.dailyScans);
        changed = true;
      }
      if (detail.scanCount !== undefined && metaTotalScans) {
        state.scanCount = Number(detail.scanCount || 0);
        metaTotalScans.textContent = String(state.scanCount);
      }
      if (changed && dailyCounterCard) {
        dailyCounterCard.classList.add('pulse');
        setTimeout(() => dailyCounterCard.classList.remove('pulse'), 750);
      }
    }

    viewerEl.addEventListener('qr-link-config', (e) => {
      applyLinkMetaPatch(e.detail || {});
    });

    viewerEl.addEventListener('qr-scan-recorded', (e) => {
      applyScanCounters(e.detail || {});
      showUpdateToast('Nuevo ingreso registrado al link', 'user');
    });

    viewerEl.addEventListener('qr-rotated', (e) => {
      const detail = e.detail || {};
      applyLinkMetaPatch(detail);
      applyScanCounters(detail);
      if (detail.lastRotatedAt) {
        state.lastRotatedAt = detail.lastRotatedAt;
        metaLastRotated.textContent = formatTime(detail.lastRotatedAt);
      } else {
        metaLastRotated.textContent = new Date().toLocaleTimeString();
      }
      if (detail.rotationCount !== undefined) {
        state.rotationCount = detail.rotationCount;
        metaRotations.textContent = String(detail.rotationCount);
      }
      if (detail.newQrImageUrl && !viewerEl.isAerialMode) {
        dockImg.classList.add('updating');
        setTimeout(() => {
          dockImg.src = detail.newQrImageUrl;
          dockImg.onload = () => dockImg.classList.remove('updating');
        }, 160);
      }
      flashQrCard();
      showUpdateToast('Código QR actualizado en vivo', 'refresh');
    });

    viewerEl.addEventListener('qr-status-change', (e) => {
      const detail = e.detail || {};
      const active = detail.isActive !== false && detail.viewEnabled !== false;
      pausedOverlay.classList.toggle('active', !active);
    });
  </script>
</body>
</html>`;
}

async function findActiveViewItem(viewToken, { allowInactive = false } = {}) {
  const result = await db.query(
    `SELECT q.*, t.default_viewer_config AS tenant_default_viewer_config
     FROM qr_items q
     LEFT JOIN tenants t ON t.id = q.tenant_id
     WHERE q.view_token = $1
     LIMIT 1`,
    [viewToken]
  );
  if (result.rows.length === 0) {
    return { status: 'not_found', item: null };
  }
  const item = result.rows[0];
  const meta = parseMetadata(item.metadata);
  const viewEnabled = meta.viewEnabled !== false;

  if (!allowInactive && (!item.is_active || !viewEnabled)) {
    return { status: 'disabled', item };
  }
  return { status: 'ok', item };
}

export async function viewRoutes(fastify) {
  // 1. Vista Pública Unida (Modelo 3D + QR, cero acceso administrativo, solo lectura)
  fastify.get('/view/:viewToken', async (request, reply) => {
    const { viewToken } = request.params;
    const { status, item } = await findActiveViewItem(viewToken);

    reply.removeHeader('X-Frame-Options');
    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    reply.header('X-Robots-Tag', 'noindex, nofollow');

    if (status === 'not_found') {
      return reply.status(404).type('text/html').send(
        renderStatusPage({
          statusTitle: 'Vista 3D-QR No Encontrada',
          badgeText: 'Enlace inválido',
          message: 'El enlace de visualización solicitado no existe o fue reemplazado.',
          iconName: 'search'
        })
      );
    }

    if (status === 'disabled') {
      return reply.status(410).type('text/html').send(
        renderStatusPage({
          statusTitle: 'Vista Temporalmente Desactivada',
          badgeText: 'Vista Pausada',
          message: 'Esta vista pública de modelo 3D y código QR fue desactivada por su propietario.',
          iconName: 'pause'
        })
      );
    }

    const dailyStats = await getDailyStatsForQr(item.id);
    const viewData = serializePublicViewData(item, resolveRequestBaseUrl(request), dailyStats);
    return reply.type('text/html').send(renderUnifiedViewPage(viewData, request.query || {}));
  });

  // 2. Metadatos públicos seguros para la vista (sin target_url, ni tenant_id, ni currentToken)
  fastify.get('/view/:viewToken/meta', async (request, reply) => {
    const { viewToken } = request.params;
    const { status, item } = await findActiveViewItem(viewToken);

    reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (status === 'not_found') {
      return reply.status(404).send({ error: 'Vista no encontrada' });
    }
    if (status === 'disabled') {
      return reply.status(410).send({ error: 'Vista desactivada o pausada' });
    }

    const dailyStats = await getDailyStatsForQr(item.id);
    return reply.send(serializePublicViewData(item, resolveRequestBaseUrl(request), dailyStats));
  });

  // 3. Modelo 3D GLB de la vista (soporta ?ar=1 para escala normalizada de Realidad Aumentada)
  fastify.get('/view/:viewToken/model', async (request, reply) => {
    const { viewToken } = request.params;
    const { status, item } = await findActiveViewItem(viewToken);

    if (status === 'not_found') {
      return reply.status(404).send({ error: 'Vista no encontrada' });
    }
    if (status === 'disabled') {
      return reply.status(410).send({ error: 'Vista desactivada o pausada' });
    }
    if (!item.model_blob) {
      return reply.status(404).send({ error: 'Modelo 3D no encontrado' });
    }

    const useAr = parseQueryBool(request.query?.ar) === true;
    const payload = useAr
      ? await buildArModelForItem(item, {
          format: 'glb',
          query: request.query || {},
          baseUrl: resolveRequestBaseUrl(request)
        })
      : item.model_blob;

    return sendCachedGlbModel(
      request,
      reply,
      payload,
      'public, max-age=60, must-revalidate'
    );
  });

  // 3b. Modelo 3D USDZ de la vista (para Apple AR Quick Look en iPhone/iPad)
  fastify.get('/view/:viewToken/model.usdz', async (request, reply) => {
    const { viewToken } = request.params;
    const { status, item } = await findActiveViewItem(viewToken);

    if (status === 'not_found') {
      return reply.status(404).send({ error: 'Vista no encontrada' });
    }
    if (status === 'disabled') {
      return reply.status(410).send({ error: 'Vista desactivada o pausada' });
    }
    if (!item.model_blob) {
      return reply.status(404).send({ error: 'Modelo 3D no encontrado' });
    }

    const usdzBuffer = await buildArModelForItem(item, {
      format: 'usdz',
      query: request.query || {},
      baseUrl: resolveRequestBaseUrl(request)
    });

    return sendCachedBinaryAsset(request, reply, usdzBuffer, {
      contentType: 'model/vnd.usdz+zip',
      etagPrefix: 'usdz',
      cacheControl: 'public, max-age=120, must-revalidate',
      contentDisposition: 'inline; filename="modelo-3d.usdz"'
    });
  });

  // 4b. QR directo hacia esta vista pública (para abrir AR desde otro celular)
  fastify.get('/view/:viewToken/view-qr', async (request, reply) => {
    const { viewToken } = request.params;
    const { status, item } = await findActiveViewItem(viewToken);

    if (status === 'not_found') {
      return reply.status(404).send({ error: 'Vista no encontrada' });
    }
    if (status === 'disabled') {
      return reply.status(410).send({ error: 'Vista desactivada o pausada' });
    }

    const baseUrl = resolveRequestBaseUrl(request);
    const viewUrl = buildViewUrl(item.view_token || viewToken, baseUrl);
    const pngBuffer = await generateQrPngBuffer(viewUrl, {
      primary: item.color_primary || '#0f172a',
      secondary: item.color_secondary || '#ffffff',
      size: 512
    });

    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'public, max-age=60')
      .send(pngBuffer);
  });

  // 4. Imagen PNG del QR activo de la vista
  fastify.get('/view/:viewToken/image', async (request, reply) => {
    const { viewToken } = request.params;
    const { status, item } = await findActiveViewItem(viewToken);

    if (status === 'not_found') {
      return reply.status(404).send({ error: 'Vista no encontrada' });
    }
    if (status === 'disabled') {
      return reply.status(410).send({ error: 'Vista desactivada o pausada' });
    }
    if (!item.current_qr_png) {
      return reply.status(404).send({ error: 'Imagen QR no encontrada' });
    }

    const baseUrl = resolveRequestBaseUrl(request);
    const pngBuffer = await ensureQrPngForBaseUrl(item, baseUrl);

    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send(pngBuffer);
  });

  // 5. Matriz binaria del QR activo (sin exponer scanUrl ni currentToken en JSON)
  fastify.get('/view/:viewToken/matrix', async (request, reply) => {
    const { viewToken } = request.params;
    const { status, item } = await findActiveViewItem(viewToken);

    if (status === 'not_found') {
      return reply.status(404).send({ error: 'Vista no encontrada' });
    }
    if (status === 'disabled') {
      return reply.status(410).send({ error: 'Vista desactivada o pausada' });
    }

    const meta = parseMetadata(item.metadata);
    const baseUrl = resolveRequestBaseUrl(request);
    const scanUrl = buildScanUrl(item.id, meta.currentToken || null, baseUrl);
    const matrix = generateQrMatrix(scanUrl);

    return reply
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send({
        viewToken,
        size: matrix.size,
        modules: matrix.modules
      });
  });

  // 6. Stream SSE en tiempo real para la vista pública
  fastify.get('/view/:viewToken/events', async (request, reply) => {
    const { viewToken } = request.params;
    const { status, item } = await findActiveViewItem(viewToken, { allowInactive: true });

    if (status === 'not_found') {
      return reply.status(404).send({ error: 'Vista no encontrada' });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', viewToken })}\n\n`);

    const channel = `qr_events:${item.id}`;
    const onEvent = (eventData) => {
      if (!eventData || typeof eventData !== 'object') return;
      const sanitized = { ...eventData };
      delete sanitized.qrId;
      if (sanitized.type === 'qr_updated') {
        sanitized.newQrImageUrl = `/view/${viewToken}/image?t=${Date.now()}`;
      }
      reply.raw.write(`data: ${JSON.stringify(sanitized)}\n\n`);
    };

    await eventBus.subscribeChannel(channel, onEvent);

    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 15000);
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      eventBus.unsubscribeChannel(channel, onEvent);
    });
  });
}
