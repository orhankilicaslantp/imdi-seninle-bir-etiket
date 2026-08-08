import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, FilePlus, FolderOpen, Tag } from 'lucide-react';
import { useLabelStore } from './state/useLabelStore';
import { useBitmaps } from './state/useBitmaps';
import Toolbar from './components/Toolbar/Toolbar';
import LabelSettingsPanel from './components/LabelSettingsPanel';
import DesignCanvas from './components/Canvas/DesignCanvas';
import PropertiesPanel from './components/Sidebar/PropertiesPanel';
import IconLibraryPanel from './components/Sidebar/IconLibraryPanel';
import FontManagerPanel from './components/Sidebar/FontManagerPanel';
import ZplCodeView from './components/Preview/ZplCodeView';
import ZplPreviewCanvas from './components/Preview/ZplPreviewCanvas';
import { generateLabelZpl } from './lib/zplGenerator';
import { ensureFontFaceLoaded } from './lib/zplInterpreter';
import { loadBundledDefaultFont, DEFAULT_FONT_ID } from './lib/defaultFonts';
import { MAX_CUSTOM_FONTS } from './types';
import type { ProjectFile } from './types';

async function ensureDefaultFont() {
  const state = useLabelStore.getState();
  if (state.customFonts.some((f) => f.id === DEFAULT_FONT_ID)) return;
  if (state.customFonts.length >= MAX_CUSTOM_FONTS) return;
  const font = await loadBundledDefaultFont();
  if (!font) return;
  const result = state.addCustomFont(font);
  if (result.ok) await ensureFontFaceLoaded(font);
}

type RightTab = 'properties' | 'code';
type LeftTab = 'elements' | 'icons' | 'fonts';
type CenterTab = 'design' | 'preview';

function App() {
  const { labelSettings, elements, customFonts, removeSelected, loadProject, exportProject, resetProject } =
    useLabelStore();
  const bitmaps = useBitmaps(elements, labelSettings.dpi);
  const [rightTab, setRightTab] = useState<RightTab>('properties');
  const [leftTab, setLeftTab] = useState<LeftTab>('elements');
  const [centerTab, setCenterTab] = useState<CenterTab>('design');
  const [manualZpl, setManualZpl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pxPerMm = 3.5;

  const generatedZpl = useMemo(
    () => generateLabelZpl(elements, { labelSettings, customFonts, bitmaps }),
    [elements, labelSettings, customFonts, bitmaps],
  );

  const activeZpl = manualZpl ?? generatedZpl;

  // Uygulama açılışında standart (bundle edilmiş) özel fontu font listesine ekle
  useEffect(() => {
    ensureDefaultFont();
  }, []);

  // Klavye kısayolları: Del/Backspace ile sil, Ctrl/Cmd+C/V ile kopyala-yapıştır,
  // Ctrl/Cmd+D ile çoğalt, Ctrl/Cmd+A ile tümünü seç (bir input/textarea alanında
  // yazı yazılırken devre dışı).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditableTarget =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditableTarget) return;

      const store = useLabelStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (store.selectedIds.length || store.selectedId) {
          e.preventDefault();
          removeSelected();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        store.copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        store.pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        store.duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        store.selectAll();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeSelected]);

  const handleNew = () => {
    if (confirm('Yeni bir tasarıma başlanacak, mevcut çalışma kaybolacak. Onaylıyor musunuz?')) {
      resetProject();
      setManualZpl(null);
      ensureDefaultFont();
    }
  };

  const handleSaveJson = () => {
    const project = exportProject();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'etiket-projesi.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = JSON.parse(reader.result as string) as ProjectFile;
        loadProject(project);
        setManualZpl(null);
      } catch {
        alert('Proje dosyası okunamadı. Geçerli bir JSON dosyası seçin.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-2 bg-[#15171c] border-b border-white/10">
        <div className="flex items-center gap-2 text-gray-100 font-semibold">
          <Tag size={18} className="text-indigo-400" />
          ZPL Etiket Tasarımcı
        </div>
        <div className="flex items-center gap-2">
          <HeaderButton icon={<FilePlus size={14} />} label="Yeni" onClick={handleNew} />
          <HeaderButton icon={<FileDown size={14} />} label="Projeyi Kaydet (.json)" onClick={handleSaveJson} />
          <HeaderButton icon={<FolderOpen size={14} />} label="Projeyi Yükle" onClick={() => fileInputRef.current?.click()} />
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleLoadJson} />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 bg-[#15171c] border-r border-white/10 flex flex-col min-h-0">
          <div className="flex border-b border-white/10">
            <LeftTabButton active={leftTab === 'elements'} onClick={() => setLeftTab('elements')} label="Eleman" />
            <LeftTabButton active={leftTab === 'icons'} onClick={() => setLeftTab('icons')} label="İkonlar" />
            <LeftTabButton active={leftTab === 'fonts'} onClick={() => setLeftTab('fonts')} label="Fontlar" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {leftTab === 'elements' && (
              <div className="p-3 text-xs text-gray-400">
                Üst araç çubuğundan eleman ekleyin, ya da İkonlar / Fontlar sekmelerini kullanın.
              </div>
            )}
            {leftTab === 'icons' && <IconLibraryPanel />}
            {leftTab === 'fonts' && <FontManagerPanel />}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col min-h-0 bg-[#0f1115]">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/10 bg-[#15171c]">
            <CenterTabButton active={centerTab === 'design'} onClick={() => setCenterTab('design')} label="Tasarım" />
            <CenterTabButton active={centerTab === 'preview'} onClick={() => setCenterTab('preview')} label="Önizleme" />
          </div>
          {centerTab === 'design' ? (
            <>
              <Toolbar />
              <LabelSettingsPanel />
              <div className="flex-1 overflow-auto flex items-start justify-center p-6">
                <DesignCanvas pxPerMm={pxPerMm} bitmaps={bitmaps} />
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
              <ZplPreviewCanvas zpl={activeZpl} dpi={labelSettings.dpi} customFonts={customFonts} />
            </div>
          )}
        </main>

        <aside className="w-[420px] shrink-0 bg-[#15171c] border-l border-white/10 flex flex-col min-h-0">
          <div className="flex border-b border-white/10">
            <RightTabButton active={rightTab === 'properties'} onClick={() => setRightTab('properties')} label="Özellikler" />
            <RightTabButton active={rightTab === 'code'} onClick={() => setRightTab('code')} label="ZPL Kodu" />
          </div>
          <div className="flex-1 min-h-0">
            {rightTab === 'properties' && <PropertiesPanel />}
            {rightTab === 'code' && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-2 pt-2 text-[11px] text-gray-400">
                  {manualZpl === null ? (
                    <button
                      className="px-2 py-1 bg-white/10 rounded hover:bg-white/20"
                      onClick={() => setManualZpl(generatedZpl)}
                    >
                      Kod Moduna Geç (elle düzenle)
                    </button>
                  ) : (
                    <button
                      className="px-2 py-1 bg-indigo-500/30 rounded hover:bg-indigo-500/40"
                      onClick={() => setManualZpl(null)}
                    >
                      Otomatik Moda Dön
                    </button>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  <ZplCodeView
                    zpl={activeZpl}
                    editable={manualZpl !== null}
                    onChange={(v) => setManualZpl(v)}
                  />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function HeaderButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-gray-200">
      {icon}
      {label}
    </button>
  );
}

function LeftTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs py-2 ${active ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
    >
      {label}
    </button>
  );
}

function CenterTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium ${
        active ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );
}

function RightTabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs py-2 ${active ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
    >
      {label}
    </button>
  );
}

export default App;
