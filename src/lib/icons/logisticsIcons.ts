// Etikete özel lojistik/kargo piktogramları (basit, siyah-beyaz, ZPL monokrom dönüşümüne uygun SVG'ler)

export interface LibraryIcon {
  id: string;
  name: string;
  svg: string; // viewBox 0 0 100 100, siyah dolgulu
}

const wrap = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;

export const LOGISTICS_ICONS: LibraryIcon[] = [
  {
    id: 'fragile',
    name: 'Kırılabilir',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M50 15 L58 35 L45 40 L60 55 L50 85 L48 60 L35 65 L50 40 Z" fill="black"/>
      <text x="50" y="97" font-size="10" text-anchor="middle" font-family="Arial" fill="black"></text>
    `),
  },
  {
    id: 'this-side-up',
    name: 'Bu Taraf Yukarı',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M50 15 L70 45 L58 45 L58 80 L42 80 L42 45 L30 45 Z" fill="black"/>
    `),
  },
  {
    id: 'keep-dry',
    name: 'Kuru Tutun',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M50 20 C62 40 70 52 70 62 C70 76 61 85 50 85 C39 85 30 76 30 62 C30 52 38 40 50 20 Z" fill="none" stroke="black" stroke-width="5"/>
      <line x1="20" y1="20" x2="80" y2="80" stroke="black" stroke-width="5"/>
    `),
  },
  {
    id: 'do-not-stack',
    name: 'İstifleme Yasak',
    svg: wrap(`
      <rect x="15" y="55" width="70" height="30" fill="none" stroke="black" stroke-width="5"/>
      <rect x="25" y="20" width="50" height="28" fill="none" stroke="black" stroke-width="5"/>
      <line x1="10" y1="15" x2="90" y2="90" stroke="black" stroke-width="6"/>
    `),
  },
  {
    id: 'recycle',
    name: 'Geri Dönüşüm',
    svg: wrap(`
      <path d="M50 10 L62 32 L38 32 Z" fill="black"/>
      <path d="M85 65 L73 87 L79 98 L55 98 L67 76 Z" fill="black" transform="rotate(0 0 0)"/>
      <path d="M15 65 L27 87 L21 98 L45 98 L33 76 Z" fill="black"/>
      <circle cx="50" cy="55" r="38" fill="none" stroke="black" stroke-width="4"/>
    `),
  },
  {
    id: 'cold-chain',
    name: 'Soğuk Zincir',
    svg: wrap(`
      <line x1="50" y1="10" x2="50" y2="90" stroke="black" stroke-width="5"/>
      <line x1="10" y1="50" x2="90" y2="50" stroke="black" stroke-width="5"/>
      <line x1="21" y1="21" x2="79" y2="79" stroke="black" stroke-width="5"/>
      <line x1="79" y1="21" x2="21" y2="79" stroke="black" stroke-width="5"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="black" stroke-width="4"/>
    `),
  },
  {
    id: 'flammable',
    name: 'Yanıcı',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M50 15 C65 35 68 45 60 58 C63 50 55 48 53 55 C50 45 40 48 42 60 C30 50 35 35 50 15 Z" fill="black"/>
    `),
  },
  {
    id: 'heavy',
    name: 'Ağır',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <text x="50" y="68" font-size="46" text-anchor="middle" font-family="Arial" font-weight="bold" fill="black">kg</text>
    `),
  },
  {
    id: 'handle-with-care',
    name: 'Dikkatli Taşıyın',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M25 55 L25 35 C25 30 33 30 33 35 L33 55 M33 50 L33 32 C33 27 41 27 41 32 L41 55 M41 50 L41 30 C41 25 49 25 49 30 L49 55 M49 50 L49 35 C49 30 57 30 57 35 L57 60 C57 75 47 82 37 82 C30 82 25 78 20 70 L12 55" fill="none" stroke="black" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'do-not-tip',
    name: 'Ters Çevirmeyin',
    svg: wrap(`
      <circle cx="30" cy="70" r="8" fill="black"/>
      <circle cx="70" cy="70" r="8" fill="black"/>
      <path d="M20 70 L20 30 L80 30 L80 70" fill="none" stroke="black" stroke-width="5"/>
      <line x1="10" y1="20" x2="90" y2="90" stroke="black" stroke-width="6"/>
    `),
  },
  {
    id: 'general-warning',
    name: 'Genel Uyarı',
    svg: wrap(`
      <path d="M50 10 L92 85 L8 85 Z" fill="none" stroke="black" stroke-width="6" stroke-linejoin="round"/>
      <rect x="46" y="38" width="8" height="26" fill="black"/>
      <rect x="46" y="70" width="8" height="8" fill="black"/>
    `),
  },
  {
    id: 'temperature-sensitive',
    name: 'Sıcaklık Hassas',
    svg: wrap(`
      <rect x="42" y="10" width="16" height="55" rx="8" fill="none" stroke="black" stroke-width="5"/>
      <circle cx="50" cy="78" r="14" fill="none" stroke="black" stroke-width="5"/>
      <line x1="50" y1="25" x2="50" y2="70" stroke="black" stroke-width="4"/>
    `),
  },
];

export function getIconById(id: string): LibraryIcon | undefined {
  return LOGISTICS_ICONS.find((i) => i.id === id);
}
