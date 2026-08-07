import { Rnd } from 'react-rnd';
import { useLabelStore } from '../../state/useLabelStore';
import type { MonoBitmap } from '../../lib/imageToZpl';
import ElementRenderer from './ElementRenderer';

interface Props {
  pxPerMm: number;
  bitmaps: Record<string, MonoBitmap>;
}

export default function DesignCanvas({ pxPerMm, bitmaps }: Props) {
  const { labelSettings, elements, selectedId, select, updateElement, pushHistory } = useLabelStore();
  const widthPx = labelSettings.widthMm * pxPerMm;
  const heightPx = labelSettings.heightMm * pxPerMm;

  return (
    <div className="inline-block bg-white/5 p-6 rounded-lg">
      <div
        className="relative bg-white shadow-2xl"
        style={{ width: widthPx, height: heightPx }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) select(null);
        }}
      >
        {[...elements]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((el) => (
            <Rnd
              key={el.id}
              size={{ width: el.width * pxPerMm, height: el.height * pxPerMm }}
              position={{ x: el.x * pxPerMm, y: el.y * pxPerMm }}
              bounds="parent"
              lockAspectRatio={el.type === 'image' && el.lockAspectRatio ? el.width / el.height : false}
              onDragStart={() => select(el.id)}
              onDragStop={(_, d) => {
                updateElement(el.id, { x: d.x / pxPerMm, y: d.y / pxPerMm });
                pushHistory();
              }}
              onResizeStop={(_, __, ref, ___, position) => {
                updateElement(el.id, {
                  width: ref.offsetWidth / pxPerMm,
                  height: ref.offsetHeight / pxPerMm,
                  x: position.x / pxPerMm,
                  y: position.y / pxPerMm,
                });
                pushHistory();
              }}
              style={{
                outline: selectedId === el.id ? '2px solid #6366f1' : '1px dashed rgba(0,0,0,0.15)',
                transform: `rotate(${el.rotation}deg)`,
                zIndex: el.zIndex,
              }}
              onClick={() => select(el.id)}
            >
              <ElementRenderer element={el} bitmap={bitmaps[el.id]} pxPerMm={pxPerMm} />
            </Rnd>
          ))}
      </div>
    </div>
  );
}
