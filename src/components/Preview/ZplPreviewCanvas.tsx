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
const RENDER_SUPERSAMPLE = 3; // renderZplToCanvas içindeki kalite ölçeği

export default function ZplPreviewCanvas({ zpl, dpi, customFonts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const result = await renderZplToCanvas(zpl, canvas, dpi, customFonts, RENDER_SUPERSAMPLE);
      if (cancelled) return;
      setWarnings(result.warnings);
      setNaturalSize({ width: canvas.width, height: canvas.height });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [zpl, dpi, customFonts]);

  const clampZoom = (z: number) => Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) * 100) / 100;
  const zoomIn = () => setZoom((z) => clampZoom(z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => clampZoom(z - ZOOM_STEP));
  const resetZoom = () => setZoom(1);

  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => clampZoom(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
  };

  // 100% zoom = 1 baskı noktası (dot) ≈ 1 CSS pikseli (gerçek boyuta yakın önizleme)
  const displayWidth = naturalSize.width ? (naturalSize.width / RENDER_SUPERSAMPLE) * zoom : undefined;
  const displayHeight = naturalSize.height ? (naturalSize.height / RENDER_SUPERSAMPLE) * zoom : undefined;

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
      <div
        className="flex-1 overflow-auto bg-[#0b0d11] p-8"
        onWheel={handleWheel}
        style={{ display: 'flex', justifyContent: 'safe center', alignItems: 'safe center' }}
      >
        <canvas
          ref={canvasRef}
          className="bg-white shadow-2xl shrink-0"
          style={{
            imageRendering: 'pixelated',
            width: displayWidth,
            height: displayHeight,
          }}
        />
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
