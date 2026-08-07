import type { Dpi } from '../types';

/** mm -> dot dönüşümü (1 inch = 25.4mm) */
export function mmToDots(mm: number, dpi: Dpi): number {
  return Math.round((mm / 25.4) * dpi);
}

export function dotsToMm(dots: number, dpi: Dpi): number {
  return (dots / dpi) * 25.4;
}

/** Ekranda editör için mm -> px (zoom faktörü ile) */
export function mmToPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}

export function pxToMm(px: number, pxPerMm: number): number {
  return px / pxPerMm;
}
