// ZPL II'ye uyumlu barkod sembolojileri: her biri için doğru ^B.. komutu üretimi
// ve (mümkünse) tarayıcıda gerçek görsel önizleme desteği.
// Not: ZPL'de barkodun kendisi (çubuk/hücre deseni) yazıcı tarafından ^FD verisinden
// üretilir; biz sadece doğru komutu ve parametreleri gönderiyoruz. Bu yüzden
// jsbarcode ile önizlenemeyen (2B / niş) türler için ZPL çıkışı yine de doğrudur,
// sadece ekran önizlemesi bir "yer tutucu" kutu olarak gösterilir.

import type { BarcodeSymbology } from '../types';

export type BarcodeCategory = '1d-standart' | '1d-endustriyel' | '2d';

export interface BarcodeSymbologyMeta {
  id: BarcodeSymbology;
  label: string;
  category: BarcodeCategory;
  /** ^BY sonrası gelen barkod komutunu üretir (orientation, height(dot), okunabilir metin gösterilsin mi) */
  buildZpl: (orientation: 'N' | 'R' | 'I' | 'B', heightDots: number, showText: boolean) => string;
  /** Bu sembolojinin "okunabilir metin" (interpretation line) seçeneği anlamlı mı */
  supportsShowText: boolean;
  /** buildZpl çıktısında (^Bxx önekinden sonraki virgülle ayrılmış parçalarda) okunabilir
   * metin (f) bayrağının indeksi - yorumlayıcının doğru parametreyi okuyabilmesi için. */
  showTextParamIndex?: number;
  /** Tarayıcıda jsbarcode ile gerçek barkod görseli üretilebilir mi */
  previewable: boolean;
  /** previewable ise jsbarcode format adı */
  jsBarcodeFormat?: string;
}

const Y_N = (v: boolean) => (v ? 'Y' : 'N');

export const BARCODE_SYMBOLOGIES: BarcodeSymbologyMeta[] = [
  // ---- 1B - standart (jsbarcode ile gerçek önizleme) ----
  {
    id: 'CODE128',
    label: 'Code 128',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: true,
    jsBarcodeFormat: 'CODE128',
    buildZpl: (o, h, st) => `^BC${o},${h},${Y_N(st)},N,N,A`,
  },
  {
    id: 'CODE39',
    label: 'Code 39',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 3,
    previewable: true,
    jsBarcodeFormat: 'CODE39',
    buildZpl: (o, h, st) => `^B3${o},N,${h},${Y_N(st)},N`,
  },
  {
    id: 'CODE93',
    label: 'Code 93',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: true,
    jsBarcodeFormat: 'CODE93',
    buildZpl: (o, h, st) => `^BA${o},${h},${Y_N(st)},N,N`,
  },
  {
    id: 'EAN13',
    label: 'EAN-13',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: true,
    jsBarcodeFormat: 'EAN13',
    buildZpl: (o, h, st) => `^BE${o},${h},${Y_N(st)},N`,
  },
  {
    id: 'EAN8',
    label: 'EAN-8',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: true,
    jsBarcodeFormat: 'EAN8',
    buildZpl: (o, h, st) => `^B8${o},${h},${Y_N(st)},N`,
  },
  {
    id: 'UPC',
    label: 'UPC-A',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: true,
    jsBarcodeFormat: 'UPC',
    buildZpl: (o, h, st) => `^BU${o},${h},${Y_N(st)},N,Y`,
  },
  {
    id: 'UPCE',
    label: 'UPC-E',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: false,
    buildZpl: (o, h, st) => `^B9${o},${h},${Y_N(st)},N,Y`,
  },
  {
    id: 'ITF',
    label: 'Interleaved 2 of 5 (ITF)',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: true,
    jsBarcodeFormat: 'ITF',
    buildZpl: (o, h, st) => `^B2${o},${h},${Y_N(st)},N,N`,
  },
  {
    id: 'CODABAR',
    label: 'Codabar (NW-7)',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 3,
    previewable: true,
    jsBarcodeFormat: 'codabar',
    buildZpl: (o, h, st) => `^BK${o},N,${h},${Y_N(st)},N`,
  },
  {
    id: 'MSI',
    label: 'MSI Plessey',
    category: '1d-standart',
    supportsShowText: true,
    showTextParamIndex: 3,
    previewable: true,
    jsBarcodeFormat: 'MSI',
    buildZpl: (o, h, st) => `^BM${o},N,${h},${Y_N(st)},N,N`,
  },

  // ---- 1B - endüstriyel / özel (gerçek önizleme yok, ZPL çıkışı doğru üretilir) ----
  {
    id: 'CODE11',
    label: 'Code 11',
    category: '1d-endustriyel',
    supportsShowText: true,
    showTextParamIndex: 3,
    previewable: false,
    buildZpl: (o, h, st) => `^B1${o},N,${h},${Y_N(st)},N`,
  },
  {
    id: 'STANDARD2OF5',
    label: 'Standard 2 of 5',
    category: '1d-endustriyel',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: false,
    buildZpl: (o, h, st) => `^BJ${o},${h},${Y_N(st)},N`,
  },
  {
    id: 'INDUSTRIAL2OF5',
    label: 'Industrial 2 of 5',
    category: '1d-endustriyel',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: false,
    buildZpl: (o, h, st) => `^BI${o},${h},${Y_N(st)},N`,
  },
  {
    id: 'PLANET',
    label: 'PLANET Code',
    category: '1d-endustriyel',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: false,
    buildZpl: (o, h, st) => `^B5${o},${h},${Y_N(st)},N`,
  },
  {
    id: 'LOGMARS',
    label: 'LOGMARS',
    category: '1d-endustriyel',
    supportsShowText: false,
    previewable: false,
    buildZpl: (o, h) => `^BL${o},${h},N`,
  },
  {
    id: 'PLESSEY',
    label: 'Plessey',
    category: '1d-endustriyel',
    supportsShowText: true,
    showTextParamIndex: 3,
    previewable: false,
    buildZpl: (o, h, st) => `^BP${o},N,${h},${Y_N(st)},N`,
  },
  {
    id: 'POSTAL',
    label: 'Postal (USPS)',
    category: '1d-endustriyel',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: false,
    buildZpl: (o, h, st) => `^BZ${o},${h},${Y_N(st)},N`,
  },

  // ---- 2B (barkod deseni yazıcı tarafından üretilir; önizleme yer tutucudur) ----
  {
    id: 'PDF417',
    label: 'PDF417',
    category: '2d',
    supportsShowText: false,
    previewable: false,
    buildZpl: (o, h) => `^B7${o},${h}`,
  },
  {
    id: 'DATAMATRIX',
    label: 'Data Matrix',
    category: '2d',
    supportsShowText: false,
    previewable: false,
    buildZpl: (o, h) => `^BX${o},${h}`,
  },
  {
    id: 'AZTEC',
    label: 'Aztec Code',
    category: '2d',
    supportsShowText: false,
    previewable: false,
    buildZpl: (o) => `^BO${o}`,
  },
  {
    id: 'MAXICODE',
    label: 'MaxiCode',
    category: '2d',
    supportsShowText: false,
    previewable: false,
    buildZpl: () => `^BD`,
  },
  {
    id: 'GS1DATABAR',
    label: 'GS1 DataBar',
    category: '2d',
    supportsShowText: false,
    previewable: false,
    buildZpl: (o, h) => `^BR${o},1,${h}`,
  },
  {
    id: 'CODABLOCK',
    label: 'Codablock',
    category: '2d',
    supportsShowText: false,
    previewable: false,
    buildZpl: (o, h) => `^BB${o},${h}`,
  },
  {
    id: 'MICROPDF417',
    label: 'MicroPDF417',
    category: '2d',
    supportsShowText: false,
    previewable: false,
    buildZpl: (o, h) => `^BF${o},${h}`,
  },
  {
    id: 'CODE49',
    label: 'Code 49',
    category: '2d',
    supportsShowText: true,
    showTextParamIndex: 2,
    previewable: false,
    buildZpl: (o, h, st) => `^B4${o},${h},${Y_N(st)}`,
  },
  {
    id: 'TLC39',
    label: 'TLC39',
    category: '2d',
    supportsShowText: false,
    previewable: false,
    buildZpl: (o) => `^BT${o}`,
  },
];

