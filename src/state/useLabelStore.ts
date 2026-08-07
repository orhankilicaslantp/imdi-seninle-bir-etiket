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

let idCounter = 1;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

interface HistoryEntry {
  elements: LabelElement[];
}

interface LabelStore {
  labelSettings: LabelSettings;
  elements: LabelElement[];
  customFonts: CustomFont[];
  selectedId: string | null;
  history: HistoryEntry[];
  historyIndex: number;

  setLabelSettings: (settings: Partial<LabelSettings>) => void;
  addElement: (el: LabelElement) => void;
  updateElement: (id: string, patch: Partial<LabelElement>) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  select: (id: string | null) => void;
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
}

const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  widthMm: 100,
  heightMm: 150,
  dpi: 203,
};

export const useLabelStore = create<LabelStore>((set, get) => ({
  labelSettings: DEFAULT_LABEL_SETTINGS,
  elements: [],
  customFonts: [],
  selectedId: null,
  history: [{ elements: [] }],
  historyIndex: 0,

  setLabelSettings: (settings) =>
    set((s) => ({ labelSettings: { ...s.labelSettings, ...settings } })),

  addElement: (el) => {
    set((s) => ({ elements: [...s.elements, el], selectedId: el.id }));
    get().pushHistory();
  },

  updateElement: (id, patch) => {
    set((s) => ({
      elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as LabelElement) : e)),
    }));
  },

  removeElement: (id) => {
    set((s) => ({
      elements: s.elements.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
    get().pushHistory();
  },

  duplicateElement: (id) => {
    const el = get().elements.find((e) => e.id === id);
    if (!el) return;
    const copy: LabelElement = { ...el, id: nextId(el.type), x: el.x + 3, y: el.y + 3 };
    set((s) => ({ elements: [...s.elements, copy], selectedId: copy.id }));
    get().pushHistory();
  },

  select: (id) => set({ selectedId: id }),

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
    set({ elements: history[newIndex].elements, historyIndex: newIndex });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({ elements: history[newIndex].elements, historyIndex: newIndex });
  },

  loadProject: (project) => {
    set({
      labelSettings: project.labelSettings,
      elements: project.elements,
      customFonts: project.customFonts,
      selectedId: null,
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
      history: [{ elements: [] }],
      historyIndex: 0,
    });
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

export function createDefaultImage(x: number, y: number, dataUrl: string): ImageElement {
  return {
    id: nextId('image'),
    type: 'image',
    x,
    y,
    width: 30,
    height: 30,
    rotation: 0,
    zIndex: 1,
    originalDataUrl: dataUrl,
    threshold: 128,
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

export function createDefaultBarcode(x: number, y: number): BarcodeElement {
  return {
    id: nextId('barcode'),
    type: 'barcode',
    x,
    y,
    width: 50,
    height: 20,
    rotation: 0,
    zIndex: 1,
    symbology: 'CODE128',
    data: '123456789012',
    moduleWidth: 2,
    ratio: 3,
    showText: true,
  };
}

export function createDefaultQr(x: number, y: number): QrElement {
  return {
    id: nextId('qr'),
    type: 'qr',
    x,
    y,
    width: 20,
    height: 20,
    rotation: 0,
    zIndex: 1,
    data: 'https://example.com',
    magnification: 4,
    errorCorrection: 'Q',
  };
}
