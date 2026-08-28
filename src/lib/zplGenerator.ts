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
import { needsBitmapQr } from './qrSize';
import { getFontFamilyName } from './zplInterpreter';

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

/**
 * ZPL'de ^FB (Field Block) komutu bir alanın içindeki metni sola/ortaya/sağa yaslamak için
 * kullanılabilir, ancak verilen genişlik gerçek metin genişliğinden küçük kalırsa satır
 * kırpılır/kaybolur (maxLines=1 olduğunda taşan karakterler basılmaz). Bu, önizlemede doğru
 * görünen ama baskıda metnin kaybolmasına yol açan bir soruna sebep oldu; bu yüzden bu sistemde
 * ^FB HİÇ KULLANILMIYOR. Onun yerine "orta/sağ" hizalama, metnin tahmini piksel genişliği
 * hesaplanıp ^FO/^FT ile verilen başlangıç konumu (x veya y, döndürme yönüne göre) buna göre
 * kaydırılarak elde edilir — bu, alanı sınırlamadığı için taşma/kırpma riski taşımaz.
 */
let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
  }
  return measureCtx as CanvasRenderingContext2D;
}

function estimateTextWidthDots(text: string, heightDots: number, fontFamily: string): number {
  const ctx = getMeasureCtx();
  if (!ctx) return 0;
  ctx.font = `${Math.max(1, heightDots)}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

function alignShiftDots(el: TextElement, textWidthDots: number, widthDots: number): number {
  if (el.align === 'center') return Math.max(0, (widthDots - textWidthDots) / 2);
  if (el.align === 'right') return Math.max(0, widthDots - textWidthDots);
  return 0;
}

/** Hizalama kaydırmasını döndürme yönüne göre doğru eksene (x veya y) uygular. */
function applyAlignShift(
  x: number,
  y: number,
  shift: number,
  orientation: 'N' | 'R' | 'I' | 'B',
): { x: number; y: number } {
  switch (orientation) {
    case 'R': return { x, y: Math.round(y + shift) };
    case 'I': return { x: Math.round(x - shift), y };
    case 'B': return { x, y: Math.round(y - shift) };
    default: return { x: Math.round(x + shift), y };
  }
}

function genText(el: TextElement, ctx: GeneratorContext, offsetXDots: number): string {
  const { dpi } = ctx.labelSettings;
  const h = mmToDots(el.fontSize, dpi);
  const w = h; // varsayılan olarak orantılı
  const widthDots = mmToDots(el.width, dpi);
  const orientation = rotationToOrientation(el.rotation);
  const lines: string[] = [];

  const font = el.isCustomFont ? ctx.customFonts.find((f) => f.id === el.fontRef) : undefined;

  let fontFamily = 'Arial, sans-serif';
  if (font) {
    const family = getFontFamilyName(font.id);
    if (family) fontFamily = `"${family}"`;
  }

  let shift = 0;
  if (el.align !== 'left') {
    const textWidthDots = estimateTextWidthDots(el.text, h, fontFamily);
    shift = alignShiftDots(el, textWidthDots, widthDots);
  }

  const baseX = mmToDots(el.x, dpi) + offsetXDots;
  const baseY = mmToDots(el.y, dpi);
  const { x, y } = applyAlignShift(baseX, baseY, shift, orientation);

  if (font) {
    // Not: ^FT yerine ^FO kullanılıyor -- ^FT'nin y koordinatı gerçek ZPL'de metnin
    // baseline'ı (alt kenarı) olduğundan, tasarım kanvasındaki üst-sol referanslı y ile
    // doğrudan eşleşmez ve baskıda metin önizlemeye göre kayardı. ^FO ile diğer tüm
    // eleman türleriyle (şekil, resim, barkod, QR) aynı üst-sol referans korunur.
    lines.push(`^FO${x},${y}`);
    lines.push(generateFontRefZpl(font, h, w, orientation));
    lines.push('^FH\\');
    lines.push('^CI28');
    lines.push(`^FD${escapeFieldData(el.text)}^FS`);
    lines.push('^CI27');
    return lines.join('');
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
  const thickness = Math.max(1, mmToDots(el.thicknessMm, dpi));
  const color = el.color === 'white' ? 'W' : 'B';

  // Döndürmesiz temel kutu boyutları (dot)
  let boxW: number;
  let boxH: number;
  if (el.shape === 'line') {
    // Çizgi yönü elemanın en/boy oranından belirlenir: uzun-dar ise dikey, aksi halde yatay.
    const wDots = Math.max(1, mmToDots(el.width, dpi));
    const hDots = Math.max(1, mmToDots(el.height, dpi));
    if (hDots > wDots) {
      boxW = thickness;
      boxH = hDots;
    } else {
      boxW = wDots;
      boxH = thickness;
    }
  } else {
    boxW = Math.max(1, mmToDots(el.width, dpi));
    boxH = Math.max(1, mmToDots(el.height, dpi));
  }

  // ^GB doğal olarak dönmez; 90/270 için boyutları takas edip kutuyu merkez
  // etrafında yeniden konumlandırarak tasarım katmanındaki CSS rotasyonuyla eşleştir.
  let drawW = boxW;
  let drawH = boxH;
  let drawX = x;
  let drawY = y;
  if (el.rotation === 90 || el.rotation === 270) {
    const cx = x + boxW / 2;
    const cy = y + boxH / 2;
    drawW = boxH;
    drawH = boxW;
    drawX = Math.round(cx - drawW / 2);
    drawY = Math.round(cy - drawH / 2);
  }

  const rounding = el.shape === 'line' ? 0 : el.cornerRounding;
  const box = `^FO${drawX},${drawY}^GB${drawW},${drawH},${thickness},${color},${rounding}^FS`;
  // Ters baskı: alanı ^LR ile sar -- yorumlayıcı bu bölgeyi ters çevirir (siyah zemin/beyaz yazı).
  return el.reverse ? `^LRY${box}^LRN` : box;
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
  // Native ^BQ komutu büyütmeyi 1-10 ile sınırlar (yazıcı firmware kısıtı). Bu aralığın
  // üzerinde istenen boyutlar için QR bir bitmap (^GFA) olarak gömülür; böylece QR kodu
  // sınırsız şekilde büyütülüp küçültülebilir.
  if (needsBitmapQr(el.magnification)) {
    const bmpZpl = genBitmapField(el.id, x, y, ctx);
    if (bmpZpl) return bmpZpl;
  }
  const orientation = rotationToOrientation(el.rotation);
  // Bilinen bir Zebra firmware hatası: daha önce bir barkod alanında (^BY ...,h) kullanılan
  // "height" parametresi yazıcı belleğinde "sticky" kalır ve sonraki ^BQ (QR) alanının
  // baskıdaki konumunu aşağı kaydırır (önizlemede bu firmware hatası simüle edilmediği için
  // fark edilmez). Bunu önlemek için her QR alanından önce ^BY'nin height parametresini 0'a
  // sıfırlıyoruz -- Zebra'nın resmi önerisi de budur.
  return `^FO${x},${y}^BY2,3,0^BQ${orientation},2,${el.magnification}^FD${el.errorCorrection}A,${escapeFieldData(el.data)}^FS`;
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
  const { widthMm, dpi, labelsAcross, horizontalGapMm } = ctx.labelSettings;
  const labelWidthDots = mmToDots(widthMm, dpi);
  const gapDots = mmToDots(horizontalGapMm, dpi);
  const count = Math.max(1, labelsAcross || 1);

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

  // Not: Etiket ebatı (^PW/^LL) ZPL çıktısına YAZILMAZ -- ebat yalnızca uygulama içi
  // önizleme (canvas boyutlandırma) için kullanılır. Böylece üretilen kod, yazıcının
  // kendi etiket/medya ayarlarına müdahale etmez.
  const parts: string[] = [];
  parts.push('^XA');
  parts.push('^CI28');
  for (const b of body) parts.push(b);
  parts.push('^XZ');
  return parts.join('\n');
}
