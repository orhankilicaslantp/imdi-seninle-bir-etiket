import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { renderZplToCanvas } from '../../lib/zplInterpreter';
import type { CustomFont, Dpi } from '../../types';

interface Props {
  zpl: string;
  dpi: Dpi;
  customFonts: CustomFont[];
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export default function ZplPreviewCanvas({ zpl, dpi, customFonts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);

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

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  const zoomIn = () => setZoom((z) => clampZoom(Math.round((z + ZOOM_STEP) * 100) / 100));
  const zoomOut = () => setZoom((z) => clampZoom(Math.round((z - ZOOM_STEP) * 100) / 100));
  const resetZoom = () => setZoom(1);

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => clampZoom(Math.round((z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)) * 100) / 100));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-white/10 text-xs text-gray-300">
        <button onClick={zoomOut} className="p-1.5 bg-white/10 rounded hover:bg-white/20" title="Uzaklaştır">
          <ZoomOut size={14} />
        </button>
        <span className="w-12 text-center select-none">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className="p-1.5 bg-white/10 rounded hover:bg-white/20" title="Yakınlaştır">
          <ZoomIn size={14} />
        </button>
        <button onClick={resetZoom} className="p-1.5 bg-white/10 rounded hover:bg-white/20" title="Sıfırla (%100)">
          <RotateCcw size={14} />
        </button>
        <span className="text-gray-500">Ctrl/Cmd + scroll ile de yakınlaştırabilirsiniz</span>
      </div>
      <div className="flex-1 overflow-auto bg-[#0b0d11] p-6" onWheel={handleWheel}>
        <div className="flex items-center justify-center min-h-full min-w-full">
          <canvas
            ref={canvasRef}
            className="bg-white shadow-2xl"
            style={{
              imageRendering: 'pixelated',
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
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
