import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { AlertTriangle } from 'lucide-react';
import { useLabelStore } from '../../state/useLabelStore';
import type { LabelElement, CustomFont, Dpi } from '../../types';
import { computeSnap, type SnapGuides } from '../../lib/snapping';
import { renderZplToCanvas } from '../../lib/zplInterpreter';
import { mmToDots } from '../../lib/units';

interface Props {
  pxPerMm: number;
  zpl: string;
  dpi: Dpi;
  customFonts: CustomFont[];
}

const SNAP_THRESHOLD_PX = 6;
const RENDER_SUPERSAMPLE = 2;
const RENDER_DEBOUNCE_MS = 16;

export default function DesignCanvas({ pxPerMm, zpl, dpi, customFonts }: Props) {
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
  const totalWidthPx = copiesCount * widthPx + (copiesCount - 1) * gapPx;
  const thresholdMm = SNAP_THRESHOLD_PX / pxPerMm;

  // Tasarım alanı, aynı zamanda gerçek ZPL önizlemesidir: elemanlar değiştikçe üretilen ZPL
  // burada arka plana canlı olarak çizilir (JsBarcode/QRCode/özel font dahil, baskıyla bire bir).
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      // Etiket ebatı ZPL'de yok; önizleme boyutunu uygulama ayarlarından veriyoruz.
      const widthDots = copiesCount * mmToDots(labelSettings.widthMm, dpi) +
        (copiesCount - 1) * mmToDots(labelSettings.horizontalGapMm || 0, dpi);
      const heightDots = mmToDots(labelSettings.heightMm, dpi);
      renderZplToCanvas(zpl, canvas, dpi, customFonts, RENDER_SUPERSAMPLE, { widthDots, heightDots }).then((result) => {
        if (!cancelled) setWarnings(result.warnings);
      });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [zpl, dpi, customFonts, labelSettings.widthMm, labelSettings.heightMm, labelSettings.horizontalGapMm, copiesCount]);

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

  const handleCanvasMouseDown = (e: {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    preventDefault?: () => void;
  }) => {
    // Marquee yalnızca boş arka plan yüzeylerinde başlar (tasarım alanı, önizleme canvas'ı,
    // etrafındaki karanlık görüntü alanı/boşluk). Bir eleman (Rnd) üzerine basıldıysa marquee
    // başlatılmaz -- bu yüzeyler `data-marquee-bg` ile işaretlidir. Böylece seçime tasarımın
    // DIŞINDAN da (etrafındaki boş alandan) başlanabilir.
    if (!(e.target as HTMLElement | null)?.hasAttribute?.('data-marquee-bg')) return;
    const rect = labelRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Sol tık dışındaki tuşları ve metin seçimini engelle.
    e.preventDefault?.();
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

  // Marquee mousedown'unu tasarımı çevreleyen görüntü alanına (viewport) bağla; böylece
  // seçim, etiketin DIŞINDAKI boş alandan da başlatılabilir. Handler her render'da yeniden
  // oluştuğu için (güncel elements/selection closure'ı) listener de her render'da tazelenir.
  useEffect(() => {
    const viewport = labelRef.current?.closest('[data-canvas-viewport]') as HTMLElement | null;
    if (!viewport) return;
    const onDown = (ev: globalThis.MouseEvent) => {
      if (ev.button !== 0) return; // sadece sol tık
      handleCanvasMouseDown(ev);
    };
    viewport.addEventListener('mousedown', onDown);
    return () => viewport.removeEventListener('mousedown', onDown);
  });

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
    <div
      className="inline-block bg-white/5 p-6 rounded-lg"
      data-marquee-bg
    >
      <div className="relative shadow-2xl" style={{ width: totalWidthPx, height: heightPx }} data-marquee-bg>
        {/* Gerçek ZPL önizlemesi: tasarım burada, gerçekte baskıya çıkacak görüntünün aynısıdır. */}
        <canvas
          ref={previewCanvasRef}
          className="absolute top-0 left-0 bg-white"
          style={{ width: totalWidthPx, height: heightPx, imageRendering: 'pixelated' }}
          data-marquee-bg
        />

        {/* Etkileşim katmanı: sadece ilk (düzenlenebilir) etiket kopyasının üstünde. */}
        <div
          ref={labelRef}
          className="absolute top-0 left-0"
          style={{ width: widthPx, height: heightPx }}
          data-marquee-bg
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
                  outline: selectedIds.includes(el.id) ? '2px solid #6366f1' : '1px dashed rgba(99,102,241,0.35)',
                  background: selectedIds.includes(el.id) ? 'rgba(99,102,241,0.06)' : 'transparent',
                  transform: `rotate(${el.rotation}deg)`,
                  zIndex: el.zIndex,
                }}
                onClick={(e: ReactMouseEvent) => handleElementClick(e, el.id)}
              />
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

        {/* Yan yana etiket kopyalarının ayraç çizgileri (gerçek görüntü canvas'ta zaten çiziliyor). */}
        {Array.from({ length: copiesCount - 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 pointer-events-none border-l border-dashed border-black/20"
            style={{ left: (i + 1) * widthPx + i * gapPx + gapPx / 2 }}
          />
        ))}
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 max-w-full">
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
