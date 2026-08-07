import type { LabelElement } from '../../types';
import type { MonoBitmap } from '../../lib/imageToZpl';
import { getIconById } from '../../lib/icons/logisticsIcons';
import BitmapCanvas from './BitmapCanvas';
import BarcodePreview from './BarcodePreview';
import QrPreview from './QrPreview';

interface Props {
  element: LabelElement;
  bitmap?: MonoBitmap;
  pxPerMm: number;
}

export default function ElementRenderer({ element, bitmap, pxPerMm }: Props) {
  const widthPx = element.width * pxPerMm;
  const heightPx = element.height * pxPerMm;

  switch (element.type) {
    case 'text':
      return (
        <div
          className="w-full h-full flex items-center overflow-hidden select-none"
          style={{
            fontSize: Math.max(6, element.fontSize * pxPerMm),
            justifyContent:
              element.align === 'center' ? 'center' : element.align === 'right' ? 'flex-end' : 'flex-start',
            color: '#111',
            fontFamily: element.isCustomFont ? 'inherit' : 'Arial, sans-serif',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          {element.text}
        </div>
      );
    case 'shape':
      if (element.shape === 'line') {
        return <div className="w-full h-full" style={{ background: element.color === 'white' ? '#fff' : '#111' }} />;
      }
      return (
        <div
          className="w-full h-full"
          style={{
            border: `${Math.max(1, element.thicknessMm * pxPerMm)}px solid ${
              element.color === 'white' ? '#fff' : '#111'
            }`,
            borderRadius: element.cornerRounding * 2,
            boxSizing: 'border-box',
          }}
        />
      );
    case 'image':
      return <BitmapCanvas bitmap={bitmap} width={widthPx} height={heightPx} />;
    case 'icon': {
      const icon = getIconById(element.iconId);
      if (bitmap) return <BitmapCanvas bitmap={bitmap} width={widthPx} height={heightPx} />;
      return icon ? (
        <div
          className="w-full h-full"
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
      ) : null;
    }
    case 'barcode':
      return (
        <BarcodePreview
          data={element.data}
          symbology={element.symbology}
          showText={element.showText}
          moduleWidth={element.moduleWidth}
        />
      );
    case 'qr':
      return <QrPreview data={element.data} errorCorrection={element.errorCorrection} />;
    default:
      return null;
  }
}
