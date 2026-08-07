import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { renderZplToCanvas } from '../../lib/zplInterpreter';
import type { CustomFont, Dpi } from '../../types';

interface Props {
  zpl: string;
  dpi: Dpi;
  customFonts: CustomFont[];
}

export default function ZplPreviewCanvas({ zpl, dpi, customFonts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const result = await renderZplToCanvas(zpl, canvas, dpi, customFonts, 3);
      if (!cancelled) setWarnings(result.warnings);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [zpl, dpi, customFonts]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex-1 flex items-center justify-center p-4 bg-[#0b0d11]">
        <canvas ref={canvasRef} className="bg-white shadow-2xl max-w-full" style={{ imageRendering: 'pixelated' }} />
      </div>
      {warnings.length > 0 && (
        <div className="p-2 border-t border-white/10 bg-amber-500/5 max-h-28 overflow-y-auto">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-amber-400 py-0.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
