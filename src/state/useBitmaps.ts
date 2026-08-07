import { useEffect, useState } from 'react';
import type { CustomFont, LabelElement } from '../types';
import { mmToDots } from '../lib/units';
import { imageDataUrlToMonoBitmap, svgStringToMonoBitmap, type MonoBitmap } from '../lib/imageToZpl';
import { getIconById } from '../lib/icons/logisticsIcons';
import type { Dpi } from '../types';

export function useBitmaps(elements: LabelElement[], dpi: Dpi): Record<string, MonoBitmap> {
  const [bitmaps, setBitmaps] = useState<Record<string, MonoBitmap>>({});

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const result: Record<string, MonoBitmap> = {};
      for (const el of elements) {
        if (el.type === 'image') {
          const widthPx = mmToDots(el.width, dpi);
          const heightPx = mmToDots(el.height, dpi);
          try {
            result[el.id] = await imageDataUrlToMonoBitmap(
              el.originalDataUrl,
              widthPx,
              heightPx,
              el.threshold,
              el.invert,
            );
          } catch {
            // ignore
          }
        } else if (el.type === 'icon') {
          const icon = getIconById(el.iconId);
          if (icon) {
            const widthPx = mmToDots(el.width, dpi);
            const heightPx = mmToDots(el.height, dpi);
            try {
              result[el.id] = await svgStringToMonoBitmap(
                icon.svg,
                widthPx,
                heightPx,
                el.threshold,
                el.invert,
              );
            } catch {
              // ignore
            }
          }
        }
      }
      if (!cancelled) setBitmaps(result);
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(elements.map((e) => ({ ...e }))), dpi]);

  return bitmaps;
}

export function unusedCustomFontsCheck(customFonts: CustomFont[]): CustomFont[] {
  return customFonts;
}
