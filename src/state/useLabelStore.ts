import { create } from 'zustand';
import type {
  BarcodeElement,
  CustomFont,
  IconElement,
  ImageElement,
  LabelElement,
  LabelSettings,
  ProjectFile,
  QrElement,
  ShapeElement,
  TextElement,
} from '../types';
import { MAX_CUSTOM_FONTS } from '../types';
import { clampMagnification, getQrModuleCount, qrMagnificationFromMm, qrSizeMm } from '../lib/qrSize';
import {
  barcodeModuleWidthFromMm,
  barcodeWidthMm,
  clampModuleWidth,
  getBarcodeModuleCount,
} from '../lib/barcodeSize';

let idCounter = 1;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

interface HistoryEntry {
  elements: LabelElement[];
}

export type AlignMode =
  | 'left'
  | 'centerH'
  | 'right'
  | 'top'
  | 'centerV'
  | 'bottom'
  | 'distributeH'
  | 'distributeV';

interface LabelStore {
  labelSettings: LabelSettings;
  elements: LabelElement[];
  customFonts: CustomFont[];
  selectedId: string | null;
  selectedIds: string[];
  clipboard: LabelElement[];
  history: HistoryEntry[];
  historyIndex: number;

  setLabelSettings: (settings: Partial<LabelSettings>) => void;
  addElement: (el: LabelElement) => void;
  updateElement: (id: string, patch: Partial<LabelElement>, opts?: { skipSizeNormalize?: boolean }) => void;
  finalizeQrSize: (id: string) => void;
  finalizeBarcodeSize: (id: string) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  select: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  setSelection: (ids: string[]) => void;
  setPositions: (updates: { id: string; x: number; y: number }[]) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  alignSelected: (mode: AlignMode) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  addCustomFont: (font: CustomFont) => { ok: boolean; message?: string };
  updateCustomFont: (id: string, patch: Partial<CustomFont>) => void;
  removeCustomFont: (id: string) => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  loadProject: (project: ProjectFile) => void;
  exportProject: () => ProjectFile;
  resetProject: () => void;
  importFromZpl: (elements: LabelElement[], settings?: Partial<LabelSettings>) => void;
}

const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  widthMm: 100,
  heightMm: 100,
  dpi: 203,
  labelsAcross: 1,
  horizontalGapMm: 0,
};

