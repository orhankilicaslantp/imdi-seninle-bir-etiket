import { useRef } from 'react';
import {
  Type,
  Square,
  Image as ImageIcon,
  Barcode,
  QrCode,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useLabelStore, createDefaultText, createDefaultShape, createDefaultImage, createDefaultBarcode, createDefaultQr } from '../../state/useLabelStore';

export default function Toolbar() {
  const { addElement, undo, redo, labelSettings } = useLabelStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxSide = 100; // mm - standart varsayılan boyut
        const ratio = img.naturalWidth / img.naturalHeight || 1;
        const width = ratio >= 1 ? maxSide : maxSide * ratio;
        const height = ratio >= 1 ? maxSide / ratio : maxSide;
        addElement(createDefaultImage(10, 10, dataUrl, width, height));
      };
      img.onerror = () => addElement(createDefaultImage(10, 10, dataUrl));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const btnClass =
    'flex flex-col items-center gap-1 px-3 py-2 rounded-md hover:bg-white/10 text-xs text-gray-200 transition-colors';

  return (
    <div className="flex flex-wrap gap-1 p-2 bg-[#1a1c22] border-b border-white/10">
      <button className={btnClass} onClick={() => addElement(createDefaultText(10, 10))}>
        <Type size={18} />
        Metin
      </button>
      <button className={btnClass} onClick={() => addElement(createDefaultShape(10, 10))}>
        <Square size={18} />
        Şekil
      </button>
      <button className={btnClass} onClick={() => fileInputRef.current?.click()}>
        <ImageIcon size={18} />
        Resim
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <button className={btnClass} onClick={() => addElement(createDefaultBarcode(10, 10))}>
        <Barcode size={18} />
        Barkod
      </button>
      <button className={btnClass} onClick={() => addElement(createDefaultQr(10, 10, labelSettings.dpi))}>
        <QrCode size={18} />
        QR Kod
      </button>
      <div className="w-px bg-white/10 mx-1" />
      <button className={btnClass} onClick={undo} title="Geri Al">
        <Undo2 size={18} />
        Geri Al
      </button>
      <button className={btnClass} onClick={redo} title="Yinele">
        <Redo2 size={18} />
        Yinele
      </button>
    </div>
  );
}