const BY_ID = new Map(BARCODE_SYMBOLOGIES.map((m) => [m.id, m]));

export function getBarcodeMeta(id: BarcodeSymbology): BarcodeSymbologyMeta {
  return BY_ID.get(id) ?? BARCODE_SYMBOLOGIES[0];
}

export const CATEGORY_LABELS: Record<BarcodeCategory, string> = {
  '1d-standart': 'Standart 1B Barkodlar',
  '1d-endustriyel': 'Endüstriyel / Özel 1B Barkodlar',
  '2d': '2B Barkodlar (desen yazıcıda üretilir)',
};

/** ZPL komut kodu (^ sonrası 2 karakter, örn "BC","B3","B9") -> sembol eşlemesi (yorumlayıcı için) */
export const ZPL_CODE_TO_SYMBOLOGY: Record<string, BarcodeSymbology> = {
  BC: 'CODE128',
  B3: 'CODE39',
  BA: 'CODE93',
  BE: 'EAN13',
  B8: 'EAN8',
  BU: 'UPC',
  B9: 'UPCE',
  B2: 'ITF',
  BK: 'CODABAR',
  BM: 'MSI',
  B1: 'CODE11',
  BJ: 'STANDARD2OF5',
  BI: 'INDUSTRIAL2OF5',
  B5: 'PLANET',
  BL: 'LOGMARS',
  BP: 'PLESSEY',
  BZ: 'POSTAL',
  B7: 'PDF417',
  BX: 'DATAMATRIX',
  BO: 'AZTEC',
  B0: 'AZTEC',
  BD: 'MAXICODE',
  BR: 'GS1DATABAR',
  BB: 'CODABLOCK',
  BF: 'MICROPDF417',
  B4: 'CODE49',
  BT: 'TLC39',
};

/** Yer tutucu (placeholder) barkod önizlemesi: gerçek desen yazıcıda üretileceği için
 * ekranda sadece bir çerçeve + tür etiketi + veri metni gösterilir. */
export function drawPlaceholderBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  data: string,
): void {
  const width = Math.max(40, w);
  const height = Math.max(30, h);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y + 1, width - 2, height - 2);
  ctx.clip();
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  for (let i = -height; i < width; i += 9) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + height);
    ctx.lineTo(x + i + height, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.max(9, Math.min(13, height / 4));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillText(label, x + width / 2, y + height / 2 - fontSize * 0.7);
  ctx.font = `${Math.max(8, fontSize - 2)}px sans-serif`;
  ctx.fillText('desen yazıcıda üretilir', x + width / 2, y + height / 2 + fontSize * 0.4);
  ctx.font = `${Math.max(8, fontSize - 2)}px monospace`;
  const shown = (data || '').slice(0, 24);
  ctx.fillText(shown, x + width / 2, y + height / 2 + fontSize * 1.6);
  ctx.restore();
}
