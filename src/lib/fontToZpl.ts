import type { CustomFont, FontFileType, PrinterDrive } from '../types';

/** Dosya baytlarından basit, deterministik 8 haneli sayısal bir isim üretir (aynı içerik = aynı isim). */
export function generateFontHashName(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
  }
  const unsigned = h1 >>> 0;
  // 8 haneli sayısal koda indir
  const numeric = (unsigned % 100000000).toString().padStart(8, '0');
  return numeric;
}

export function defaultTargetName(fileType: FontFileType, bytes: Uint8Array): string {
  const hash = generateFontHashName(bytes);
  const ext = fileType; // TTF | OTF | FNT
  return `${hash}.${ext}`;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function bytesToAsciiHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

/** ~DY font indirme komutu (x: T=TrueType/OpenType, B=Zebra bitmap font .FNT) */
function extensionTypeCode(fileType: FontFileType): 'T' | 'B' {
  return fileType === 'FNT' ? 'B' : 'T';
}

export function generateFontDownloadZpl(font: CustomFont): string {
  const bytes = base64ToBytes(font.fileBytesBase64);
  const hex = bytesToAsciiHex(bytes);
  const x = extensionTypeCode(font.fileType);
  return `~DY${font.drive}:${font.targetName},A,${x},${bytes.length},,${hex}`;
}

/** ^A@ ile özel font referansı. R: sürücüsü varsayılan olduğu için önekle belirtilmez. */
export function fontLocator(font: CustomFont): string {
  return font.drive === 'R' ? font.targetName : `${font.drive}:${font.targetName}`;
}

export function generateFontRefZpl(
  font: CustomFont,
  heightDots: number,
  widthDots: number,
  orientation: 'N' | 'R' | 'I' | 'B' = 'N',
): string {
  return `^A@${orientation},${heightDots},${widthDots},${fontLocator(font)}`;
}

export function drivePrefixLabel(drive: PrinterDrive): string {
  switch (drive) {
    case 'R': return 'R: (RAM - Geçici)';
    case 'E': return 'E: (Flash - Kalıcı)';
    case 'B': return 'B: (Flash - Kalıcı)';
  }
}
