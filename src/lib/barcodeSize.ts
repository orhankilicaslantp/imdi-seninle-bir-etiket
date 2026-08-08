import JsBarcode from 'jsbarcode';
import { getBarcodeMeta } from './barcodeSymbologies';
import type { BarcodeSymbology } from '../types';

/**
 * ZPL barkodlarında (^BC, ^B3, ^BE ...) gerçek toplam genişlik; veriye/sembolojiye göre
 * kodlanan "modül" (en ince çubuk/boşluk birimi) sayısı x ^BY ile ayarlanan modül genişliği
 * (dot) çarpımından oluşur. Modül sayısı sabittir (veri+sembolojiden hesaplanır); bu yüzden
 * genişlik (mm) serbestçe sürüklenip kilitlenemez -- moduleWidth'e kilitli tutulmalıdır
 * (tıpkı QR kodunda büyütme/magnification gibi). Bu dosya, editördeki genişlik kutusu ile
 * gerçek ZPL çıktısının her zaman birbiriyle eşleşmesini sağlar.
 */

const FALLBACK_MODULE_COUNT = 90; // jsbarcode ile önizlenemeyen (2B/endüstriyel) türler için kaba tahmin

/** Verilen sembolojide, verinin kodlanmasıyla ortaya çıkan toplam "en ince modül" sayısı. */
export function getBarcodeModuleCount(symbology: BarcodeSymbology, data: string): number {
  const meta = getBarcodeMeta(symbology);
  if (!meta.previewable || !meta.jsBarcodeFormat) return FALLBACK_MODULE_COUNT;
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, data || '0', {
      format: meta.jsBarcodeFormat,
      displayValue: false,
      width: 1,
      height: 10,
      margin: 0,
    });
    return Math.max(1, canvas.width);
  } catch {
    return FALLBACK_MODULE_COUNT;
  }
}

/** ZPL ^BY modül genişliği donanım sınırı (Zebra ZPL II: 1-10 dot). */
export const MIN_MODULE_WIDTH_DOTS = 1;
export const MAX_MODULE_WIDTH_DOTS = 10;

export function clampModuleWidth(w: number): number {
  if (!Number.isFinite(w)) return 2;
  return Math.max(MIN_MODULE_WIDTH_DOTS, Math.min(MAX_MODULE_WIDTH_DOTS, Math.round(w)));
}

export function barcodeWidthMm(moduleCount: number, moduleWidthDots: number, dpi: number): number {
  const dotsPerMm = dpi / 25.4;
  return (moduleCount * moduleWidthDots) / dotsPerMm;
}

export function barcodeModuleWidthFromMm(widthMm: number, moduleCount: number, dpi: number): number {
  const dotsPerMm = dpi / 25.4;
  const w = (widthMm * dotsPerMm) / Math.max(1, moduleCount);
  return clampModuleWidth(w);
}
