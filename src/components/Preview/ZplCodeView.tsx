import { useState } from 'react';
import { Copy, Download, Check } from 'lucide-react';

interface Props {
  zpl: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

export default function ZplCodeView({ zpl, editable, onChange }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(zpl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([zpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'etiket.zpl';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-white/10">
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs px-2 py-1 bg-white/10 rounded hover:bg-white/20">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
        <button onClick={handleDownload} className="flex items-center gap-1 text-xs px-2 py-1 bg-white/10 rounded hover:bg-white/20">
          <Download size={12} />
          .zpl indir
        </button>
      </div>
      <textarea
        value={zpl}
        readOnly={!editable}
        onChange={(e) => onChange?.(e.target.value)}
        className="flex-1 w-full bg-[#0b0d11] text-[11px] font-mono text-green-300 p-3 resize-none outline-none"
        spellCheck={false}
      />
    </div>
  );
}
