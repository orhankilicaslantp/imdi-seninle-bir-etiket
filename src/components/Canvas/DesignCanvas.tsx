import { Rnd } from 'react-rnd';
import { useLabelStore } from '../../state/useLabelStore';
import type { MonoBitmap } from '../../lib/imageToZpl';
import type { LabelElement } from '../../types';
import ElementRenderer from './ElementRenderer';

interface Props {
  pxPerMm: number;
  bitmaps: Record<string, MonoBitmap>;
}

export default function DesignCanvas({ pxPerMm, bitmaps }: Props) {
  const { labelSettings, elements, selectedId, select, updateElement, pushHistory } = useLabelStore();
  const widthPx = labelSettings.widthMm * pxPerMm;
  const heightPx = labelSettings.heightMm * pxPerMm;
  const gapPx = (labelSettings.horizontalGapMm || 0) * pxPerMm;
  const copiesCount = Math.max(1, labelSettings.labelsAcross || 1);
  const extraCopies = copiesCount - 1;

  return (
    <div className="inline-block bg-white/5 p-6 rounded-lg">
      <div className="flex items-start" style={{ gap: gapPx }}>
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

        {Array.from({ length: extraCopies }).map((_, copyIndex) => (
          <GhostLabel
            key={copyIndex}
            copyNumber={copyIndex + 2}
            widthPx={widthPx}
            heightPx={heightPx}
            elements={elements}
            bitmaps={bitmaps}
            pxPerMm={pxPerMm}
          />
        ))}
      </div>
    </div>
  );
}

function GhostLabel({
  copyNumber,
  widthPx,
  heightPx,
  elements,
  bitmaps,
  pxPerMm,
}: {
  copyNumber: number;
  widthPx: number;
  heightPx: number;
  elements: LabelElement[];
  bitmaps: Record<string, MonoBitmap>;
  pxPerMm: number;
}) {
  return (
    <div className="relative bg-white shadow-2xl opacity-90" style={{ width: widthPx, height: heightPx }}>
      <div className="absolute -top-5 left-0 text-[10px] text-gray-500">Kopya {copyNumber} (aynı tasarım)</div>
      {[...elements]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((el) => (
          <div
            key={el.id}
            className="absolute pointer-events-none"
            style={{
              left: el.x * pxPerMm,
              top: el.y * pxPerMm,
              width: el.width * pxPerMm,
              height: el.height * pxPerMm,
              transform: `rotate(${el.rotation}deg)`,
              zIndex: el.zIndex,
            }}
          >
            <ElementRenderer element={el} bitmap={bitmaps[el.id]} pxPerMm={pxPerMm} />
          </div>
        ))}
    </div>
  );
}
