import { useLabelStore } from '../state/useLabelStore';
import { LABEL_PRESETS } from '../types';
import type { Dpi } from '../types';

export default function LabelSettingsPanel() {
  const { labelSettings, setLabelSettings } = useLabelStore();

  const selectedPreset =
    LABEL_PRESETS.find(
      (p) => p.widthMm === labelSettings.widthMm && p.heightMm === labelSettings.heightMm,
    )?.name ?? '';

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 bg-[#1a1c22] border-b border-white/10 text-xs text-gray-300">
      <div className="flex flex-col gap-1">
        <label>Hazır Boyut</label>
        <select
          className="bg-[#0f1115] border border-white/10 rounded px-2 py-1"
          value={selectedPreset}
          onChange={(e) => {
            const preset = LABEL_PRESETS.find((p) => p.name === e.target.value);
            if (preset) setLabelSettings({ widthMm: preset.widthMm, heightMm: preset.heightMm });
          }}
        >
          <option value="">Özel</option>
          {LABEL_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label>Genişlik (mm)</label>
        <input
          type="number"
          className="w-20 bg-[#0f1115] border border-white/10 rounded px-2 py-1"
          value={labelSettings.widthMm}
          onChange={(e) => setLabelSettings({ widthMm: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label>Yükseklik (mm)</label>
        <input
          type="number"
          className="w-20 bg-[#0f1115] border border-white/10 rounded px-2 py-1"
          value={labelSettings.heightMm}
          onChange={(e) => setLabelSettings({ heightMm: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label>DPI</label>
        <select
          className="bg-[#0f1115] border border-white/10 rounded px-2 py-1"
          value={labelSettings.dpi}
          onChange={(e) => setLabelSettings({ dpi: parseInt(e.target.value, 10) as Dpi })}
        >
          <option value={203}>203 dpi</option>
          <option value={300}>300 dpi</option>
          <option value={600}>600 dpi</option>
        </select>
      </div>
      <div className="w-px bg-white/10 self-stretch" />
      <div className="flex flex-col gap-1">
        <label>Yan Yana Etiket Sayısı</label>
        <input
          type="number"
          min={1}
          max={10}
          className="w-24 bg-[#0f1115] border border-white/10 rounded px-2 py-1"
          value={labelSettings.labelsAcross}
          onChange={(e) => setLabelSettings({ labelsAcross: Math.max(1, parseInt(e.target.value, 10) || 1) })}
        />
      </div>
      {labelSettings.labelsAcross > 1 && (
        <div className="flex flex-col gap-1">
          <label>Etiketler Arası Boşluk (mm)</label>
          <input
            type="number"
            step={0.1}
            min={0}
            className="w-28 bg-[#0f1115] border border-white/10 rounded px-2 py-1"
            value={labelSettings.horizontalGapMm}
            onChange={(e) => setLabelSettings({ horizontalGapMm: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}
    </div>
  );
}
