import { useEffect, useRef } from 'react';
import type { MonoBitmap } from '../../lib/imageToZpl';

interface Props {
  bitmap?: MonoBitmap;
  width: number;
  height: number;
}

export default function BitmapCanvas({ bitmap, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    if (!bitmap) return;
    const { widthPx, heightPx, bytesPerRow, hexData } = bitmap;
    const imgData = ctx.createImageData(widthPx, heightPx);
    for (let row = 0; row < heightPx; row++) {
      for (let col = 0; col < widthPx; col++) {
        const byteIndex = row * bytesPerRow + (col >> 3);
        const hexPos = byteIndex * 2;
        const byteStr = hexData.substr(hexPos, 2);
        const byteVal = parseInt(byteStr, 16) || 0;
        const bitIndex = 7 - (col % 8);
        const isBlack = (byteVal >> bitIndex) & 1;
        const idx = (row * widthPx + col) * 4;
        if (isBlack) {
          imgData.data[idx] = 0;
          imgData.data[idx + 1] = 0;
          imgData.data[idx + 2] = 0;
          imgData.data[idx + 3] = 255;
        } else {
          imgData.data[idx + 3] = 0;
        }
      }
    }
    const off = document.createElement('canvas');
    off.width = widthPx;
    off.height = heightPx;
    off.getContext('2d')!.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, widthPx, heightPx, 0, 0, width, height);
  }, [bitmap, width, height]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
