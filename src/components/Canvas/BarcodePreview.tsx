import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { getBarcodeMeta, drawPlaceholderBarcode } from '../../lib/barcodeSymbologies';
import type { BarcodeSymbology } from '../../types';

interface Props {
  data: string;
  symbology: BarcodeSymbology;
  showText: boolean;
  moduleWidth: number;
}

// Okunabilir metin (interpretation line) şeridi için sabit ekran yüksekliği (px).
// ZPL'de barkod yüksekliği (^BY/^BC 'h' parametresi) SADECE çubukları etkiler; okunabilir
// metin yazıcıda çubukların ALTINA sabit boyutta basılır ve bu yükseklikten bağımsızdır.
const TEXT_STRIP_PX = 16;

export default function BarcodePreview({ data, symbology, showText, moduleWidth }: Props) {
  const barsCanvasRef = useRef<HTMLCanvasElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const barsCanvas = barsCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    if (!barsCanvas) return;
    const meta = getBarcodeMeta(symbology);
    if (meta.previewable && meta.jsBarcodeFormat) {
      try {
        // Çubuklar HER ZAMAN metinsiz, sabit bir referans yükseklikte (60) render edilir.
        // Bu canvas kutunun tam genişlik/yüksekliğine esnetilir -- yani kutu büyütülüp
        // küçültülünce SADECE çubuklar uzar/kısalır, gerçek baskıdaki davranışla aynı.
        JsBarcode(barsCanvas, data || '0', {
          format: meta.jsBarcodeFormat,
          displayValue: false,
          width: Math.max(1, moduleWidth),
          height: 60,
          margin: 4,
        });

        if (showText && textCanvas) {
          // Okunabilir metnin doğru biçimlendirmesini (EAN/UPC özel hane grupları vb.) elde
          // etmek için AYNI ayarlarla bir de metinli render alıp, çubuk bölgesinin altında
          // kalan kısmı (yalnızca metin) kırpıp ayrı, sabit yükseklikli bir şeride çiziyoruz.
          const off = document.createElement('canvas');
          JsBarcode(off, data || '0', {
            format: meta.jsBarcodeFormat,
            displayValue: true,
            width: Math.max(1, moduleWidth),
            height: 60,
            margin: 4,
            fontSize: 14,
          });
          const textRegionHeight = Math.max(1, off.height - barsCanvas.height);
          textCanvas.width = off.width;
          textCanvas.height = textRegionHeight;
          const tctx = textCanvas.getContext('2d');
          if (tctx) {
            tctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
            tctx.drawImage(
              off,
              0,
              barsCanvas.height,
              off.width,
              textRegionHeight,
              0,
              0,
              off.width,
              textRegionHeight,
            );
          }
        } else if (textCanvas) {
          textCanvas.width = 0;
          textCanvas.height = 0;
        }
        return;
      } catch {
        // jsbarcode veri formatını kabul etmedi, aşağıdaki yer tutucuya düş
      }
    }
    const w = 220;
    const h = 100;
    barsCanvas.width = w;
    barsCanvas.height = h;
    const ctx = barsCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      drawPlaceholderBarcode(ctx, 0, 0, w, h, meta.label, data);
    }
    if (textCanvas) {
      textCanvas.width = 0;
      textCanvas.height = 0;
    }
  }, [data, symbology, showText, moduleWidth]);

  // ZPL'de barkodun genişliği (modül sayısı x modül genişliği) ve yüksekliği (dot) birbirinden
  // tamamen bağımsız iki eksendir (aralarında sabit bir en-boy oranı yoktur). Bu yüzden burada
  // 'contain' KULLANILMAZ (o, en-boy oranını korurdu ve kutunun bir kısmını boş bırakırdı);
  // çubuk canvası kutunun tam genişlik/yüksekliğine bağımsız olarak esnetilir. Metin şeridi
  // ise kutunun ALTINA, sabit yükseklikte (kutu boyutundan etkilenmeden) yerleştirilir.
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={barsCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {showText && (
        <canvas
          ref={textCanvasRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            height: TEXT_STRIP_PX,
            display: 'block',
          }}
        />
      )}
    </div>
  );
}