export const useLabelStore = create<LabelStore>((set, get) => ({
  labelSettings: DEFAULT_LABEL_SETTINGS,
  elements: [],
  customFonts: [],
  selectedId: null,
  selectedIds: [],
  clipboard: [],
  history: [{ elements: [] }],
  historyIndex: 0,

  setLabelSettings: (settings) =>
    set((s) => ({ labelSettings: { ...s.labelSettings, ...settings } })),

  addElement: (el) => {
    set(() => ({ elements: [...get().elements, el], selectedId: el.id, selectedIds: [el.id] }));
    get().pushHistory();
  },

  updateElement: (id, patch, opts) => {
    set((s) => ({
      elements: s.elements.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...patch } as LabelElement;
        if (merged.type === 'qr' && !opts?.skipSizeNormalize) {
          return normalizeQrElement(e as QrElement, merged, s.labelSettings.dpi);
        }
        if (merged.type === 'barcode' && !opts?.skipSizeNormalize) {
          return normalizeBarcodeElement(e as BarcodeElement, merged, s.labelSettings.dpi);
        }
        return merged;
      }),
    }));
  },

  finalizeQrSize: (id) => {
    set((s) => ({
      elements: s.elements.map((e) => {
        if (e.id !== id || e.type !== 'qr') return e;
        const moduleCount = getQrModuleCount(e.data, e.errorCorrection);
        const mag = qrMagnificationFromMm(e.width, moduleCount, s.labelSettings.dpi);
        const size = qrSizeMm(moduleCount, mag, s.labelSettings.dpi);
        return { ...e, magnification: mag, width: size, height: size };
      }),
    }));
  },

  finalizeBarcodeSize: (id) => {
    set((s) => ({
      elements: s.elements.map((e) => {
        if (e.id !== id || e.type !== 'barcode') return e;
        const moduleCount = getBarcodeModuleCount(e.symbology, e.data);
        const mw = barcodeModuleWidthFromMm(e.width, moduleCount, s.labelSettings.dpi);
        const width = barcodeWidthMm(moduleCount, mw, s.labelSettings.dpi);
        return { ...e, moduleWidth: mw, width };
      }),
    }));
  },

  removeElement: (id) => {
    set((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    }));
    get().pushHistory();
  },

  duplicateElement: (id) => {
    const el = get().elements.find((e) => e.id === id);
    if (!el) return;
    const copy: LabelElement = { ...el, id: nextId(el.type), x: el.x + 3, y: el.y + 3 };
    set((s) => ({ elements: [...s.elements, copy], selectedId: copy.id, selectedIds: [copy.id] }));
    get().pushHistory();
  },

  select: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  toggleSelect: (id) => {
    set((s) => {
      const exists = s.selectedIds.includes(id);
      const nextIds = exists ? s.selectedIds.filter((sid) => sid !== id) : [...s.selectedIds, id];
      return { selectedIds: nextIds, selectedId: nextIds.length ? nextIds[nextIds.length - 1] : null };
    });
  },

  setSelection: (ids) => {
    set({ selectedIds: ids, selectedId: ids.length ? ids[ids.length - 1] : null });
  },

  selectAll: () => {
    set((s) => {
      const ids = s.elements.map((e) => e.id);
      return { selectedIds: ids, selectedId: ids.length ? ids[ids.length - 1] : null };
    });
  },

  setPositions: (updates) => {
    set((s) => {
      const map = new Map(updates.map((u) => [u.id, u]));
      return {
        elements: s.elements.map((e) => {
          const u = map.get(e.id);
          return u ? { ...e, x: u.x, y: u.y } : e;
        }),
      };
    });
  },

  removeSelected: () => {
    set((s) => {
      const idsToRemove = new Set(s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : []);
      if (idsToRemove.size === 0) return {};
      return {
        elements: s.elements.filter((e) => !idsToRemove.has(e.id)),
        selectedId: null,
        selectedIds: [],
      };
    });
    get().pushHistory();
  },

  duplicateSelected: () => {
    const s = get();
    const ids = s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const copies = s.elements
      .filter((e) => idSet.has(e.id))
      .map((e) => ({ ...e, id: nextId(e.type), x: e.x + 3, y: e.y + 3 }));
    if (copies.length === 0) return;
    set({
      elements: [...s.elements, ...copies],
      selectedId: copies[copies.length - 1].id,
      selectedIds: copies.map((c) => c.id),
    });
    get().pushHistory();
  },

  copySelection: () => {
    const s = get();
    const ids = s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const copied = s.elements.filter((e) => idSet.has(e.id)).map((e) => ({ ...e }));
    if (copied.length === 0) return;
    set({ clipboard: copied });
  },

  pasteClipboard: () => {
    const s = get();
    if (s.clipboard.length === 0) return;
    const pasted = s.clipboard.map((e) => ({ ...e, id: nextId(e.type), x: e.x + 5, y: e.y + 5 }));
    set({
      elements: [...s.elements, ...pasted],
      selectedId: pasted[pasted.length - 1].id,
      selectedIds: pasted.map((p) => p.id),
    });
    get().pushHistory();
  },

  alignSelected: (mode) => {
    const s = get();
    const ids = s.selectedIds.length ? s.selectedIds : s.selectedId ? [s.selectedId] : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const targets = s.elements.filter((e) => idSet.has(e.id));
    if (targets.length === 0) return;

    // Tek eleman seçiliyken etiketin kendisine göre hizala; birden fazla eleman seçiliyken
    // seçimin sınırlayıcı kutusuna (bounding box) göre hizala.
    let boxMinX: number;
    let boxMaxX: number;
    let boxMinY: number;
    let boxMaxY: number;
    if (targets.length === 1) {
      boxMinX = 0;
      boxMaxX = s.labelSettings.widthMm;
      boxMinY = 0;
      boxMaxY = s.labelSettings.heightMm;
    } else {
      boxMinX = Math.min(...targets.map((e) => e.x));
      boxMaxX = Math.max(...targets.map((e) => e.x + e.width));
      boxMinY = Math.min(...targets.map((e) => e.y));
      boxMaxY = Math.max(...targets.map((e) => e.y + e.height));
    }
    const centerX = (boxMinX + boxMaxX) / 2;
    const centerY = (boxMinY + boxMaxY) / 2;

    let updates: { id: string; x: number; y: number }[] = [];

    if (mode === 'distributeH' || mode === 'distributeV') {
      if (targets.length < 3) return; // dağıtım için en az 3 eleman gerekir
      if (mode === 'distributeH') {
        const sorted = [...targets].sort((a, b) => a.x - b.x);
        const totalWidth = sorted.reduce((sum, e) => sum + e.width, 0);
        const span = boxMaxX - boxMinX - totalWidth;
        const gap = span / (sorted.length - 1);
        let cursor = boxMinX;
        updates = sorted.map((e) => {
          const x = cursor;
          cursor += e.width + gap;
          return { id: e.id, x, y: e.y };
        });
      } else {
        const sorted = [...targets].sort((a, b) => a.y - b.y);
        const totalHeight = sorted.reduce((sum, e) => sum + e.height, 0);
        const span = boxMaxY - boxMinY - totalHeight;
        const gap = span / (sorted.length - 1);
        let cursor = boxMinY;
        updates = sorted.map((e) => {
          const y = cursor;
          cursor += e.height + gap;
          return { id: e.id, x: e.x, y };
        });
      }
    } else {
      updates = targets.map((e) => {
        let x = e.x;
        let y = e.y;
        if (mode === 'left') x = boxMinX;
        else if (mode === 'centerH') x = centerX - e.width / 2;
        else if (mode === 'right') x = boxMaxX - e.width;
        else if (mode === 'top') y = boxMinY;
        else if (mode === 'centerV') y = centerY - e.height / 2;
        else if (mode === 'bottom') y = boxMaxY - e.height;
        return { id: e.id, x, y };
      });
    }

    get().setPositions(updates);
    get().pushHistory();
  },

  bringToFront: (id) => {
    set((s) => {
      const maxZ = Math.max(0, ...s.elements.map((e) => e.zIndex));
      return {
        elements: s.elements.map((e) => (e.id === id ? { ...e, zIndex: maxZ + 1 } : e)),
      };
    });
    get().pushHistory();
  },

  sendToBack: (id) => {
    set((s) => {
      const minZ = Math.min(0, ...s.elements.map((e) => e.zIndex));
      return {
        elements: s.elements.map((e) => (e.id === id ? { ...e, zIndex: minZ - 1 } : e)),
      };
    });
    get().pushHistory();
  },

  addCustomFont: (font) => {
    const current = get().customFonts;
    if (current.length >= MAX_CUSTOM_FONTS) {
      return { ok: false, message: `En fazla ${MAX_CUSTOM_FONTS} özel font eklenebilir.` };
    }
    set((s) => ({ customFonts: [...s.customFonts, font] }));
    return { ok: true };
  },

  updateCustomFont: (id, patch) => {
    set((s) => ({
      customFonts: s.customFonts.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  },

  removeCustomFont: (id) => {
    set((s) => ({ customFonts: s.customFonts.filter((f) => f.id !== id) }));
  },

  pushHistory: () => {
    set((s) => {
      const trimmed = s.history.slice(0, s.historyIndex + 1);
      const next = [...trimmed, { elements: s.elements }];
      return { history: next, historyIndex: next.length - 1 };
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({ elements: history[newIndex].elements, historyIndex: newIndex, selectedId: null, selectedIds: [] });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({ elements: history[newIndex].elements, historyIndex: newIndex, selectedId: null, selectedIds: [] });
  },

  loadProject: (project) => {
    set({
      labelSettings: project.labelSettings,
      elements: project.elements,
      customFonts: project.customFonts,
      selectedId: null,
      selectedIds: [],
      clipboard: [],
      history: [{ elements: project.elements }],
      historyIndex: 0,
    });
  },

  exportProject: () => {
    const s = get();
    return {
      version: 1,
      labelSettings: s.labelSettings,
      elements: s.elements,
      customFonts: s.customFonts,
    };
  },

  resetProject: () => {
    set({
      labelSettings: DEFAULT_LABEL_SETTINGS,
      elements: [],
      customFonts: [],
      selectedId: null,
      selectedIds: [],
      clipboard: [],
      history: [{ elements: [] }],
      historyIndex: 0,
    });
  },

  importFromZpl: (elements, settings) => {
    set((s) => ({
      elements,
      labelSettings: settings ? { ...s.labelSettings, ...settings } : s.labelSettings,
      selectedId: null,
      selectedIds: [],
    }));
    get().pushHistory();
  },
}));

export function createDefaultText(x: number, y: number): TextElement {
  return {
    id: nextId('text'),
    type: 'text',
    x,
    y,
    width: 40,
    height: 8,
    rotation: 0,
    zIndex: 1,
    text: 'Yeni Metin',
    fontSize: 6,
    fontRef: '0',
    isCustomFont: false,
    align: 'left',
  };
}

export function createDefaultShape(x: number, y: number): ShapeElement {
  return {
    id: nextId('shape'),
    type: 'shape',
    x,
    y,
    width: 40,
    height: 20,
    rotation: 0,
    zIndex: 1,
    shape: 'rectangle',
    thicknessMm: 0.5,
    color: 'black',
    cornerRounding: 0,
  };
}

export function createDefaultLine(x: number, y: number): ShapeElement {
  return {
    id: nextId('shape'),
    type: 'shape',
    x,
    y,
    width: 40,
    height: 0.5,
    rotation: 0,
    zIndex: 1,
    shape: 'line',
    thicknessMm: 0.5,
    color: 'black',
    cornerRounding: 0,
  };
}

export function createDefaultImage(
  x: number,
  y: number,
  dataUrl: string,
  width = 100,
  height = 100,
): ImageElement {
  return {
    id: nextId('image'),
    type: 'image',
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex: 1,
    originalDataUrl: dataUrl,
    threshold: 128,
    lockAspectRatio: true,
  };
}

export function createDefaultIcon(x: number, y: number, iconId: string): IconElement {
  return {
    id: nextId('icon'),
    type: 'icon',
    x,
    y,
    width: 20,
    height: 20,
    rotation: 0,
    zIndex: 1,
    iconId,
    threshold: 128,
  };
}

export function createDefaultBarcode(x: number, y: number, dpi = 203): BarcodeElement {
  const symbology = 'CODE128';
  const data = '123456789012';
  const moduleWidth = 2;
  const moduleCount = getBarcodeModuleCount(symbology, data);
  const width = barcodeWidthMm(moduleCount, moduleWidth, dpi);
  return {
    id: nextId('barcode'),
    type: 'barcode',
    x,
    y,
    width,
    height: 20,
    rotation: 0,
    zIndex: 1,
    symbology,
    data,
    moduleWidth,
    ratio: 3,
    showText: true,
  };
}

export function createDefaultQr(x: number, y: number, dpi = 203): QrElement {
  const data = 'https://example.com';
  const errorCorrection = 'Q';
  const magnification = 4;
  const moduleCount = getQrModuleCount(data, errorCorrection);
  const size = qrSizeMm(moduleCount, magnification, dpi);
  return {
    id: nextId('qr'),
    type: 'qr',
    x,
    y,
    width: size,
    height: size,
    rotation: 0,
    zIndex: 1,
    data,
    magnification,
    errorCorrection,
  };
}

/**
 * QR kodunda gerçek boyut = modül sayısı (veri+hata düzeltmesine bağlı) x büyütme (magnification).
 * Bu yüzden genişlik/yükseklik alanları veya sürükle-boyutlandırma ile serbestçe değiştirilemez;
 * her değişiklik en yakın geçerli büyütme (1-10) değerine kilitlenip kare (width=height) olarak
 * yeniden hesaplanır -- böylece tasarım kutusu her zaman gerçek ZPL çıktısıyla eşleşir.
 */
function normalizeQrElement(original: QrElement, merged: QrElement, dpi: number): QrElement {
  const moduleCount = getQrModuleCount(merged.data, merged.errorCorrection);
  const magChanged = merged.magnification !== original.magnification;
  const widthChanged = merged.width !== original.width;
  const heightChanged = merged.height !== original.height;

  if (magChanged) {
    const mag = clampMagnification(merged.magnification);
    const size = qrSizeMm(moduleCount, mag, dpi);
    return { ...merged, magnification: mag, width: size, height: size };
  }
  if (widthChanged || heightChanged) {
    const targetMm = widthChanged ? merged.width : merged.height;
    const mag = qrMagnificationFromMm(targetMm, moduleCount, dpi);
    const size = qrSizeMm(moduleCount, mag, dpi);
    return { ...merged, magnification: mag, width: size, height: size };
  }
  // Veri veya hata düzeltme seviyesi değişmiş olabilir (modül sayısı etkilenir);
  // büyütmeyi sabit tutup kutu boyutunu gerçek boyuta yeniden senkronize et.
  const size = qrSizeMm(moduleCount, merged.magnification, dpi);
  if (Math.abs(size - merged.width) > 0.01 || Math.abs(size - merged.height) > 0.01) {
    return { ...merged, width: size, height: size };
  }
  return merged;
}

/**
 * ZPL barkodunda gerçek genişlik = modül sayısı (veri+sembolojiye bağlı, sabit) x modül genişliği
 * (dot, ^BY ile ayarlanır). Bu yüzden genişlik alanı ile modül genişliği birbirine kilitlidir:
 * genişliği sürükleyip değiştirmek moduleWidth'i (1-10 dot aralığına yuvarlayarak) günceller,
 * moduleWidth'i değiştirmek de gerçek genişliği yeniden hesaplar -- tasarım kutusu ile gerçek
 * ZPL/baskı çıktısı arasında asla uyumsuzluk kalmaz. Yükseklik ise ZPL'de doğrudan dot olarak
 * ayarlanabildiği için bağımsız kalır ve normalize edilmez.
 */
function normalizeBarcodeElement(original: BarcodeElement, merged: BarcodeElement, dpi: number): BarcodeElement {
  const moduleCount = getBarcodeModuleCount(merged.symbology, merged.data);
  const moduleWidthChanged = merged.moduleWidth !== original.moduleWidth;
  const widthChanged = merged.width !== original.width;

  if (moduleWidthChanged) {
    const mw = clampModuleWidth(merged.moduleWidth);
    const width = barcodeWidthMm(moduleCount, mw, dpi);
    return { ...merged, moduleWidth: mw, width };
  }
  if (widthChanged) {
    const mw = barcodeModuleWidthFromMm(merged.width, moduleCount, dpi);
    const width = barcodeWidthMm(moduleCount, mw, dpi);
    return { ...merged, moduleWidth: mw, width };
  }
  // Veri/semboloji değişmiş olabilir (modül sayısı etkilenir); modül genişliğini sabit
  // tutup gerçek genişliği yeniden hesapla.
  const mw = clampModuleWidth(merged.moduleWidth);
  const width = barcodeWidthMm(moduleCount, mw, dpi);
  if (mw !== merged.moduleWidth || Math.abs(width - merged.width) > 0.01) {
    return { ...merged, moduleWidth: mw, width };
  }
  return merged;
}
