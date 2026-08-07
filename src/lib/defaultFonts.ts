import type { CustomFont } from '../types';
import { bytesToBase64 } from './fontToZpl';

export const DEFAULT_FONT_ID = 'default-font-21942699';

/**
 * Uygulamayla birlikte gelen standart özel font (public/fonts altında bundle edilir).
 * Kullanıcının kendi yazıcılarına önceden yüklediği font ile aynı bellek adını (21942699.TTF)
 * kullanarak referans üretmek için varsayılan olarak font listesine eklenir.
 */
export async function loadBundledDefaultFont(): Promise<CustomFont | null> {
  try {
    const response = await fetch('/fonts/21942699.TTF');
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return {
      id: DEFAULT_FONT_ID,
      originalFileName: '21942699.TTF',
      fileType: 'TTF',
      drive: 'R',
      targetName: '21942699.TTF',
      fileBytesBase64: bytesToBase64(bytes),
    };
  } catch {
    return null;
  }
}
