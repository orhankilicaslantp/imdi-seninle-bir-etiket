import QRCode from 'qrcode';

/**
 * ZPL ^BQ komutunda QR kodunun gerçek boyutu, veriden otomatik hesaplanan
 * modül sayısı ile büyütme (magnification, 1-10) çarpımından oluşur.
 * Bu yüzden QR elemanının genişlik/yükseklik (mm) alanı, büyütme değerinden
 * bağımsız serbestçe değiştirilemez -- ikisi birbirine kilitli tutulmalıdır.
 */

const FALLBACK_MODULE_COUNT = 21; // Versiyon 1 QR (boş/geçersiz veri durumunda)

export function getQrModuleCount(data: string, errorCorrection: 'L' | 'M' | 'Q' | 'H'): number {
  try {
    const qr = QRCode.create(data || ' ', { errorCorrectionLevel: errorCorrection });
    return qr.modules.size;
  } catch {
    return FALLBACK_MODULE_COUNT;
  }
}

/** ZPL ^BQ komutunun donanımsal (yazıcı firmware) büyütme sınırı. Bunun üzerindeki
 * boyutlar native ^BQ ile üretilemez; bu durumda QR bir bitmap (^GFA) olarak gömülerek
 * sınırsız şekilde büyütülüp küçültülebilir. */
export const MAX_NATIVE_MAGNIFICATION = 10;

export function clampMagnification(mag: number): number {
  if (!Number.isFinite(mag)) return 1;
  return Math.max(1, Math.round(mag));
}

export function needsBitmapQr(magnification: number): boolean {
  return magnification > MAX_NATIVE_MAGNIFICATION;
}

export function qrSizeMm(moduleCount: number, magnification: number, dpi: number): number {
  const dotsPerMm = dpi / 25.4;
  return (moduleCount * magnification) / dotsPerMm;
}

export function qrMagnificationFromMm(sizeMm: number, moduleCount: number, dpi: number): number {
  const dotsPerMm = dpi / 25.4;
  const mag = (sizeMm * dotsPerMm) / moduleCount;
  return clampMagnification(mag);
}
