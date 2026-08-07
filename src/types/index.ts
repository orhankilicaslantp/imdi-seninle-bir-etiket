// Ortak tipler: etiket tasarım aracı için element modeli, font ve etiket ayarları

export type Rotation = 0 | 90 | 180 | 270;

export type Dpi = 203 | 300 | 600;

export interface LabelSettings {
  widthMm: number;
  heightMm: number;
  dpi: Dpi;
  labelsAcross: number; // yan yana etiket sayısı (1 = tek etiket)
  horizontalGapMm: number; // etiketler arası yatay boşluk (mm)
}

export interface LabelPreset {
  name: string;
  widthMm: number;
  heightMm: number;
}

export const LABEL_PRESETS: LabelPreset[] = [
  { name: '100 x 100 mm', widthMm: 100, heightMm: 100 },
  { name: '100 x 150 mm (4x6in Kargo)', widthMm: 100, heightMm: 150 },
  { name: '58 x 40 mm (Ürün Etiketi)', widthMm: 58, heightMm: 40 },
  { name: '101.6 x 50.8 mm (4x2in)', widthMm: 101.6, heightMm: 50.8 },
  { name: '76 x 51 mm (3x2in)', widthMm: 76, heightMm: 51 },
  { name: '50 x 30 mm', widthMm: 50, heightMm: 30 },
];

export type ElementType =
  | 'text'
  | 'shape'
  | 'image'
  | 'icon'
  | 'barcode'
  | 'qr';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  rotation: Rotation;
  zIndex: number;
  name?: string;
}

export type BuiltInFont =
  | '0' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize: number; // mm yaklaşık yükseklik (dot'a çevrilir)
  fontRef: string; // built-in font kodu (0,A..H) veya customFont id
  isCustomFont: boolean;
  align: 'left' | 'center' | 'right';
  letterSpacing?: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rectangle' | 'line';
  thicknessMm: number;
  color: 'black' | 'white';
  cornerRounding: number; // 0-8
}

export interface ImageElement extends BaseElement {
  type: 'image';
  originalDataUrl: string; // önizleme için
  threshold: number; // 0-255 monokrom eşik
  invert?: boolean;
  lockAspectRatio?: boolean; // en-boy oranı kilitli mi
}

export interface IconElement extends BaseElement {
  type: 'icon';
  iconId: string; // lib/icons içindeki id
  threshold: number;
  invert?: boolean;
}

export type BarcodeSymbology = 'CODE128' | 'EAN13' | 'EAN8' | 'UPC';

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  symbology: BarcodeSymbology;
  data: string;
  moduleWidth: number; // dot
  ratio: number; // wide/narrow ratio (2.0-3.0)
  showText: boolean;
}

export interface QrElement extends BaseElement {
  type: 'qr';
  data: string;
  magnification: number; // 1-10
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export type LabelElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | IconElement
  | BarcodeElement
  | QrElement;

export type FontFileType = 'TTF' | 'OTF' | 'FNT';
export type PrinterDrive = 'R' | 'E' | 'B';

export interface CustomFont {
  id: string;
  originalFileName: string;
  fileType: FontFileType;
  drive: PrinterDrive;
  targetName: string; // örn: "21942699.FNT" ya da "MYFONT.TTF" (kullanıcı düzenleyebilir)
  fileBytesBase64: string; // ham font verisi (base64)
  fontFamilyCss?: string; // FontFace ile kayıt edilen isim (TTF/OTF için)
}

export const MAX_CUSTOM_FONTS = 5;

export interface ProjectFile {
  version: 1;
  labelSettings: LabelSettings;
  elements: LabelElement[];
  customFonts: CustomFont[];
}
