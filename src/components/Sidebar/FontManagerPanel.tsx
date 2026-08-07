import { useState } from 'react';
import { Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useLabelStore, nextId } from '../../state/useLabelStore';
import type { CustomFont, FontFileType, PrinterDrive } from '../../types';
import { MAX_CUSTOM_FONTS } from '../../types';
import { defaultTargetName, bytesToBase64, drivePrefixLabel } from '../../lib/fontToZpl';
import { ensureFontFaceLoaded, getFontFamilyName } from '../../lib/zplInterpreter';

function detectFileType(fileName: string): FontFileType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.ttf')) return 'TTF';
  if (lower.endsWith('.otf')) return 'OTF';
  if (lower.endsWith('.fnt')) return 'FNT';
  return null;
}

export default function FontManagerPanel() {
  const { customFonts, addCustomFont, updateCustomFont, removeCustomFont } = useLabelStore();
  const [error, setError] = useState<string | null>(null);
  const [, forceRerender] = useState(0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (customFonts.length >= MAX_CUSTOM_FONTS) {
      setError(`En fazla ${MAX_CUSTOM_FONTS} özel font eklenebilir.`);
      return;
    }
    const fileType = detectFileType(file.name);
    if (!fileType) {
      setError('Sadece .ttf, .otf veya .fnt dosyaları yüklenebilir.');
      return;
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const font: CustomFont = {
      id: nextId('font'),
      originalFileName: file.name,
      fileType,
      drive: 'R',
      targetName: defaultTargetName(fileType, bytes),
      fileBytesBase64: bytesToBase64(bytes),
    };
    const result = addCustomFont(font);
    if (!result.ok) {
      setError(result.message || 'Font eklenemedi.');
      return;
    }
    if (fileType !== 'FNT') {
      await ensureFontFaceLoaded(font);
      forceRerender((n) => n + 1);
    }
  };

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Özel Fontlar</h3>
        <span className="text-[10px] text-gray-500">
          {customFonts.length}/{MAX_CUSTOM_FONTS}
        </span>
      </div>

      <label className="flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-md py-3 cursor-pointer hover:bg-white/5 text-xs text-gray-300">
        <Upload size={14} />
        TTF / OTF / FNT Yükle
        <input type="file" accept=".ttf,.otf,.fnt" className="hidden" onChange={handleUpload} />
      </label>

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/10 rounded px-2 py-1">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {customFonts.map((font) => (
          <FontRow key={font.id} font={font} onUpdate={updateCustomFont} onRemove={removeCustomFont} />
        ))}
      </div>
    </div>
  );
}

function FontRow({
  font,
  onUpdate,
  onRemove,
}: {
  font: CustomFont;
  onUpdate: (id: string, patch: Partial<CustomFont>) => void;
  onRemove: (id: string) => void;
}) {
  const familyName = getFontFamilyName(font.id);
  return (
    <div className="bg-white/5 rounded-md p-2 flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="truncate text-gray-200" title={font.originalFileName}>
          {font.originalFileName}
        </span>
        <button onClick={() => onRemove(font.id)} className="p-1 hover:bg-red-500/20 rounded text-red-400">
          <Trash2 size={12} />
        </button>
      </div>

      {font.fileType === 'FNT' ? (
        <div className="text-[11px] text-amber-400">Bu font türü önizlemede tam gösterilemez.</div>
      ) : familyName ? (
        <div className="bg-white rounded px-2 py-1 text-black" style={{ fontFamily: `"${familyName}"`, fontSize: 14 }}>
          Örnek Metin Aa Bb Çç Ğğ İ ş 123
        </div>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-gray-400">Bellek Adı (ör: 21942699.FNT)</span>
        <input
          value={font.targetName}
          onChange={(e) => onUpdate(font.id, { targetName: e.target.value })}
          className="w-full bg-[#0f1115] border border-white/10 rounded px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-gray-400">Yazıcı Sürücüsü</span>
        <select
          value={font.drive}
          onChange={(e) => onUpdate(font.id, { drive: e.target.value as PrinterDrive })}
          className="w-full bg-[#0f1115] border border-white/10 rounded px-2 py-1"
        >
          <option value="R">{drivePrefixLabel('R')}</option>
          <option value="E">{drivePrefixLabel('E')}</option>
          <option value="B">{drivePrefixLabel('B')}</option>
        </select>
      </label>
    </div>
  );
}
