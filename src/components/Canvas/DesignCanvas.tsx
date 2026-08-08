import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { useLabelStore } from '../../state/useLabelStore';
import type { MonoBitmap } from '../../lib/imageToZpl';
import type { LabelElement } from '../../types';
import { computeSnap, type SnapGuides } from '../../lib/snapping';
import ElementRenderer from './ElementRenderer';

interface Props {
  pxPerMm: number;
  bitmaps: Record<string, MonoBitmap>;
}

const SNAP_THRESHOLD_PX = 6;

export default function DesignCanvas({ pxPerMm, bitmaps }: Props) {
  const {
    labelSettings,
    elements,
    selectedIds,
    select,
    toggleSelect,
    setSelection,
    updateElement,
    setPositions,
    pushHistory,
    finalizeQrSize,
    finalizeBarcodeSize,
  } = useLabelStore();
  const widthPx = labelSettings.widthMm * pxPerMm;
  const heightPx = labelSettings.heightMm * pxPerMm;
  const gapPx = (labelSettings.horizontalGapMm || 0) * pxPerMm;
  const copiesCount = Math.max(1, labelSettings.labelsAcross || 1);
  const extraCopies = copiesCount - 1;
  const thresholdMm = SNAP_THRESHOLD_PX / pxPerMm;

  const [guides, setGuides] = useState<SnapGuides | null>(null);
  // Sürükleme başında grup halindeki elemanların ilk konumlarını (mm) saklar.
  const dragOriginRef = useRef<{ draggedId: string; positions: Record<string, { x: number; y: number }> } | null>(
    null,
  );

  // Mouse ile alan seçimi (rubber-band / marquee selection)
  const labelRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeStateRef = useRef<{
    startX: number;
    startY: number;
    additive: boolean;
    prevSelectedIds: string[];
  } | null>(null);

  const handleCanvasMouseDown = (e: ReactMouseEvent) => {
    if (e.target !== e.currentTarget) return; // Sadece boş alana basılırsa marquee başlat
    const rect = labelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    marqueeStateRef.current = { startX, startY, additive, prevSelectedIds: selectedIds };
    setMarquee({ x: startX, y: startY, w: 0, h: 0 });

    const handleMove = (ev: globalThis.MouseEvent) => {
      const state = marqueeStateRef.current;
      const r = labelRef.current?.getBoundingClientRect();
      if (!state || !r) return;
      const curX = ev.clientX - r.left;
      const curY = ev.clientY - r.top;
      setMarquee({
        x: Math.min(state.startX, curX),
        y: Math.min(state.startY, curY),
        w: Math.abs(curX - state.startX),
        h: Math.abs(curY - state.startY),
      });
    };

    const handleUp = (ev: globalThis.MouseEvent) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      const state = marqueeStateRef.current;
      const r = labelRef.current?.getBoundingClientRect();
      marqueeStateRef.current = null;
      setMarquee(null);
      if (!state || !r) return;
      const curX = ev.clientX - r.left;
      const curY = ev.clientY - r.top;
      const selX = Math.min(state.startX, curX);
      const selY = Math.min(state.startY, curY);
      const selW = Math.abs(curX - state.startX);
      const selH = Math.abs(curY - state.startY);

      if (selW < 4 && selH < 4) {
        // Gerçek sürükleme olmadı, basit bir tıklama: boş alana tıklanınca seçimi temizle.
        if (!state.additive) select(null);
        return;
      }

      const selXmm = selX / pxPerMm;
      const selYmm = selY / pxPerMm;
      const selWmm = selW / pxPerMm;
      const selHmm = selH / pxPerMm;

      const containedIds = elements
        .filter(
          (el) =>
            el.x >= selXmm &&
            el.y >= selYmm &&
            el.x + el.width <= selXmm + selWmm &&
            el.y + el.height <= selYmm + selHmm,
        )
        .map((el) => el.id);

      const nextIds = state.additive
        ? Array.from(new Set([...state.prevSelectedIds, ...containedIds]))
        : containedIds;
      setSelection(nextIds);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleDragStart = (el: LabelElement, e: unknown) => {
    const evt = e as { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } | undefined;
    const hasModifier = !!(evt?.shiftKey || evt?.ctrlKey || evt?.metaKey);
    const isPartOfSelection = selectedIds.includes(el.id);
    const groupIds = isPartOfSelection && selectedIds.length > 1 ? selectedIds : [el.id];
    // Shift/Ctrl ile tıklanıyorsa seçim değişikliğini onClick'e (toggleSelect) bırak;
    // aksi halde burada seçim değiştirilirse onClick'teki toggle mantığı elemanı hemen
    // seçimden çıkarır (çünkü seçim zaten burada eklenmiş olur).
    if (!isPartOfSelection && !hasModifier) select(el.id);
    const positions: Record<string, { x: number; y: number }> = {};
    for (const id of groupIds) {
      const e2 = elements.find((x) => x.id === id);
      if (e2) positions[id] = { x: e2.x, y: e2.y };
    }
    dragOriginRef.current = { draggedId: el.id, positions };
  };

  const handleDrag = (el: LabelElement, xPx: number, yPx: number) => {
    const origin = dragOriginRef.current;
    if (!origin) return;
    const originPos = origin.positions[el.id];
    if (!originPos) return;

    const rawX = xPx / pxPerMm;
    const rawY = yPx / pxPerMm;
    const groupIds = Object.keys(origin.positions);
    const others = elements.filter((e) => !groupIds.includes(e.id));

    const snap = computeSnap(
      { x: rawX, y: rawY, width: el.width, height: el.height },
      others,
      { widthMm: labelSettings.widthMm, heightMm: labelSettings.heightMm },
      thresholdMm,
    );

    const dx = snap.x - originPos.x;
    const dy = snap.y - originPos.y;

    const updates = groupIds.map((id) => {
      const p = origin.positions[id];
      return { id, x: p.x + dx, y: p.y + dy };
    });
    setPositions(updates);
    setGuides(snap.guides);
  };

  const handleDragStop = () => {
    dragOriginRef.current = null;
    setGuides(null);
    pushHistory();
  };

  const handleElementClick = (e: ReactMouseEvent, elId: string) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      toggleSelect(elId);
    } else {
      select(elId);
    }
  };

  return (
    <div className="inline-block bg-white/5 p-6 rounded-lg">
      <div className="flex items-start" style={{ gap: gapPx }}>
        <div
          ref={labelRef}
          className="relative bg-white shadow-2xl"
          style={{ width: widthPx, height: heightPx }}
          onMouseDown={handleCanvasMouseDown}
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
                onDragStart={(e) => handleDragStart(el, e)}
                onDrag={(_, d) => handleDrag(el, d.x, d.y)}
                onDragStop={(_, d) => {
                  updateElement(el.id, { x: d.x / pxPerMm, y: d.y / pxPerMm });
                  handleDragStop();
                }}
                onResizeStop={(_, __, ref, ___, position) => {
                  updateElement(el.id, {
                    width: ref.offsetWidth / pxPerMm,
                    height: ref.offsetHeight / pxPerMm,
                    x: position.x / pxPerMm,
                    y: position.y / pxPerMm,
                  });
                  if (el.type === 'qr') finalizeQrSize(el.id);
                  if (el.type === 'barcode') finalizeBarcodeSize(el.id);
                  pushHistory();
                }}
                style={{
                  outline: selectedIds.includes(el.id) ? '2px solid #6366f1' : '1px dashed rgba(0,0,0,0.15)',
                  transform: `rotate(${el.rotation}deg)`,
                  zIndex: el.zIndex,
                }}
                onClick={(e: ReactMouseEvent) => handleElementClick(e, el.id)}
              >
                <ElementRenderer element={el} bitmap={bitmaps[el.id]} pxPerMm={pxPerMm} />
              </Rnd>
            ))}

          {guides?.vertical.map((xMm, i) => (
            <div
              key={`v-${i}`}
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: xMm * pxPerMm, width: 0, borderLeft: '1px solid #ec4899', zIndex: 9999 }}
            />
          ))}
          {guides?.horizontal.map((yMm, i) => (
            <div
              key={`h-${i}`}
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: yMm * pxPerMm, height: 0, borderTop: '1px solid #ec4899', zIndex: 9999 }}
            />
          ))}

          {marquee && (
            <div
              className="absolute pointer-events-none border border-indigo-500 bg-indigo-500/10"
              style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, zIndex: 10000 }}
            />
          )}
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
