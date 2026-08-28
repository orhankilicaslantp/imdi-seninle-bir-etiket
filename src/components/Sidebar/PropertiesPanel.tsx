import { useLabelStore } from '../../state/useLabelStore';
import type { AlignMode } from '../../state/useLabelStore';
import type { BarcodeElement, IconElement, ImageElement, QrElement, Rotation, ShapeElement, TextElement } from '../../types';
import {
  Trash2,
  Copy,
  ArrowUpToLine,
  ArrowDownToLine,
  Lock,
  Unlock,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import { BARCODE_SYMBOLOGIES, CATEGORY_LABELS, getBarcodeMeta } from '../../lib/barcodeSymbologies';
import { MIN_MODULE_WIDTH_DOTS, MAX_MODULE_WIDTH_DOTS } from '../../lib/barcodeSize';

const BUILTIN_FONTS = ['0', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function PropertiesPanel() {
  const {
    elements,
    selectedId,
    selectedIds,
    updateElement,
    finalizeQrSize,
    finalizeBarcodeSize,
    removeElement,
    duplicateElement,
    removeSelected,
    duplicateSelected,
    alignSelected,
    bringToFront,
    sendToBack,
    customFonts,
    pushHistory,
  } = useLabelStore();
  const el = elements.find((e) => e.id === selectedId);
  const multiSelectCount = selectedIds.length;

  if (multiSelectCount === 0 && !el) {
    return <div className="p-4 text-sm text-gray-500">Düzenlemek için bir eleman seçin.</div>;
  }

  if (multiSelectCount > 1) {
    return (
      <div className="p-3 flex flex-col gap-3 text-xs text-gray-200 overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-gray-100">{multiSelectCount} eleman seçili</span>
          <div className="flex gap-1">
            <button title="Kopyala (çoğalt)" onClick={duplicateSelected} className="p-1 hover:bg-white/10 rounded">
              <Copy size={14} />
            </button>
            <button title="Sil" onClick={removeSelected} className="p-1 hover:bg-red-500/20 rounded text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <AlignToolbar onAlign={alignSelected} distributeEnabled={multiSelectCount >= 3} />
        <p className="text-[11px] text-gray-500">
          Ctrl/Cmd+C kopyala, Ctrl/Cmd+V yapıştır, Ctrl/Cmd+D çoğalt, Delete sil.
        </p>
      </div>
    );
  }

  if (!el) {
    return <div className="p-4 text-sm text-gray-500">Düzenlemek için bir eleman seçin.</div>;
  }

  const commit = (patch: Record<string, unknown>, opts?: { skipSizeNormalize?: boolean }) => {
    updateElement(el.id, patch, opts);
  };
  const commitAndSave = (patch: Record<string, unknown>) => {
    updateElement(el.id, patch);
    pushHistory();
  };

  return (
    <div className="p-3 flex flex-col gap-3 text-xs text-gray-200 overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-gray-100">{labelForType(el.type)}</span>
        <div className="flex gap-1">
          <button title="Öne al" onClick={() => bringToFront(el.id)} className="p-1 hover:bg-white/10 rounded">
            <ArrowUpToLine size={14} />
          </button>
          <button title="Arkaya gönder" onClick={() => sendToBack(el.id)} className="p-1 hover:bg-white/10 rounded">
            <ArrowDownToLine size={14} />
          </button>
          <button title="Kopyala" onClick={() => duplicateElement(el.id)} className="p-1 hover:bg-white/10 rounded">
            <Copy size={14} />
          </button>
          <button title="Sil" onClick={() => removeElement(el.id)} className="p-1 hover:bg-red-500/20 rounded text-red-400">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <AlignToolbar onAlign={alignSelected} distributeEnabled={false} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="X (mm)">
          <input type="number" value={round(el.x)} onChange={(e) => commit({ x: num(e) })} onBlur={() => pushHistory()} className={inputCls} />
        </Field>
        <Field label="Y (mm)">
          <input type="number" value={round(el.y)} onChange={(e) => commit({ y: num(e) })} onBlur={() => pushHistory()} className={inputCls} />
        </Field>
        <Field label="Genişlik (mm)">
          <input
            type="number"
            value={round(el.width)}
            onChange={(e) => {
              const width = num(e);
              if (el.type === 'image' && el.lockAspectRatio) {
                const ratio = el.width / el.height;
                commit({ width, height: ratio ? width / ratio : el.height });
              } else if (el.type === 'qr') {
                // QR gerçek boyutu modül sayısı x büyütme ile sabitlenir; yazarken
                // her tuş vuruşunda anlık kilitleme yapmayıp sadece onBlur'da en yakın
                // geçerli büyütmeye (1-10) kilitliyoruz.
                commit({ width, height: width }, { skipSizeNormalize: true });
              } else if (el.type === 'barcode') {
                // Barkod gerçek genişliği modül sayısı x modül genişliği (dot) ile
                // sabitlenir; yazarken anlık kilitleme yapmayıp onBlur'da en yakın
                // geçerli modül genişliğine (1-10 dot) kilitliyoruz.
                commit({ width }, { skipSizeNormalize: true });
              } else {
                commit({ width });
              }
            }}
            onBlur={() => {
              if (el.type === 'qr') finalizeQrSize(el.id);
              if (el.type === 'barcode') finalizeBarcodeSize(el.id);
              pushHistory();
            }}
            className={inputCls}
          />
        </Field>
        <Field label="Yükseklik (mm)">
          <input
            type="number"
            value={round(el.height)}
            onChange={(e) => {
              const height = num(e);
              if (el.type === 'image' && el.lockAspectRatio) {
                const ratio = el.width / el.height;
                commit({ height, width: ratio ? height * ratio : el.width });
              } else if (el.type === 'qr') {
                commit({ width: height, height }, { skipSizeNormalize: true });
              } else {
                commit({ height });
              }
            }}
            onBlur={() => {
              if (el.type === 'qr') finalizeQrSize(el.id);
              pushHistory();
            }}
            className={inputCls}
          />
        </Field>
        <Field label="Döndürme">
          <select value={el.rotation} onChange={(e) => commitAndSave({ rotation: parseInt(e.target.value, 10) as Rotation })} className={inputCls}>
            <option value={0}>0°</option>
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </Field>
      </div>

      {el.type === 'text' && <TextProps el={el as TextElement} commit={commit} commitAndSave={commitAndSave} customFonts={customFonts} />}
      {el.type === 'shape' && <ShapeProps el={el as ShapeElement} commit={commit} commitAndSave={commitAndSave} />}
      {el.type === 'image' && <ImageProps el={el as ImageElement} commit={commit} commitAndSave={commitAndSave} />}
      {el.type === 'icon' && <IconProps el={el as IconElement} commit={commit} commitAndSave={commitAndSave} />}
      {el.type === 'barcode' && <BarcodeProps el={el as BarcodeElement} commit={commit} commitAndSave={commitAndSave} />}
      {el.type === 'qr' && <QrProps el={el as QrElement} commit={commit} commitAndSave={commitAndSave} />}
    </div>
  );
}

const inputCls = 'w-full bg-[#0f1115] border border-white/10 rounded px-2 py-1 text-xs';

function AlignToolbar({
  onAlign,
  distributeEnabled,
}: {
  onAlign: (mode: AlignMode) => void;
  distributeEnabled: boolean;
}) {
  const btn = 'p-1.5 hover:bg-white/10 rounded text-gray-300';
  return (
    <div className="flex flex-col gap-1 border-t border-b border-white/10 py-2">
      <span className="text-gray-400">Hizala</span>
      <div className="flex items-center gap-1">
        <button title="Sola hizala" onClick={() => onAlign('left')} className={btn}>
          <AlignHorizontalJustifyStart size={15} />
        </button>
        <button title="Yatayda ortala" onClick={() => onAlign('centerH')} className={btn}>
          <AlignHorizontalJustifyCenter size={15} />
        </button>
        <button title="Sağa hizala" onClick={() => onAlign('right')} className={btn}>
          <AlignHorizontalJustifyEnd size={15} />
        </button>
        <div className="w-px h-4 bg-white/10 mx-0.5" />
        <button title="Üste hizala" onClick={() => onAlign('top')} className={btn}>
          <AlignVerticalJustifyStart size={15} />
        </button>
        <button title="Dikeyde ortala" onClick={() => onAlign('centerV')} className={btn}>
          <AlignVerticalJustifyCenter size={15} />
        </button>
        <button title="Alta hizala" onClick={() => onAlign('bottom')} className={btn}>
          <AlignVerticalJustifyEnd size={15} />
        </button>
        {distributeEnabled && (
          <>
            <div className="w-px h-4 bg-white/10 mx-0.5" />
            <button title="Yatayda dağıt" onClick={() => onAlign('distributeH')} className={btn}>
              <AlignHorizontalDistributeCenter size={15} />
            </button>
            <button title="Dikeyde dağıt" onClick={() => onAlign('distributeV')} className={btn}>
              <AlignVerticalDistributeCenter size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function num(e: React.ChangeEvent<HTMLInputElement>): number {
  return parseFloat(e.target.value) || 0;
}
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function labelForType(t: string): string {
  const map: Record<string, string> = {
    text: 'Metin',
    shape: 'Şekil',
    image: 'Resim',
    icon: 'İkon',
    barcode: 'Barkod',
    qr: 'QR Kod',
  };
  return map[t] || t;
}

function TextProps({
  el,
  commit,
  commitAndSave,
  customFonts,
}: {
  el: TextElement;
  commit: (p: Record<string, unknown>) => void;
  commitAndSave: (p: Record<string, unknown>) => void;
  customFonts: ReturnType<typeof useLabelStore.getState>['customFonts'];
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
      <Field label="Metin">
        <textarea value={el.text} onChange={(e) => commit({ text: e.target.value })} onBlur={() => commitAndSave({})} className={inputCls} rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Font Boyutu (mm)">
          <input type="number" value={el.fontSize} onChange={(e) => commit({ fontSize: num(e) })} onBlur={() => commitAndSave({})} className={inputCls} />
        </Field>
        <Field label="Hizalama">
          <select value={el.align} onChange={(e) => commitAndSave({ align: e.target.value })} className={inputCls}>
            <option value="left">Sol</option>
            <option value="center">Orta</option>
            <option value="right">Sağ</option>
          </select>
        </Field>
      </div>
      <Field label="Font">
        <select
          value={el.isCustomFont ? `custom:${el.fontRef}` : `builtin:${el.fontRef}`}
          onChange={(e) => {
            const [kind, id] = e.target.value.split(':');
            commitAndSave({ isCustomFont: kind === 'custom', fontRef: id });
          }}
          className={inputCls}
        >
          <optgroup label="Yerleşik Fontlar">
            {BUILTIN_FONTS.map((f) => (
              <option key={f} value={`builtin:${f}`}>
                Font {f}
              </option>
            ))}
          </optgroup>
          {customFonts.length > 0 && (
            <optgroup label="Özel Fontlar">
              {customFonts.map((f) => (
                <option key={f.id} value={`custom:${f.id}`}>
                  {f.originalFileName} ({f.targetName})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>
    </div>
  );
}

function ShapeProps({
  el,
  commit,
  commitAndSave,
}: {
  el: ShapeElement;
  commit: (p: Record<string, unknown>) => void;
  commitAndSave: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
      <Field label="Şekil Türü">
        <select value={el.shape} onChange={(e) => commitAndSave({ shape: e.target.value })} className={inputCls}>
          <option value="rectangle">Dikdörtgen</option>
          <option value="line">Çizgi</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kalınlık (mm)">
          <input type="number" value={el.thicknessMm} onChange={(e) => commit({ thicknessMm: num(e) })} onBlur={() => commitAndSave({})} className={inputCls} />
        </Field>
        <Field label="Renk">
          <select value={el.color} onChange={(e) => commitAndSave({ color: e.target.value })} className={inputCls}>
            <option value="black">Siyah</option>
            <option value="white">Beyaz</option>
          </select>
        </Field>
      </div>
      {el.shape === 'line' && (
        <Field label="Yön">
          <select
            value={el.height > el.width ? 'vertical' : 'horizontal'}
            onChange={(e) => {
              const wantVertical = e.target.value === 'vertical';
              const isVertical = el.height > el.width;
              if (wantVertical !== isVertical) {
                commitAndSave({ width: el.height, height: el.width });
              }
            }}
            className={inputCls}
          >
            <option value="horizontal">Yatay</option>
            <option value="vertical">Dikey</option>
          </select>
        </Field>
      )}
      {el.shape === 'rectangle' && (
        <Field label="Köşe Yuvarlama (0-8)">
          <input
            type="number"
            min={0}
            max={8}
            value={el.cornerRounding}
            onChange={(e) => commit({ cornerRounding: num(e) })}
            onBlur={() => commitAndSave({})}
            className={inputCls}
          />
        </Field>
      )}
    </div>
  );
}

function ImageProps({
  el,
  commit,
  commitAndSave,
}: {
  el: ImageElement;
  commit: (p: Record<string, unknown>) => void;
  commitAndSave: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
      <img src={el.originalDataUrl} alt="" className="max-h-24 object-contain bg-white rounded" />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={el.lockAspectRatio ?? true}
          onChange={(e) => commitAndSave({ lockAspectRatio: e.target.checked })}
        />
        {el.lockAspectRatio ?? true ? <Lock size={12} /> : <Unlock size={12} />}
        <span>En-Boy Oranını Kilitle</span>
      </label>
      <Field label={`Eşik Değeri (${el.threshold})`}>
        <input type="range" min={0} max={255} value={el.threshold} onChange={(e) => commit({ threshold: num(e) })} onMouseUp={() => commitAndSave({})} className="w-full" />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!el.invert} onChange={(e) => commitAndSave({ invert: e.target.checked })} />
        <span>Renkleri Ters Çevir</span>
      </label>
    </div>
  );
}

function IconProps({
  el,
  commit,
  commitAndSave,
}: {
  el: IconElement;
  commit: (p: Record<string, unknown>) => void;
  commitAndSave: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
      <Field label={`Eşik Değeri (${el.threshold})`}>
        <input type="range" min={0} max={255} value={el.threshold} onChange={(e) => commit({ threshold: num(e) })} onMouseUp={() => commitAndSave({})} className="w-full" />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!el.invert} onChange={(e) => commitAndSave({ invert: e.target.checked })} />
        <span>Renkleri Ters Çevir</span>
      </label>
    </div>
  );
}

function BarcodeProps({
  el,
  commit,
  commitAndSave,
}: {
  el: BarcodeElement;
  commit: (p: Record<string, unknown>) => void;
  commitAndSave: (p: Record<string, unknown>) => void;
}) {
  const meta = getBarcodeMeta(el.symbology);
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
      <Field label="Barkod Türü">
        <select value={el.symbology} onChange={(e) => commitAndSave({ symbology: e.target.value })} className={inputCls}>
          {(['1d-standart', '1d-endustriyel', '2d'] as const).map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
              {BARCODE_SYMBOLOGIES.filter((m) => m.category === cat).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      {!meta.previewable && (
        <p className="text-[11px] text-amber-400">
          Bu barkod türünün deseni yazıcı tarafından üretilir; burada yaklaşık bir önizleme gösterilir, ZPL çıktısı doğru üretilir.
        </p>
      )}
      <Field label="Veri">
        <input value={el.data} onChange={(e) => commit({ data: e.target.value })} onBlur={() => commitAndSave({})} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Modül Genişliği (dot)">
          <input
            type="number"
            min={MIN_MODULE_WIDTH_DOTS}
            max={MAX_MODULE_WIDTH_DOTS}
            value={el.moduleWidth}
            onChange={(e) => commit({ moduleWidth: num(e) })}
            onBlur={() => commitAndSave({})}
            className={inputCls}
          />
        </Field>
        <Field label="Oran">
          <input type="number" value={el.ratio} onChange={(e) => commit({ ratio: num(e) })} onBlur={() => commitAndSave({})} className={inputCls} />
        </Field>
      </div>
      <p className="text-[11px] text-gray-500">
        Genişlik (mm) gerçek baskıda modül sayısı x Modül Genişliği (dot, {MIN_MODULE_WIDTH_DOTS}-{MAX_MODULE_WIDTH_DOTS}) olarak
        oluşur. Bu ikisi birbirine kilitlidir: genişliği sürükleyip/yazınca modül genişliği otomatik güncellenir (ve tersi) --
        böylece önizleme her zaman gerçek ZPL çıktısıyla eşleşir.
      </p>
      {meta.supportsShowText && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={el.showText} onChange={(e) => commitAndSave({ showText: e.target.checked })} />
          <span>Okunabilir Metni Göster</span>
        </label>
      )}
    </div>
  );
}

function QrProps({
  el,
  commit,
  commitAndSave,
}: {
  el: QrElement;
  commit: (p: Record<string, unknown>) => void;
  commitAndSave: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
      <Field label="Veri">
        <input value={el.data} onChange={(e) => commit({ data: e.target.value })} onBlur={() => commitAndSave({})} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Büyütme">
          <input type="number" min={1} value={el.magnification} onChange={(e) => commit({ magnification: num(e) })} onBlur={() => commitAndSave({})} className={inputCls} />
        </Field>
        <Field label="Hata Düzeltme">
          <select value={el.errorCorrection} onChange={(e) => commitAndSave({ errorCorrection: e.target.value })} className={inputCls}>
            <option value="L">L (~7%)</option>
            <option value="M">M (~15%)</option>
            <option value="Q">Q (~25%)</option>
            <option value="H">H (~30%)</option>
          </select>
        </Field>
      </div>
      {el.magnification > 10 && (
        <p className="text-[11px] text-amber-400">
          10 üzeri büyütmede QR, ^BQ yerine bitmap (^GFA) olarak gömülür; boyut sınırsız büyüyebilir.
        </p>
      )}
    </div>
  );
}
