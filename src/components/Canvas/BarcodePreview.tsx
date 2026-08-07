import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { getBarcodeMeta, drawPlaceholderBarcode } from '../../lib/barcodeSymbologies';
import type { BarcodeSymbology } from '../../types';

interface Props {
  data: string;
  symbology: BarcodeSymbology;
  showText: boolean;
  moduleWidth: number;
}

export default function BarcodePreview({ data, symbology, showText, moduleWidth }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const meta = getBarcodeMeta(symbology);
    if (meta.previewable && meta.jsBarcodeFormat) {
      try {
        JsBarcode(canvas, data || '0', {
          format: meta.jsBarcodeFormat,
          displayValue: showText,
          width: Math.max(1, moduleWidth),
          height: 60,
          margin: 4,
          fontSize: 14,
        });
        return;
      } catch {
        // jsbarcode veri formatını kabul etmedi, aşağıdaki yer tutucuya düş
      }
    }
    const w = 220;
    const h = 100;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      drawPlaceholderBarcode(ctx, 0, 0, w, h, meta.label, data);
    }
  }, [data, symbology, showText, moduleWidth]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}
