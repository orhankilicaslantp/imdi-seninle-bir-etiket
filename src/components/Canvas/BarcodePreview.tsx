import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface Props {
  data: string;
  symbology: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC';
  showText: boolean;
  moduleWidth: number;
}

export default function BarcodePreview({ data, symbology, showText, moduleWidth }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      JsBarcode(canvas, data || '0', {
        format: symbology,
        displayValue: showText,
        width: Math.max(1, moduleWidth),
        height: 60,
        margin: 4,
        fontSize: 14,
      });
    } catch {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;
        canvas.height = 60;
        ctx.clearRect(0, 0, 200, 60);
        ctx.fillStyle = '#c0392b';
        ctx.font = '11px sans-serif';
        ctx.fillText('Geçersiz barkod verisi', 4, 30);
      }
    }
  }, [data, symbology, showText, moduleWidth]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}
