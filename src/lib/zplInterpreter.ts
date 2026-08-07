import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { CustomFont, Dpi } from '../types';
import { base64ToBytes } from './fontToZpl';

export interface InterpretResult {
  warnings: string[];
}

interface FieldState {
  x: number;
  y: number;
  fontDesignator: string; // '0'..'9' | 'A'..'H'
  fontHeight: number;
  fontWidth: number;
  fontOrientation: 'N' | 'R' | 'I' | 'B';
  customFontLocator: string | null;
  byModuleWidth: number;
  byRatio: number;
  byHeight: number;
  pendingShape: { w: number; h: number; thickness: number; color: 'B' | 'W'; rounding: number } | null;
  pendingBarcodeCmd: { type: 'BC' | 'BE' | 'B8' | 'BU'; params: string[] } | null;
  pendingQrCmd: { orientation: string; magnification: number } | null;
  pendingGf: string | null; // raw ^GF... token param string
  hexEscape: boolean;
}

function freshField(): FieldState {
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
    pendingShape: null,
    pendingBarcodeCmd: null,
    pendingQrCmd: null,
    pendingGf: null,
    hexEscape: false,
  };
}

const fontFamilyRegistry = new Map<string, string>(); // locator -> css family name

export function getFontFamilyName(fontId: string): string | undefined {
  return fontFamilyRegistry.get(fontId);
}

export async function ensureFontFaceLoaded(font: CustomFont): Promise<string | null> {
  if (font.fileType === 'FNT') return null; // rasterize edilemez
  const key = font.id;
  const cached = fontFamilyRegistry.get(key);
  if (cached) return cached;
  try {
    const bytes = base64ToBytes(font.fileBytesBase64);
    const familyName = `custom-font-${font.id}`;
    const face = new FontFace(familyName, bytes.buffer as ArrayBuffer);
    await face.load();
    (document.fonts as FontFaceSet).add(face);
    fontFamilyRegistry.set(key, familyName);
    return familyName;
  } catch {
    return null;
  }
}

