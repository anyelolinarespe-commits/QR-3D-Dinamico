import sharp from 'sharp';

/**
 * Convierte RGB a formato HEX
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calcula la luminancia perceptual (0 = negro, 255 = blanco)
 */
function getLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Extrae la paleta y color dominante de una imagen Buffer usando Sharp
 * @param {Buffer} imageBuffer 
 * @returns {Promise<{ primary: string, secondary: string, isDark: boolean, palette: string[] }>}
 */
export async function extractDominantColors(imageBuffer) {
  try {
    // Redimensionar a 64x64 para análisis rápido y eficiente de píxeles
    const { data, info } = await sharp(imageBuffer)
      .resize(64, 64, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Cuantización de color en cubos de 16x16x16
    const colorBuckets = new Map();
    const channels = info.channels; // 4 (RGBA)

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Ignorar píxeles transparentes
      if (a < 128) continue;

      // Agrupar en cubos de 32 para filtrar ruido
      const qr = Math.floor(r / 32) * 32;
      const qg = Math.floor(g / 32) * 32;
      const qb = Math.floor(b / 32) * 32;

      // Descartar blancos puros y negros extremos del conteo dominante
      if ((qr >= 224 && qg >= 224 && qb >= 224) || (qr <= 16 && qg <= 16 && qb <= 16)) {
        continue;
      }

      const key = `${qr},${qg},${qb}`;
      colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
    }

    // Ordenar cubos por frecuencia
    const sorted = Array.from(colorBuckets.entries()).sort((a, b) => b[1] - a[1]);

    let domR = 30, domG = 41, domB = 59; // Slate 800 default

    if (sorted.length > 0) {
      const [r, g, b] = sorted[0][0].split(',').map(Number);
      domR = r;
      domG = g;
      domB = b;
    } else {
      // Si la imagen era monocromática o blanco/negro total, tomar stats promedio
      const stats = await sharp(imageBuffer).stats();
      domR = Math.round(stats.channels[0].mean);
      domG = Math.round(stats.channels[1].mean);
      domB = Math.round(stats.channels[2].mean);
    }

    const lum = getLuminance(domR, domG, domB);
    const hexDominant = rgbToHex(domR, domG, domB);

    let primaryColor = hexDominant;
    let secondaryColor = '#FFFFFF';

    // Regla de contraste para escaneabilidad de cámaras:
    // Si el color dominante es oscuro (lum < 130), lo usamos como color de los módulos oscuros del QR (dark)
    // y el fondo es blanco (#FFFFFF) o pastel ultra suave.
    // Si el color es claro (lum >= 130), oscurecemos el color primario para garantizar contraste de escaneo.
    if (lum >= 130) {
      // Color claro -> oscurecer para foreground
      const darkR = Math.round(domR * 0.4);
      const darkG = Math.round(domG * 0.4);
      const darkB = Math.round(domB * 0.4);
      primaryColor = rgbToHex(darkR, darkG, darkB);
      secondaryColor = rgbToHex(Math.min(255, domR + 30), Math.min(255, domG + 30), Math.min(255, domB + 30));
    } else {
      // Color ya es oscuro y definido
      primaryColor = hexDominant;
      secondaryColor = '#FFFFFF';
    }

    const palette = sorted.slice(0, 5).map(([key]) => {
      const [r, g, b] = key.split(',').map(Number);
      return rgbToHex(r, g, b);
    });

    return {
      primary: primaryColor,
      secondary: secondaryColor,
      dominant: hexDominant,
      isDark: lum < 130,
      palette: palette.length > 0 ? palette : [hexDominant, '#FFFFFF']
    };
  } catch (err) {
    console.warn('Error al extraer colores con sharp:', err.message);
    return {
      primary: '#1E293B',
      secondary: '#FFFFFF',
      dominant: '#1E293B',
      isDark: true,
      palette: ['#1E293B', '#FFFFFF']
    };
  }
}
