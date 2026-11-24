import QRCode from 'qrcode';
import sharp from 'sharp';

/**
 * Genera un buffer PNG de un código QR con colores adaptados y alta tolerancia a errores
 * @param {string} text - URL o contenido del QR
 * @param {object} options - Colores primario y secundario
 * @returns {Promise<Buffer>}
 */
export async function generateQrPngBuffer(text, options = {}) {
  const darkColor = options.primary || '#1e293b';
  const lightColor = options.secondary || '#ffffff';
  const size = options.size || 1024;

  const qrBuffer = await QRCode.toBuffer(text, {
    errorCorrectionLevel: 'H', // 30% de redundancia para lectura óptima en modelos 3D
    type: 'png',
    quality: 0.95,
    margin: 2,
    width: size,
    color: {
      dark: darkColor,
      light: lightColor
    }
  });

  return qrBuffer;
}

/**
 * Retorna la matriz binaria exacta (módulos 0/1) de un código QR
 * @param {string} text
 * @returns {{ size: number, modules: number[] }}
 */
export function generateQrMatrix(text) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  return {
    size: qr.modules.size,
    modules: Array.from(qr.modules.data)
  };
}

/**
 * Genera un Data URL base64 del código QR para visualización rápida
 * @param {string} text 
 * @param {object} options 
 * @returns {Promise<string>}
 */
export async function generateQrDataUrl(text, options = {}) {
  const darkColor = options.primary || '#1e293b';
  const lightColor = options.secondary || '#ffffff';

  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: options.size || 512,
    color: {
      dark: darkColor,
      light: lightColor
    }
  });
}

/**
 * Genera un QR en formato SVG vectorial
 * @param {string} text 
 * @param {object} options 
 * @returns {Promise<string>}
 */
export async function generateQrSvg(text, options = {}) {
  const darkColor = options.primary || '#1e293b';
  const lightColor = options.secondary || '#ffffff';

  return await QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: darkColor,
      light: lightColor
    }
  });
}
