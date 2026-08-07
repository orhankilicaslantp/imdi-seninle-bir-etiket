// Görsel / ikon -> 1-bit monokrom bitmap -> ZPL ^GFA (ASCII-HEX) dönüşümü
// ^GF format, dataBytes, totalBytes, rowBytes, data  (format=A => ASCII HEX, dataBytes===totalBytes)

export interface MonoBitmap {
  widthPx: number;
  heightPx: number;
  bytesPerRow: number;
  totalBytes: number;
  hexData: string;
}

/** Bir <canvas> üzerindeki pikselleri gri tonlama eşiği ile 1-bit monokroma çevirir. */
export function canvasToMonoBitmap(
  canvas: HTMLCanvasElement,
  threshold: number,
  invert = false,
): MonoBitmap {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context alınamadı');
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  const bytesPerRow = Math.ceil(width / 8);
  const totalBytes = bytesPerRow * height;
  const bytes = new Uint8Array(totalBytes);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      const gray = (r * 0.299 + g * 0.587 + b * 0.114);
      // Şeffaf pikseller beyaz (basılmaz) kabul edilir
      let isBlack = a > 10 && gray < threshold;
      if (invert) isBlack = !isBlack;
      if (isBlack) {
        const byteIndex = y * bytesPerRow + (x >> 3);
        const bitIndex = 7 - (x % 8);
        bytes[byteIndex] |= (1 << bitIndex);
      }
    }
  }

  let hexData = '';
  for (let i = 0; i < bytes.length; i++) {
    hexData += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }

  return { widthPx: width, heightPx: height, bytesPerRow, totalBytes, hexData };
}

export function monoBitmapToGfCommand(bmp: MonoBitmap): string {
  return `^GFA,${bmp.totalBytes},${bmp.totalBytes},${bmp.bytesPerRow},${bmp.hexData}`;
}

/** Bir data URL / img elementini verilen dot boyutuna çizip mono bitmap üretir. */
export async function imageDataUrlToMonoBitmap(
  dataUrl: string,
  widthPx: number,
  heightPx: number,
  threshold: number,
  invert = false,
): Promise<MonoBitmap> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(widthPx));
  canvas.height = Math.max(1, Math.round(heightPx));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context alınamadı');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasToMonoBitmap(canvas, threshold, invert);
}

/** SVG string'ini verilen dot boyutuna çizip mono bitmap üretir (ikonlar için). */
export async function svgStringToMonoBitmap(
  svgContent: string,
  widthPx: number,
  heightPx: number,
  threshold: number,
  invert = false,
): Promise<MonoBitmap> {
  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    return await imageDataUrlToMonoBitmap(url, widthPx, heightPx, threshold, invert);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
