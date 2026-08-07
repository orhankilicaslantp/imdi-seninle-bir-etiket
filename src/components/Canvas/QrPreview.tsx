import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface Props {
  data: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export default function QrPreview({ data, errorCorrection }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, data || ' ', {
      errorCorrectionLevel: errorCorrection,
      margin: 0,
      scale: 6,
    }).catch(() => {});
  }, [data, errorCorrection]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}
