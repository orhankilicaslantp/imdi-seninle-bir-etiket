import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLabelStore } from '../state/useLabelStore';
import { parseZplToElements } from '../lib/zplToElements';
import type { Dpi } from '../types';

interface Props {
  onClose: () => void;
}

/** Hazır bir ZPL kodunu yapıştırıp bu sistemin element modeline (metin, şekil, barkod, QR,
 * resim) çevirip tasarıma aktarmayı sağlayan modal. Ayrıştırma sonucu (kaç öğe bulundu,
 * hangi komutlar atlandı) uygulanmadan önce kullanıcıya özetlenir. */
export default function ImportZplModal({ onClose }: Props) {
  const { labelSettings, elements, importFromZpl } = useLabelStore();
  const [code, setCode] = useState('');
  const [dpi, setDpi] = useState<Dpi>(labelSettings.dpi);
  const [result, setResult] = useState<ReturnType<typeof parseZplToElements> | null>(null);

  const handleParse = () => {
    if (!code.trim()) return;
    setResult(parseZplToElements(code, dpi, useLabelStore.getState().customFonts));
  };

  const handleApply = () => {
    if (!result) return;
    if (
      elements.length > 0 &&
      !confirm('Mevcut tasarımdaki tüm öğeler silinip yerine ZPL kodundan oluşturulan öğeler gelecek. Onaylıyor musunuz?')
    ) {
      return;
    }
    importFromZpl(result.elements, {
      dpi,
      ...(result.widthMm ? { widthMm: result.widthMm } : {}),
      ...(result.heightMm ? { heightMm: result.heightMm } : {}),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <div className="bg-[#15171c] border border-white/10 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-gray-100">ZPL Kodunu İçe Aktar</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs text-gray-300">
          <p className="text-gray-400">
            Yazıcınızdan veya başka bir programdan aldığınız hazır ZPL II kodunu buraya yapıştırın.
            Metin, şekil, barkod, QR kod ve gömülü resim/ikon (^GFA) öğeleri tanınıp düzenlenebilir
            hâle getirilir; desteklenmeyen komutlar atlanır ve aşağıda listelenir.
          </p>

          <textarea
            value={code}
            onChange={(e) => { setCode(e.target.value); setResult(null); }}
            placeholder={'^XA\n^FO50,50^A0N,30,30^FDÖrnek^FS\n^XZ'}
            className="w-full h-40 bg-[#0b0d11] border border-white/10 rounded px-3 py-2 font-mono text-[11px] text-green-300 resize-none outline-none"
            spellCheck={false}
          />

          <div className="flex items-center gap-3">
            <label className="text-gray-400">Bu koddaki DPI</label>
            <select
              value={dpi}
              onChange={(e) => { setDpi(parseInt(e.target.value, 10) as Dpi); setResult(null); }}
              className="bg-[#0f1115] border border-white/10 rounded px-2 py-1"
            >
              <option value={203}>203 dpi</option>
              <option value={300}>300 dpi</option>
              <option value={600}>600 dpi</option>
            </select>
            <span className="text-gray-500">
              ZPL koordinatları dot cinsindendir; doğru mm ölçüsü için kodu üreten yazıcının DPI'sini seçin.
            </span>
          </div>

          <button
            onClick={handleParse}
            disabled={!code.trim()}
            className="self-start px-3 py-1.5 bg-indigo-500/30 hover:bg-indigo-500/40 rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Kodu Analiz Et
          </button>

          {result && (
            <div className="border border-white/10 rounded p-3 bg-[#0f1115] flex flex-col gap-2">
              <div className="text-gray-200">
                <strong>{result.elements.length}</strong> öğe bulundu
                {result.widthMm && result.heightMm
                  ? ` — etiket boyutu ~${result.widthMm.toFixed(1)} x ${result.heightMm.toFixed(1)} mm olarak ayarlanacak`
                  : ''}
                .
              </div>
              {result.elements.length > 0 && (
                <div className="flex flex-wrap gap-2 text-gray-400">
                  {Object.entries(countByType(result.elements)).map(([type, count]) => (
                    <span key={type} className="px-2 py-0.5 bg-white/5 rounded">
                      {typeLabel(type)}: {count}
                    </span>
                  ))}
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-amber-400">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          <button onClick={onClose} className="px-3 py-1.5 text-gray-300 hover:text-gray-100">
            Vazgeç
          </button>
          <button
            onClick={handleApply}
            disabled={!result || result.elements.length === 0}
            className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tasarıma Uygula
          </button>
        </div>
      </div>
    </div>
  );
}

function countByType(elements: { type: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const el of elements) out[el.type] = (out[el.type] || 0) + 1;
  return out;
}

function typeLabel(type: string): string {
  switch (type) {
    case 'text': return 'Metin';
    case 'shape': return 'Şekil';
    case 'image': return 'Resim';
    case 'icon': return 'İkon';
    case 'barcode': return 'Barkod';
    case 'qr': return 'QR Kod';
    default: return type;
  }
}
