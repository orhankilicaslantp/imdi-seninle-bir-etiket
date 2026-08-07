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
import { generateFontDownloadZpl, generateFontRefZpl } from './fontToZpl';
import { monoBitmapToGfCommand, type MonoBitmap } from './imageToZpl';

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

function genText(el: TextElement, ctx: GeneratorContext): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi);
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

function genShape(el: ShapeElement, ctx: GeneratorContext): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi);
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

function genImage(el: ImageElement, ctx: GeneratorContext): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi);
  const y = mmToDots(el.y, dpi);
  return genBitmapField(el.id, x, y, ctx);
}

function genIcon(el: IconElement, ctx: GeneratorContext): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi);
  const y = mmToDots(el.y, dpi);
  return genBitmapField(el.id, x, y, ctx);
}

function genBarcode(el: BarcodeElement, ctx: GeneratorContext): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi);
  const y = mmToDots(el.y, dpi);
  const h = mmToDots(el.height, dpi);
  const orientation = rotationToOrientation(el.rotation);
  const showText = el.showText ? 'Y' : 'N';
  const by = `^BY${el.moduleWidth},${el.ratio},${h}`;
  let barcodeCmd = '';
  switch (el.symbology) {
    case 'CODE128':
      barcodeCmd = `^BC${orientation},${h},${showText},N,N,A`;
      break;
    case 'EAN13':
      barcodeCmd = `^BE${orientation},${h},${showText},N`;
      break;
    case 'EAN8':
      barcodeCmd = `^B8${orientation},${h},${showText},N`;
      break;
    case 'UPC':
      barcodeCmd = `^BU${orientation},${h},${showText},N,Y`;
      break;
  }
  return `^FO${x},${y}${by}${barcodeCmd}^FD${escapeFieldData(el.data)}^FS`;
}

function genQr(el: QrElement, ctx: GeneratorContext): string {
  const { dpi } = ctx.labelSettings;
  const x = mmToDots(el.x, dpi);
  const y = mmToDots(el.y, dpi);
  const orientation = rotationToOrientation(el.rotation);
  return `^FO${x},${y}^BQ${orientation},2,${el.magnification}^FD${el.errorCorrection}A,${escapeFieldData(el.data)}^FS`;
}

function escapeFieldData(text: string): string {
  // ^ ve ~ karakterleri ZPL'de özel anlam taşır; ^FH ile hex-escape kullanılabilir.
  return text.replace(/\\/g, '\\5C').replace(/\^/g, '\\5E').replace(/~/g, '\\7E');
}

export function generateElementZpl(el: LabelElement, ctx: GeneratorContext): string {
  switch (el.type) {
    case 'text': return genText(el, ctx);
    case 'shape': return genShape(el, ctx);
    case 'image': return genImage(el, ctx);
    case 'icon': return genIcon(el, ctx);
    case 'barcode': return genBarcode(el, ctx);
    case 'qr': return genQr(el, ctx);
    default: return '';
  }
}

export function generateLabelZpl(elements: LabelElement[], ctx: GeneratorContext): string {
  const { widthMm, heightMm, dpi } = ctx.labelSettings;
  const pw = mmToDots(widthMm, dpi);
  const ll = mmToDots(heightMm, dpi);

  const usedFontIds = new Set<string>();
  for (const el of elements) {
    if (el.type === 'text' && el.isCustomFont) usedFontIds.add(el.fontRef);
  }
  const fontDownloads = ctx.customFonts
    .filter((f) => usedFontIds.has(f.id))
    .map((f) => generateFontDownloadZpl(f));

  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const body = sorted.map((el) => generateElementZpl(el, ctx)).filter(Boolean);

  const parts: string[] = [];
  parts.push('^XA');
  parts.push('^CI28');
  parts.push(`^PW${pw}`);
  parts.push(`^LL${ll}`);
  for (const fd of fontDownloads) parts.push(fd);
  for (const b of body) parts.push(b);
  parts.push('^XZ');
  return parts.join('\n');
}
