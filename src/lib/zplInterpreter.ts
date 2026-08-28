import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import type { CustomFont, Dpi } from '../types';
import { base64ToBytes } from './fontToZpl';
import { getBarcodeMeta, drawPlaceholderBarcode, ZPL_CODE_TO_SYMBOLOGY } from './barcodeSymbologies';
import { gfDataToBytes } from './gfDecode';

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
  pendingBarcodeCmd: { code: string; params: string[] } | null;
  pendingQrCmd: { orientation: string; magnification: number } | null;
  pendingGf: string | null; // raw ^GF... token param string
  hexEscape: boolean;
  fieldBlock: { width: number; justification: 'L' | 'C' | 'R' | 'J' } | null;
  /** ^FT ile konumlandırıldı mı? ZPL'de ^FO y'si üst-sol referanslıdır, ^FT y'si ise
   * metin için baseline (alt kenar), barkod/QR/grafik için sembolün alt kenarı referanslıdır.
   * Bu fark render'da telafi edilmezse ^FT kullanan (özellikle dışarıdan yapıştırılan) ZPL
   * kodları önizlemede/baskıda farklı konumlara düşer. */
  isFT: boolean;
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
    fieldBlock: null,
    isFT: false,
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
  isFT = false,
): void {
  // format,dataBytes,totalBytes,rowBytes,hexdata
  const firstComma = gfParamsRaw.indexOf(',');
  const rest = gfParamsRaw.slice(firstComma + 1);
  const parts = rest.split(',');
  if (parts.length < 4) return;
  const totalBytes = parseInt(parts[1], 10);
  const rowBytes = parseInt(parts[2], 10);
  const hexData = parts.slice(3).join(',');
  if (!Number.isFinite(totalBytes) || !Number.isFinite(rowBytes) || rowBytes <= 0) return;
  const height = Math.floor(totalBytes / rowBytes);
  const width = rowBytes * 8;
  if (!width || !height || width > 10000 || height > 10000) return;
  const drawY = isFT ? y - height : y;

  // Sıkıştırılmış (ACS) veya düz HEX veriyi bayt dizisine aç.
  const bytes = gfDataToBytes(hexData, rowBytes, totalBytes);

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
  ctx.drawImage(off, x, drawY);
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
  const symbology = ZPL_CODE_TO_SYMBOLOGY[field.pendingBarcodeCmd.code];
  const meta = symbology ? getBarcodeMeta(symbology) : null;
  if (meta && meta.previewable && meta.jsBarcodeFormat) {
    const idx = meta.showTextParamIndex;
    const showText = idx != null ? field.pendingBarcodeCmd.params[idx] === 'Y' : false;
    const off = document.createElement('canvas');
    try {
      JsBarcode(off, data, {
        format: meta.jsBarcodeFormat,
        width: field.byModuleWidth,
        height: field.byHeight,
        displayValue: showText,
        margin: 0,
        fontSize: 14,
      });
      // ^FT'de y, barkodun (yazı hariç) alt kenarını gösterir -- ^BY'nin height
      // parametresi bar yüksekliğidir, bu yüzden offset için byHeight kullanılır.
      const drawY = field.isFT ? y - field.byHeight : y;
      ctx.drawImage(off, x, drawY);
      return;
    } catch {
      warnings.push(`Barkod render edilemedi: ${data}`);
      return;
    }
  }
  // Önizlenemeyen tür (2B veya niş 1B): yer tutucu kutu çiz, ZPL çıkışı yine de doğru üretilir.
  const label = meta ? meta.label : field.pendingBarcodeCmd.code;
  const w = Math.max(60, data.length * Math.max(1, field.byModuleWidth) * 11);
  const h = Math.max(30, field.byHeight);
  const drawY = field.isFT ? y - h : y;
  drawPlaceholderBarcode(ctx, x, drawY, w, h, label, data);
  warnings.push(`${label} barkodu bu önizlemede yaklaşık gösteriliyor (desen yazıcı tarafından üretilir).`);
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
    // ZPL ^BQ büyütme faktörü (magnification), doğrudan modül başına dot sayısıdır
    // (bkz. qrSize.ts: qrSizeMm = moduleCount * magnification / dotsPerMm). Burada da
    // aynı birebir eşleme kullanılmalı, aksi halde önizleme QR'ı gerçek boyuttan büyük
    // gösterir ve metinlerle aşırı örtüşmeye sebep olur.
    const moduleSize = Math.max(1, Math.round(field.pendingQrCmd.magnification));
    QRCode.toCanvas(off, data, { errorCorrectionLevel, margin: 0, width: undefined, scale: moduleSize });
    // ^FT'de y, sembolün alt kenarını gösterir -- render sonrası oluşan gerçek yükseklik
    // (off.height) ile offset uygulanır. Ayrıca bilinen bir Zebra firmware tuhaflığı: o ana
    // kadar ayarlanmış (sticky) ^BY yükseklik parametresi -- ^FO kullanılsa bile -- QR kodunu
    // aşağı kaydırır (bkz. Zebra KB "^BY Command parameter causes a position shift of the QR
    // Code Barcode"). Bu kaymayı telafi etmek için byHeight de düşülür.
    const drawY = (field.isFT ? y - off.height : y) - field.byHeight;
    ctx.drawImage(off, x, drawY);
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
  forcedSize?: { widthDots: number; heightDots: number },
): Promise<InterpretResult> {
  const warnings: string[] = [];
  let pw = Math.round(4 * dpi);
  let ll = Math.round(6 * dpi);

  // Önizleme boyutu artık ZPL'deki ^PW/^LL'den değil, uygulamadaki etiket ayarlarından
  // (forcedSize) gelir -- üretilen ZPL ebat komutu içermez. Geriye dönük uyumluluk için
  // (örn. elle yapıştırılan kodda ^PW/^LL varsa) yine de ayrıştırılır.
  if (forcedSize) {
    pw = forcedSize.widthDots;
    ll = forcedSize.heightDots;
  } else {
    const pwMatch = zpl.match(/\^PW(\d+)/);
    const llMatch = zpl.match(/\^LL(\d+)/);
    if (pwMatch) pw = parseInt(pwMatch[1], 10);
    if (llMatch) ll = parseInt(llMatch[1], 10);
  }

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
    if (font.fileType !== 'FNT') {
      await ensureFontFaceLoaded(font);
    }
    const target = font.targetName;
    const addKey = (name: string) => {
      downloadedLocators.set(name, font);
      downloadedLocators.set(`${font.drive}:${name}`, font);
    };
    addKey(target);
    // ZPL bellek isimleri gerçek yazıcılarda 8 karakter ada + kısaltılmış uzantıya
    // sahip olabilir (örn. "21942699.FNT" yazıcıda "21942699.FN" olarak referans
    // verilebilir). Eşleşmeyi kaçırmamak için uzantının tüm kısaltılmış
    // varyantlarını (ve uzantısız hâlini) da haritaya ekliyoruz.
    const dotIdx = target.lastIndexOf('.');
    if (dotIdx > 0) {
      const base = target.slice(0, dotIdx);
      const ext = target.slice(dotIdx + 1);
      addKey(base);
      for (let len = 1; len < ext.length; len++) {
        addKey(`${base}.${ext.slice(0, len)}`);
      }
    }
  }

  const tokens = zpl.split(/(?=[\^~])/).filter((t) => t.trim().length > 0);
  let field = freshField();
  let labelReverse = false; // ^LR (Label Reverse) durumu -- ^XZ'ye kadar sürer

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
      field.isFT = token.startsWith('^FT');
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

    if (token.startsWith('^BQ')) {
      const params = token.slice(3).split(',');
      field.pendingQrCmd = {
        orientation: params[0] || 'N',
        magnification: parseFloat(params[2]) || 4,
      };
      continue;
    }

    if (/^\^B[0-9A-Z]/.test(token) && !token.startsWith('^BY')) {
      const code = token.slice(1, 3);
      const params = token.slice(3).split(',');
      // Yükseklik ^BY komutundan (byHeight) zaten doğru şekilde alınıyor; barkoda özgü
      // parametre sırası sembolojiye göre değiştiği için burada tekrar ayrıştırılmıyor.
      field.pendingBarcodeCmd = { code, params };
      continue;
    }

    if (token.startsWith('^FB')) {
      const params = token.slice(3).split(',');
      field.fieldBlock = {
        width: parseInt(params[0], 10) || 0,
        justification: (params[3] as 'L' | 'C' | 'R' | 'J') || 'L',
      };
      continue;
    }

    if (token.startsWith('^LR')) {
      // Label Reverse: ^LRY ters baskıyı açar, ^LRN kapatır (^XZ'ye kadar sürer).
      labelReverse = token.slice(3, 4).toUpperCase() === 'Y';
      continue;
    }

    if (token.startsWith('^GB')) {
      const params = token.slice(3).split(',');
      const w = parseInt(params[0], 10) || 1;
      let h = parseInt(params[1], 10);
      if (!Number.isFinite(h)) h = 1;
      const thickness = parseInt(params[2], 10) || 1;
      const color = (params[3] as 'B' | 'W') || 'B';
      const rounding = parseInt(params[4], 10) || 0;
      // Dolu bar: yükseklik <= kalınlık ise gerçek yükseklik = kalınlık (solid).
      const solidH = h <= thickness ? thickness : h;
      const drawY = field.isFT ? field.y - solidH : field.y;
      if (labelReverse) {
        // Ters baskı: kutunun altındaki pikselleri ters çevir (siyah zemin/beyaz yazı).
        invertRegion(ctx, field.x, drawY, w, solidH, scale);
      } else {
        drawShape(ctx, field.x, drawY, w, h, thickness, color, rounding);
      }
      continue;
    }

    if (token.startsWith('^GF')) {
      drawGfBitmap(ctx, field.x, field.y, token.slice(3), field.isFT);
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
        // ^FD içindeki "\&" (backslash+ampersand) ZPL'de satır sonu/kesme işaretidir.
        // ^FB (Field Block) aktifse gerçek bir satır sonu olarak tüketilir (görünmez);
        // değilse yazıcı ters eğik çizgiyi düşürüp yalnızca "&" karakterini basar.
        data = field.fieldBlock ? data.replace(/\\&/g, '') : data.replace(/\\&/g, '&');
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
  // Yatay bar/çizgi: yükseklik kalınlıktan küçük/eşitse kalınlık kadar dolu çiz.
  if (h <= thickness) {
    ctx.fillRect(x, y, w, thickness);
    return;
  }
  // Dikey bar/çizgi: genişlik kalınlıktan küçük/eşitse kalınlık kadar dolu çiz.
  if (w <= thickness) {
    ctx.fillRect(x, y, thickness, h);
    return;
  }
  // Çerçeve (içi boş kutu)
  ctx.fillRect(x, y, w, thickness);
  ctx.fillRect(x, y + h - thickness, w, thickness);
  ctx.fillRect(x, y, thickness, h);
  ctx.fillRect(x + w - thickness, y, thickness, h);
}