function unescapeFieldData(data: string): string {
  return data.replace(/\\([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function drawGfBitmap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gfParamsRaw: string,
): void {
  // format,dataBytes,totalBytes,rowBytes,hexdata
  const firstComma = gfParamsRaw.indexOf(',');
  const rest = gfParamsRaw.slice(firstComma + 1);
  const parts = rest.split(',');
  if (parts.length < 4) return;
  const totalBytes = parseInt(parts[1], 10);
  const rowBytes = parseInt(parts[2], 10);
  const hexData = parts.slice(3).join(',');
  const height = Math.floor(totalBytes / rowBytes);
  const width = rowBytes * 8;
  if (!width || !height || width > 10000 || height > 10000) return;

  const bytes = new Uint8Array(totalBytes);
  for (let i = 0; i < totalBytes; i++) {
    const byteHex = hexData.substr(i * 2, 2);
    bytes[i] = parseInt(byteHex, 16) || 0;
  }

  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const octx = off.getContext('2d')!;
  const imgData = octx.createImageData(width, height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const byteIndex = row * rowBytes + (col >> 3);
      const bitIndex = 7 - (col % 8);
      const isBlack = (bytes[byteIndex] >> bitIndex) & 1;
      const pixelIdx = (row * width + col) * 4;
      if (isBlack) {
        imgData.data[pixelIdx] = 0;
        imgData.data[pixelIdx + 1] = 0;
        imgData.data[pixelIdx + 2] = 0;
        imgData.data[pixelIdx + 3] = 255;
      } else {
        imgData.data[pixelIdx + 3] = 0;
      }
    }
  }
  octx.putImageData(imgData, 0, 0);
  ctx.drawImage(off, x, y);
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  field: FieldState,
  data: string,
  warnings: string[],
): void {
  if (!field.pendingBarcodeCmd) return;
  const formatMap: Record<string, string> = {
    BC: 'CODE128',
    BE: 'EAN13',
    B8: 'EAN8',
    BU: 'UPC',
  };
  const format = formatMap[field.pendingBarcodeCmd.type];
  const showText = field.pendingBarcodeCmd.params[1] === 'Y';
  const off = document.createElement('canvas');
  try {
    JsBarcode(off, data, {
      format,
      width: field.byModuleWidth,
      height: field.byHeight,
      displayValue: showText,
      margin: 0,
      fontSize: 14,
    });
    ctx.drawImage(off, x, y);
  } catch {
    warnings.push(`Barkod render edilemedi: ${data}`);
  }
}

function drawQr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  field: FieldState,
  fdRaw: string,
  warnings: string[],
): void {
  if (!field.pendingQrCmd) return;
  // fdRaw formatı: "<errorCorrection><A>,<data>" örn "QA,12345678"
  const commaIdx = fdRaw.indexOf(',');
  const data = commaIdx >= 0 ? fdRaw.slice(commaIdx + 1) : fdRaw;
  const ecLetter = fdRaw[0] || 'Q';
  const ecMap: Record<string, 'L' | 'M' | 'Q' | 'H'> = { L: 'L', M: 'M', Q: 'Q', H: 'H' };
  const errorCorrectionLevel = ecMap[ecLetter] || 'Q';
  const off = document.createElement('canvas');
  try {
    const moduleSize = Math.max(1, Math.round(field.pendingQrCmd.magnification * 3));
    QRCode.toCanvas(off, data, { errorCorrectionLevel, margin: 0, width: undefined, scale: moduleSize });
    ctx.drawImage(off, x, y);
  } catch {
    warnings.push(`QR kod render edilemedi: ${data}`);
  }
}

export async function renderZplToCanvas(
  zpl: string,
  canvas: HTMLCanvasElement,
  dpi: Dpi,
  customFonts: CustomFont[],
  scale = 2,
): Promise<InterpretResult> {
  const warnings: string[] = [];
  let pw = Math.round(4 * dpi);
  let ll = Math.round(6 * dpi);

  const pwMatch = zpl.match(/\^PW(\d+)/);
  const llMatch = zpl.match(/\^LL(\d+)/);
  if (pwMatch) pw = parseInt(pwMatch[1], 10);
  if (llMatch) ll = parseInt(llMatch[1], 10);

  canvas.width = Math.max(1, Math.round(pw * scale));
  canvas.height = Math.max(1, Math.round(ll * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return { warnings: ['Canvas context alınamadı'] };
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  // Not: Font verisi ZPL'e gömülmez (~DY üretilmez), yazıcıya ayrıca yüklendiği kabul edilir.
  // Önizlemede doğru görünmesi için uygulamada yüklü CustomFont kaydından bellek adına göre eşleştirip yüklüyoruz.
  const downloadedLocators = new Map<string, CustomFont>();
  for (const font of customFonts) {
    if (font.fileType === 'FNT') continue;
    await ensureFontFaceLoaded(font);
    downloadedLocators.set(font.targetName, font);
    downloadedLocators.set(`${font.drive}:${font.targetName}`, font);
  }

  const tokens = zpl.split(/(?=[\^~])/).filter((t) => t.trim().length > 0);
  let field = freshField();

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (token.startsWith('^XA') || token.startsWith('^XZ')) continue;
    if (token.startsWith('^CI')) continue;
    if (token.startsWith('^PW') || token.startsWith('^LL')) continue;
    if (token.startsWith('~DY')) continue; // artık üretilmiyor ama Kod Modu'nda elle yazılmışsa yoksayılır

    if (token.startsWith('^FO') || token.startsWith('^FT')) {
      const params = token.slice(3).split(',');
      field.x = parseInt(params[0], 10) || 0;
      field.y = parseInt(params[1], 10) || 0;
      continue;
    }

    if (token.startsWith('^A@')) {
      const params = token.slice(3).split(',');
      field.fontOrientation = (params[0] as FieldState['fontOrientation']) || 'N';
      field.fontHeight = parseInt(params[1], 10) || 20;
      field.fontWidth = parseInt(params[2], 10) || field.fontHeight;
      field.customFontLocator = params[3] || null;
      continue;
    }
    if (token.startsWith('^A')) {
      const designator = token[2];
      const orientation = token[3] as FieldState['fontOrientation'];
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

    if (token.startsWith('^BC') || token.startsWith('^BE') || token.startsWith('^B8') || token.startsWith('^BU')) {
      const type = token.slice(1, 3) as 'BC' | 'BE' | 'B8' | 'BU';
      const params = token.slice(3).split(',');
      if (params[1]) field.byHeight = parseFloat(params[1]) || field.byHeight;
      field.pendingBarcodeCmd = { type, params };
      continue;
    }

    if (token.startsWith('^BQ')) {
      const params = token.slice(3).split(',');
      field.pendingQrCmd = {
        orientation: params[0] || 'N',
        magnification: parseFloat(params[2]) || 4,
      };
      continue;
    }

    if (token.startsWith('^GB')) {
      const params = token.slice(3).split(',');
      const w = parseInt(params[0], 10) || 1;
      const h = parseInt(params[1], 10) || 1;
      const thickness = parseInt(params[2], 10) || 1;
      const color = (params[3] as 'B' | 'W') || 'B';
      const rounding = parseInt(params[4], 10) || 0;
      drawShape(ctx, field.x, field.y, w, h, thickness, color, rounding);
      continue;
    }

    if (token.startsWith('^GF')) {
      drawGfBitmap(ctx, field.x, field.y, token.slice(3));
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
        drawBarcode(ctx, field.x, field.y, field, data, warnings);
      } else if (field.pendingQrCmd) {
        drawQr(ctx, field.x, field.y, field, data, warnings);
      } else {
        drawText(ctx, field, data, downloadedLocators, warnings);
      }
      continue;
    }

    if (token.startsWith('^FS')) {
      field = freshField();
      continue;
    }
  }

  ctx.restore();
  return { warnings };
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  thickness: number,
  color: 'B' | 'W',
  _rounding: number,
): void {
  ctx.fillStyle = color === 'W' ? '#ffffff' : '#000000';
  if (w <= thickness * 2 || h <= thickness * 2) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  ctx.fillRect(x, y, w, thickness);
  ctx.fillRect(x, y + h - thickness, w, thickness);
  ctx.fillRect(x, y, thickness, h);
  ctx.fillRect(x + w - thickness, y, thickness, h);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  field: FieldState,
  data: string,
  downloadedLocators: Map<string, CustomFont>,
  warnings: string[],
): void {
  let fontFamily = 'Arial, sans-serif';
  if (field.customFontLocator) {
    const font = downloadedLocators.get(field.customFontLocator);
    if (font) {
      const family = fontFamilyRegistry.get(font.id);
      if (family) {
        fontFamily = `"${family}"`;
      } else {
        warnings.push(`.FNT fontu tam önizlenemiyor (${font.targetName}), varsayılan fontla gösteriliyor.`);
      }
    } else {
      warnings.push(`Özel font bulunamadı: ${field.customFontLocator}`);
    }
  }
  ctx.save();
  ctx.font = `${field.fontHeight}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.translate(field.x, field.y);
  if (field.fontOrientation === 'R') ctx.rotate(Math.PI / 2);
  if (field.fontOrientation === 'I') ctx.rotate(Math.PI);
  if (field.fontOrientation === 'B') ctx.rotate(-Math.PI / 2);
  ctx.fillText(data, 0, 0);
  ctx.restore();
}
