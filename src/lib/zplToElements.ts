// ZPL -> Element modeli (ters yönlü dönüşüm / içe aktarma).
// zplGenerator.ts'nin ürettiği alt kümeyi (ve makul ölçüde genel ZPL II metnini) ayrıştırıp
// düzenlenebilir LabelElement'lere çevirir; böylece hazır bir ZPL kodu yapıştırılıp tasarıma
// devam edilebilir. Desteklenmeyen/tanınmayan komutlar sessizce atlanır ve bir uyarı listesine
// eklenir -- uygulama asla çökmez, sadece o öğe içe aktarılamaz.

import type {
  BarcodeElement,
  CustomFont,
  Dpi,
  ImageElement,
  LabelElement,
  QrElement,
  Rotation,
  ShapeElement,
  TextElement,
} from '../types';
import { dotsToMm } from './units';
import { getBarcodeMeta, ZPL_CODE_TO_SYMBOLOGY } from './barcodeSymbologies';
import { barcodeWidthMm, clampModuleWidth, getBarcodeModuleCount } from './barcodeSize';
import { clampMagnification, getQrModuleCount, qrSizeMm } from './qrSize';
import { nextId } from '../state/useLabelStore';

export interface ZplImportResult {
  elements: LabelElement[];
  widthMm?: number;
  heightMm?: number;
  warnings: string[];
}

interface ParseFieldState {
  x: number;
  y: number;
  fontDesignator: string;
  fontHeight: number;
  fontWidth: number;
  fontOrientation: 'N' | 'R' | 'I' | 'B';
  customFontLocator: string | null;
  byModuleWidth: number;
  byRatio: number;
  byHeight: number;
  pendingBarcodeCmd: { code: string; params: string[] } | null;
  pendingQrCmd: { orientation: 'N' | 'R' | 'I' | 'B'; magnification: number } | null;
  hexEscape: boolean;
}

function freshField(): ParseFieldState {
  return {
    x: 0,
    y: 0,
    fontDesignator: '0',
    fontHeight: 20,
    fontWidth: 20,
    fontOrientation: 'N',
    customFontLocator: null,
    byModuleWidth: 2,
    byRatio: 3,
    byHeight: 10,
    pendingBarcodeCmd: null,
    pendingQrCmd: null,
    hexEscape: false,
  };
}

function orientationToRotation(o: string): Rotation {
  switch (o) {
    case 'R': return 90;
    case 'I': return 180;
    case 'B': return 270;
    default: return 0;
  }
}

