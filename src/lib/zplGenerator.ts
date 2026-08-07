import type {
  BarcodeElement,
  CustomFont,
  IconElement,
  ImageElement,
  LabelElement,
  LabelSettings,
  QrElement,
  ShapeElement,
  TextElement,
} from '../types';
import { mmToDots } from './units';
import { generateFontRefZpl } from './fontToZpl';
import { monoBitmapToGfCommand, type MonoBitmap } from './imageToZpl';
import { getBarcodeMeta } from './barcodeSymbologies';

export interface GeneratorContext {
  labelSettings: LabelSettings;
  customFonts: CustomFont[];
  /** image/icon elemanları için önceden hesaplanmış mono bitmap (elementId -> bitmap) */
  bitmaps: Record<string, MonoBitmap>;
}

const rotationToOrientation = (rotation: number): 'N' | 'R' | 'I' | 'B' => {
  switch (rotation) {
    case 90: return 'R';
    case 180: return 'I';
    case 270: return 'B';
    default: return 'N';
  }
};

function genText(el: TextElement, ctx: GeneratorContext, offsetXDots: number): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi) + offsetXDots;
  const y = mmToDots(el.y, dpi);
  const h = mmToDots(el.fontSize, dpi);
  const w = h; // varsayılan olarak orantılı
  const orientation = rotationToOrientation(el.rotation);
  const lines: string[] = [];

  if (el.isCustomFont) {
    const font = ctx.customFonts.find((f) => f.id === el.fontRef);
    if (font) {
      lines.push(`^FT${x},${y}`);
      lines.push(generateFontRefZpl(font, h, w, orientation));
      lines.push('^FH\\');
      lines.push('^CI28');
      lines.push(`^FD${escapeFieldData(el.text)}^FS`);
      lines.push('^CI27');
      return lines.join('');
    }
  }

  lines.push(`^FO${x},${y}`);
  lines.push(`^A${el.fontRef}${orientation},${h},${w}`);
  lines.push(`^FD${escapeFieldData(el.text)}^FS`);
  return lines.join('');
}

function genShape(el: ShapeElement, ctx: GeneratorContext, offsetXDots: number): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi) + offsetXDots;
  const y = mmToDots(el.y, dpi);
  const w = Math.max(1, mmToDots(el.width, dpi));
  const h = el.shape === 'line' ? Math.max(1, mmToDots(el.thicknessMm, dpi)) : Math.max(1, mmToDots(el.height, dpi));
  const thickness = Math.max(1, mmToDots(el.thicknessMm, dpi));
  const color = el.color === 'white' ? 'W' : 'B';
  if (el.shape === 'line') {
    return `^FO${x},${y}^GB${w},${thickness},${thickness},${color},0^FS`;
  }
  return `^FO${x},${y}^GB${w},${h},${thickness},${color},${el.cornerRounding}^FS`;
}

function genBitmapField(elId: string, x: number, y: number, ctx: GeneratorContext): string {
  const bmp = ctx.bitmaps[elId];
  if (!bmp) return '';
  return `^FO${x},${y}${monoBitmapToGfCommand(bmp)}^FS`;
}

function genImage(el: ImageElement, ctx: GeneratorContext, offsetXDots: number): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi) + offsetXDots;
  const y = mmToDots(el.y, dpi);
  return genBitmapField(el.id, x, y, ctx);
}

function genIcon(el: IconElement, ctx: GeneratorContext, offsetXDots: number): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi) + offsetXDots;
  const y = mmToDots(el.y, dpi);
  return genBitmapField(el.id, x, y, ctx);
}

function genBarcode(el: BarcodeElement, ctx: GeneratorContext, offsetXDots: number): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi) + offsetXDots;
  const y = mmToDots(el.y, dpi);
  const h = mmToDots(el.height, dpi);
  const orientation = rotationToOrientation(el.rotation);
  const by = `^BY${el.moduleWidth},${el.ratio},${h}`;
  const barcodeCmd = getBarcodeMeta(el.symbology).buildZpl(orientation, h, el.showText);
  return `^FO${x},${y}${by}${barcodeCmd}^FD${escapeFieldData(el.data)}^FS`;
}

function genQr(el: QrElement, ctx: GeneratorContext, offsetXDots: number): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi) + offsetXDots;
  const y = mmToDots(el.y, dpi);
  const orientation = rotationToOrientation(el.rotation);
  return `^FO${x},${y}^BQ${orientation},2,${el.magnification}^FD${el.errorCorrection}A,${escapeFieldData(el.data)}^FS`;
}

function escapeFieldData(text: string): string {
  // ^ ve ~ karakterleri ZPL'de özel anlam taşır; ^FH ile hex-escape kullanılabilir.
  return text.replace(/\\/g, '\\5C').replace(/\^/g, '\\5E').replace(/~/g, '\\7E');
}

export function generateElementZpl(el: LabelElement, ctx: GeneratorContext, offsetXDots = 0): string {
  switch (el.type) {
    case 'text': return genText(el, ctx, offsetXDots);
    case 'shape': return genShape(el, ctx, offsetXDots);
    case 'image': return genImage(el, ctx, offsetXDots);
    case 'icon': return genIcon(el, ctx, offsetXDots);
    case 'barcode': return genBarcode(el, ctx, offsetXDots);
    case 'qr': return genQr(el, ctx, offsetXDots);
    default: return '';
  }
}

export function generateLabelZpl(elements: LabelElement[], ctx: GeneratorContext): string {
  const { widthMm, heightMm, dpi, labelsAcross, horizontalGapMm } = ctx.labelSettings;
  const labelWidthDots = mmToDots(widthMm, dpi);
  const gapDots = mmToDots(horizontalGapMm, dpi);
  const count = Math.max(1, labelsAcross || 1);
  const pw = count * labelWidthDots + (count - 1) * gapDots;
  const ll = mmToDots(heightMm, dpi);

  // Not: Özel fontlar burada indirilmez (~DY üretilmez). Fontların yazıcı belleğine
  // önceden yüklendiği kabul edilir; ZPL'de sadece ^A@ ile bellek adına referans verilir.
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  const body: string[] = [];
  for (let i = 0; i < count; i++) {
    const offsetXDots = i * (labelWidthDots + gapDots);
    for (const el of sorted) {
      const zpl = generateElementZpl(el, ctx, offsetXDots);
      if (zpl) body.push(zpl);
    }
  }

  const parts: string[] = [];
  parts.push('^XA');
  parts.push('^CI28');
  parts.push(`^PW${pw}`);
  parts.push(`^LL${ll}`);
  for (const b of body) parts.push(b);
  parts.push('^XZ');
  return parts.join('\n');
}