/** Verilen dikdörtgen bölgedeki pikselleri ters çevirir (^LR/^FR ters baskı efekti).
 * ctx `scale` ile ölçeklenmiş olduğundan getImageData/putImageData için cihaz pikseline çevrilir. */
function invertRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number,
): void {
  const dx = Math.max(0, Math.round(x * scale));
  const dy = Math.max(0, Math.round(y * scale));
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);
  if (dw <= 0 || dh <= 0) return;
  try {
    const img = ctx.getImageData(dx, dy, dw, dh);
    const d = img.data;
    for (let p = 0; p < d.length; p += 4) {
      d[p] = 255 - d[p];
      d[p + 1] = 255 - d[p + 1];
      d[p + 2] = 255 - d[p + 2];
    }
    ctx.putImageData(img, dx, dy);
  } catch {
    // getImageData güvenlik hatası (tainted canvas) vb. -- sessizce yoksay
  }
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
  // ^FO: y üst-sol referanslıdır (textBaseline='top'). ^FT: y, metnin baseline'ıdır
  // (textBaseline='alphabetic') -- gerçek ZPL davranışıyla eşleşmesi için ayrıştırılır.
  ctx.textBaseline = field.isFT ? 'alphabetic' : 'top';
  ctx.fillStyle = '#000000';
  ctx.translate(field.x, field.y);
  if (field.fontOrientation === 'R') ctx.rotate(Math.PI / 2);
  if (field.fontOrientation === 'I') ctx.rotate(Math.PI);
  if (field.fontOrientation === 'B') ctx.rotate(-Math.PI / 2);

  // ^FB (Field Block) alanı içinde metni sola/ortaya/sağa yaslama: gerçek ZPL çıktısıyla
  // aynı davranışı önizlemede de yansıtmak için metin genişliğini ölçüp ofset uyguluyoruz.
  let drawX = 0;
  if (field.fieldBlock && field.fieldBlock.width > 0) {
    const textWidth = ctx.measureText(data).width;
    const blockWidth = field.fieldBlock.width;
    if (field.fieldBlock.justification === 'C') {
      drawX = Math.max(0, (blockWidth - textWidth) / 2);
    } else if (field.fieldBlock.justification === 'R') {
      drawX = Math.max(0, blockWidth - textWidth);
    }
  }
  ctx.fillText(data, drawX, 0);
  ctx.restore();
}