function unescapeFieldData(data: string): string {
  return data.replace(/\\([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

let measureCtx: CanvasRenderingContext2D | null = null;
function estimateTextWidthDots(text: string, heightDots: number): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * heightDots * 0.6;
  measureCtx.font = `${Math.max(1, heightDots)}px Arial, sans-serif`;
  return measureCtx.measureText(text || ' ').width;
}

/** ZPL bellek adı (targetName) eşleşmesini zplInterpreter'daki mantıkla aynı şekilde
 * (kısaltılmış uzantı varyantları dahil) yapar, mevcut yüklü özel fontlar arasından bulur. */
function matchCustomFont(locator: string, customFonts: CustomFont[]): CustomFont | undefined {
  const wanted = locator.trim();
  for (const font of customFonts) {
    const target = font.targetName;
    const candidates = new Set<string>();
    const addKey = (name: string) => {
      candidates.add(name);
      candidates.add(`${font.drive}:${name}`);
    };
    addKey(target);
    const dotIdx = target.lastIndexOf('.');
    if (dotIdx > 0) {
      const base = target.slice(0, dotIdx);
      const ext = target.slice(dotIdx + 1);
      addKey(base);
      for (let len = 1; len < ext.length; len++) addKey(`${base}.${ext.slice(0, len)}`);
    }
    if (candidates.has(wanted)) return font;
  }
  return undefined;
}

function makeText(
  field: ParseFieldState,
  data: string,
  dpi: Dpi,
  customFonts: CustomFont[],
  warnings: string[],
  zIndex: number,
): TextElement {
  const rotation = orientationToRotation(field.fontOrientation);
  let isCustomFont = false;
  let fontRef = field.fontDesignator || '0';

  if (field.customFontLocator) {
    const matched = matchCustomFont(field.customFontLocator, customFonts);
    if (matched) {
      isCustomFont = true;
      fontRef = matched.id;
    } else {
      warnings.push(
        `Özel font '${field.customFontLocator}' bulunamadı, "${data.slice(0, 24)}" metni varsayılan fonta düşürüldü. Font Yöneticisi'nden bu fontu ekleyip metne yeniden atayabilirsiniz.`,
      );
    }
  }

  const fontSizeMm = dotsToMm(field.fontHeight, dpi);
  const widthDots = estimateTextWidthDots(data, field.fontHeight);
  return {
    id: nextId('text'),
    type: 'text',
    x: dotsToMm(field.x, dpi),
    y: dotsToMm(field.y, dpi),
    width: Math.max(5, dotsToMm(widthDots, dpi)),
    height: Math.max(2, fontSizeMm * 1.3),
    rotation,
    zIndex,
    text: data,
    fontSize: fontSizeMm,
    fontRef,
    isCustomFont,
    align: 'left',
  };
}

function makeShape(field: ParseFieldState, params: string[], dpi: Dpi, zIndex: number): ShapeElement {
  const w = parseInt(params[0], 10) || 1;
  const h = parseInt(params[1], 10) || 1;
  const thickness = parseInt(params[2], 10) || 1;
  const color = (params[3] as 'B' | 'W') || 'B';
  const rounding = parseInt(params[4], 10) || 0;
  const isLine = h <= thickness;
  return {
    id: nextId('shape'),
    type: 'shape',
    x: dotsToMm(field.x, dpi),
    y: dotsToMm(field.y, dpi),
    width: Math.max(0.1, dotsToMm(w, dpi)),
    height: Math.max(0.1, dotsToMm(isLine ? thickness : h, dpi)),
    rotation: 0,
    zIndex,
    shape: isLine ? 'line' : 'rectangle',
    thicknessMm: Math.max(0.1, dotsToMm(thickness, dpi)),
    color: color === 'W' ? 'white' : 'black',
    cornerRounding: Math.max(0, Math.min(8, rounding)),
  };
}

function makeBarcode(
  field: ParseFieldState,
  data: string,
  dpi: Dpi,
  warnings: string[],
  zIndex: number,
): BarcodeElement | null {
  if (!field.pendingBarcodeCmd) return null;
  const symbology = ZPL_CODE_TO_SYMBOLOGY[field.pendingBarcodeCmd.code];
  if (!symbology) {
    warnings.push(`Bilinmeyen barkod komutu ^${field.pendingBarcodeCmd.code} atlandı.`);
    return null;
  }
  const meta = getBarcodeMeta(symbology);
  const idx = meta.showTextParamIndex;
  const showText = idx != null ? field.pendingBarcodeCmd.params[idx] === 'Y' : false;
  const orientation = (field.pendingBarcodeCmd.params[0] as ParseFieldState['fontOrientation']) || 'N';
  const moduleCount = getBarcodeModuleCount(symbology, data || '0');
  const moduleWidth = clampModuleWidth(field.byModuleWidth);
  const width = barcodeWidthMm(moduleCount, moduleWidth, dpi);
  const heightMm = Math.max(1, dotsToMm(field.byHeight, dpi));
  return {
    id: nextId('barcode'),
    type: 'barcode',
    x: dotsToMm(field.x, dpi),
    y: dotsToMm(field.y, dpi),
    width,
    height: heightMm,
    rotation: orientationToRotation(orientation),
    zIndex,
    symbology,
    data,
    moduleWidth,
    ratio: field.byRatio,
    showText,
  };
}

function makeQr(field: ParseFieldState, fdRaw: string, dpi: Dpi, zIndex: number): QrElement | null {
  if (!field.pendingQrCmd) return null;
  const commaIdx = fdRaw.indexOf(',');
  const data = commaIdx >= 0 ? fdRaw.slice(commaIdx + 1) : fdRaw;
  const ecLetter = fdRaw[0] || 'Q';
  const ecMap: Record<string, 'L' | 'M' | 'Q' | 'H'> = { L: 'L', M: 'M', Q: 'Q', H: 'H' };
  const errorCorrection = ecMap[ecLetter] || 'Q';
  const magnification = clampMagnification(field.pendingQrCmd.magnification);
  const moduleCount = getQrModuleCount(data, errorCorrection);
  const size = qrSizeMm(moduleCount, magnification, dpi);
  return {
    id: nextId('qr'),
    type: 'qr',
    x: dotsToMm(field.x, dpi),
    y: dotsToMm(field.y, dpi),
    width: size,
    height: size,
    rotation: orientationToRotation(field.pendingQrCmd.orientation),
    zIndex,
    data,
    magnification,
    errorCorrection,
  };
}

/** ^GFA (ASCII-HEX 1-bit bitmap) verisini gerçek bir görsele (PNG data URL) çevirip
 * düzenlenebilir bir ImageElement üretir -- böylece gömülü resim/ikonlar da tasarıma
 * eklenip yeniden konumlandırılıp boyutlandırılabilir (orijinal kaynak dosya olmadığından
 * bir kez rasterize edilmiş hâliyle geri gelir, bu beklenen bir sınırlamadır). */
function makeImageFromGf(field: ParseFieldState, gfParamsRaw: string, dpi: Dpi, zIndex: number): ImageElement | null {
  const firstComma = gfParamsRaw.indexOf(',');
  const rest = gfParamsRaw.slice(firstComma + 1);
  const parts = rest.split(',');
  if (parts.length < 4) return null;
  const totalBytes = parseInt(parts[1], 10);
  const rowBytes = parseInt(parts[2], 10);
  const hexData = parts.slice(3).join(',');
  if (!Number.isFinite(totalBytes) || !Number.isFinite(rowBytes) || rowBytes <= 0) return null;
  const height = Math.floor(totalBytes / rowBytes);
  const width = rowBytes * 8;
  if (!width || !height || width > 10000 || height > 10000) return null;

  const bytes = new Uint8Array(totalBytes);
  for (let i = 0; i < totalBytes; i++) {
    bytes[i] = parseInt(hexData.substr(i * 2, 2), 16) || 0;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imgData = ctx.createImageData(width, height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const byteIndex = row * rowBytes + (col >> 3);
      const bitIndex = 7 - (col % 8);
      const isBlack = (bytes[byteIndex] >> bitIndex) & 1;
      const idx = (row * width + col) * 4;
      if (isBlack) {
        imgData.data[idx] = 0;
        imgData.data[idx + 1] = 0;
        imgData.data[idx + 2] = 0;
        imgData.data[idx + 3] = 255;
      } else {
        imgData.data[idx] = 255;
        imgData.data[idx + 1] = 255;
        imgData.data[idx + 2] = 255;
        imgData.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');

  return {
    id: nextId('image'),
    type: 'image',
    x: dotsToMm(field.x, dpi),
    y: dotsToMm(field.y, dpi),
    width: dotsToMm(width, dpi),
    height: dotsToMm(height, dpi),
    rotation: 0,
    zIndex,
    originalDataUrl: dataUrl,
    threshold: 128,
    lockAspectRatio: true,
  };
}

export function parseZplToElements(zpl: string, dpi: Dpi, customFonts: CustomFont[]): ZplImportResult {
  const warnings: string[] = [];
  const elements: LabelElement[] = [];
  let zIndex = 1;

  const pwMatch = zpl.match(/\^PW(\d+)/);
  const llMatch = zpl.match(/\^LL(\d+)/);
  const widthMm = pwMatch ? dotsToMm(parseInt(pwMatch[1], 10), dpi) : undefined;
  const heightMm = llMatch ? dotsToMm(parseInt(llMatch[1], 10), dpi) : undefined;

  const tokens = zpl.split(/(?=[\^~])/).filter((t) => t.trim().length > 0);
  let field = freshField();
  const unknownCodes = new Set<string>();

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) continue;
    if (token.startsWith('^XA') || token.startsWith('^XZ')) continue;
    if (token.startsWith('^CI')) continue;
    if (token.startsWith('^PW') || token.startsWith('^LL')) continue;
    if (token.startsWith('~DY')) continue; // font indirme bloğu -- bu sistemde kullanılmıyor, atlanır

    if (token.startsWith('^FO') || token.startsWith('^FT')) {
      const params = token.slice(3).split(',');
      field.x = parseInt(params[0], 10) || 0;
      field.y = parseInt(params[1], 10) || 0;
      continue;
    }

    if (token.startsWith('^A@')) {
      const params = token.slice(3).split(',');
      field.fontOrientation = (params[0] as ParseFieldState['fontOrientation']) || 'N';
      field.fontHeight = parseInt(params[1], 10) || 20;
      field.fontWidth = parseInt(params[2], 10) || field.fontHeight;
      field.customFontLocator = params[3] || null;
      continue;
    }
    if (token.startsWith('^A')) {
      const designator = token[2];
      const orientation = token[3] as ParseFieldState['fontOrientation'];
      const params = token.slice(4).replace(/^,/, '').split(',');
      field.fontDesignator = designator;
      field.fontOrientation = orientation || 'N';
      field.fontHeight = parseInt(params[0], 10) || 20;
      field.fontWidth = parseInt(params[1], 10) || field.fontHeight;
      field.customFontLocator = null;
      continue;
    }

    if (token.startsWith('^BY')) {
      const params = token.slice(3).split(',');
      field.byModuleWidth = parseFloat(params[0]) || 2;
      field.byRatio = parseFloat(params[1]) || 3;
      field.byHeight = parseFloat(params[2]) || 10;
      continue;
    }

    if (token.startsWith('^BQ')) {
      const params = token.slice(3).split(',');
      field.pendingQrCmd = {
        orientation: (params[0] as ParseFieldState['fontOrientation']) || 'N',
        magnification: parseFloat(params[2]) || 4,
      };
      continue;
    }

    if (/^\^B[0-9A-Z]/.test(token) && !token.startsWith('^BY')) {
      const code = token.slice(1, 3);
      const params = token.slice(3).split(',');
      field.pendingBarcodeCmd = { code, params };
      continue;
    }

    if (token.startsWith('^FB')) {
      // Bu sistemde ^FB hiç üretilmiyor; yapıştırılan kodda varsa metin konumlandırmasını
      // etkilemeden yoksayılır (kırpma/kayma riskini önlemek için).
      continue;
    }

    if (token.startsWith('^GB')) {
      const params = token.slice(3).split(',');
      elements.push(makeShape(field, params, dpi, zIndex++));
      continue;
    }

    if (token.startsWith('^GF')) {
      const img = makeImageFromGf(field, token.slice(3), dpi, zIndex);
      if (img) {
        elements.push(img);
        zIndex++;
      } else {
        warnings.push('Bir ^GF görsel/ikon bloğu okunamadı, atlandı.');
      }
      continue;
    }

    if (token.startsWith('^FH')) {
      field.hexEscape = true;
      continue;
    }

    if (token.startsWith('^FD')) {
      let data = token.slice(3).replace(/\^FS.*$/s, '');
      if (field.hexEscape) data = unescapeFieldData(data);
      if (field.pendingBarcodeCmd) {
        const el = makeBarcode(field, data, dpi, warnings, zIndex);
        if (el) {
          elements.push(el);
          zIndex++;
        }
      } else if (field.pendingQrCmd) {
        const el = makeQr(field, data, dpi, zIndex);
        if (el) {
          elements.push(el);
          zIndex++;
        }
      } else {
        elements.push(makeText(field, data, dpi, customFonts, warnings, zIndex));
        zIndex++;
      }
      continue;
    }

    if (token.startsWith('^FS')) {
      field = freshField();
      continue;
    }

    // Tanınmayan komut: sessizce atla, ama tek seferlik uyarı listesine ekle (spam olmasın)
    const codeMatch = token.match(/^[\^~]([A-Z]{1,3})/);
    const code = codeMatch ? codeMatch[1] : token.slice(0, 4);
    if (!unknownCodes.has(code)) {
      unknownCodes.add(code);
      warnings.push(`Desteklenmeyen komut atlandı: ^${code} (bu tür öğeler içe aktarılmadı).`);
    }
  }

  return { elements, widthMm, heightMm, warnings };
}
