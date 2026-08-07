// Etikete özel lojistik/kargo piktogramları (basit, siyah-beyaz, ZPL monokrom dönüşümüne uygun SVG'ler)
// Kategoriler:
//  - handling: koli/paket üzerinde taşıma-elleçleme işaretleri (ISO 780 tarzı)
//  - recycling: ambalaj geri dönüşüm işaretleri (plastik reçine kodları, Mobius döngüsü, vb.)

export type IconCategory = 'handling' | 'recycling';

export interface LibraryIcon {
  id: string;
  name: string;
  category: IconCategory;
  svg: string; // viewBox 0 0 100 100, siyah dolgulu
}

const wrap = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;

// Geri dönüşüm üçgeni (3 kollu "kovalayan oklar") - resin kodları ve genel geri dönüşüm
// işaretlerinde tekrar kullanılır.
const arrowBlade = `<path d="M50 8 L60 26 L54 26 L54 30 L46 30 L46 26 L40 26 Z" fill="black"/>`;
const triangleLoop = `
  <g>${arrowBlade}</g>
  <g transform="rotate(120 50 44)">${arrowBlade}</g>
  <g transform="rotate(240 50 44)">${arrowBlade}</g>
`;

function resinIcon(num: number, code: string, fullName: string): LibraryIcon {
  return {
    id: `resin-${num}`,
    name: `Geri Dönüşüm ${num} - ${fullName}`,
    category: 'recycling',
    svg: wrap(`
      ${triangleLoop}
      <text x="50" y="50" font-size="15" font-weight="bold" text-anchor="middle" font-family="Arial" fill="black">${num}</text>
      <text x="50" y="93" font-size="11" text-anchor="middle" font-family="Arial" fill="black">${code}</text>
    `),
  };
}

export const LOGISTICS_ICONS: LibraryIcon[] = [
  // ================= KOLİ / PAKET TAŞIMA İŞARETLERİ (handling) =================
  {
    id: 'fragile',
    name: 'Kırılabilir',
    category: 'handling',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M50 15 L58 35 L45 40 L60 55 L50 85 L48 60 L35 65 L50 40 Z" fill="black"/>
    `),
  },
  {
    id: 'this-side-up',
    name: 'Bu Taraf Yukarı',
    category: 'handling',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M50 15 L70 45 L58 45 L58 80 L42 80 L42 45 L30 45 Z" fill="black"/>
    `),
  },
  {
    id: 'keep-dry',
    name: 'Kuru Tutun',
    category: 'handling',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M50 20 C62 40 70 52 70 62 C70 76 61 85 50 85 C39 85 30 76 30 62 C30 52 38 40 50 20 Z" fill="none" stroke="black" stroke-width="5"/>
      <line x1="20" y1="20" x2="80" y2="80" stroke="black" stroke-width="5"/>
    `),
  },
  {
    id: 'do-not-stack',
    name: 'İstifleme Yasak',
    category: 'handling',
    svg: wrap(`
      <rect x="15" y="55" width="70" height="30" fill="none" stroke="black" stroke-width="5"/>
      <rect x="25" y="20" width="50" height="28" fill="none" stroke="black" stroke-width="5"/>
      <line x1="10" y1="15" x2="90" y2="90" stroke="black" stroke-width="6"/>
    `),
  },
  {
    id: 'cold-chain',
    name: 'Soğuk Zincir',
    category: 'handling',
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
    category: 'handling',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M50 15 C65 35 68 45 60 58 C63 50 55 48 53 55 C50 45 40 48 42 60 C30 50 35 35 50 15 Z" fill="black"/>
    `),
  },
  {
    id: 'heavy',
    name: 'Ağır',
    category: 'handling',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <text x="50" y="68" font-size="46" text-anchor="middle" font-family="Arial" font-weight="bold" fill="black">kg</text>
    `),
  },
  {
    id: 'handle-with-care',
    name: 'Dikkatli Taşıyın',
    category: 'handling',
    svg: wrap(`
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="black" stroke-width="4"/>
      <path d="M25 55 L25 35 C25 30 33 30 33 35 L33 55 M33 50 L33 32 C33 27 41 27 41 32 L41 55 M41 50 L41 30 C41 25 49 25 49 30 L49 55 M49 50 L49 35 C49 30 57 30 57 35 L57 60 C57 75 47 82 37 82 C30 82 25 78 20 70 L12 55" fill="none" stroke="black" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'do-not-tip',
    name: 'Ters Çevirmeyin',
    category: 'handling',
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
    category: 'handling',
    svg: wrap(`
      <path d="M50 10 L92 85 L8 85 Z" fill="none" stroke="black" stroke-width="6" stroke-linejoin="round"/>
      <rect x="46" y="38" width="8" height="26" fill="black"/>
      <rect x="46" y="70" width="8" height="8" fill="black"/>
    `),
  },
  {
    id: 'temperature-sensitive',
    name: 'Sıcaklık Hassas',
    category: 'handling',
    svg: wrap(`
      <rect x="42" y="10" width="16" height="55" rx="8" fill="none" stroke="black" stroke-width="5"/>
      <circle cx="50" cy="78" r="14" fill="none" stroke="black" stroke-width="5"/>
      <line x1="50" y1="25" x2="50" y2="70" stroke="black" stroke-width="4"/>
    `),
  },
  {
    id: 'center-of-gravity',
    name: 'Ağırlık Merkezi',
    category: 'handling',
    svg: wrap(`
      <circle cx="50" cy="50" r="30" fill="none" stroke="black" stroke-width="4"/>
      <line x1="50" y1="8" x2="50" y2="92" stroke="black" stroke-width="4"/>
      <line x1="8" y1="50" x2="92" y2="50" stroke="black" stroke-width="4"/>
      <circle cx="50" cy="50" r="6" fill="black"/>
    `),
  },
  {
    id: 'sling-here',
    name: 'Askı Noktası',
    category: 'handling',
    svg: wrap(`
      <rect x="10" y="55" width="80" height="32" fill="none" stroke="black" stroke-width="4"/>
      <path d="M25 55 C25 38 37 30 37 45" fill="none" stroke="black" stroke-width="5" stroke-linecap="round"/>
      <path d="M75 55 C75 38 63 30 63 45" fill="none" stroke="black" stroke-width="5" stroke-linecap="round"/>
    `),
  },
  {
    id: 'clamp-here',
    name: 'Kıskaç Noktası',
    category: 'handling',
    svg: wrap(`
      <rect x="32" y="15" width="10" height="70" fill="black"/>
      <rect x="58" y="15" width="10" height="70" fill="black"/>
      <path d="M22 50 L30 50 M22 50 L29 44 M22 50 L29 56" stroke="black" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M78 50 L70 50 M78 50 L71 44 M78 50 L71 56" stroke="black" stroke-width="5" fill="none" stroke-linecap="round"/>
    `),
  },
  {
    id: 'do-not-clamp',
    name: 'Kıskaçlama Yasak',
    category: 'handling',
    svg: wrap(`
      <rect x="32" y="15" width="10" height="70" fill="black"/>
      <rect x="58" y="15" width="10" height="70" fill="black"/>
      <path d="M22 50 L30 50 M22 50 L29 44 M22 50 L29 56" stroke="black" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M78 50 L70 50 M78 50 L71 44 M78 50 L71 56" stroke="black" stroke-width="5" fill="none" stroke-linecap="round"/>
      <line x1="10" y1="10" x2="90" y2="90" stroke="black" stroke-width="6"/>
    `),
  },
  {
    id: 'forklift-here',
    name: 'Forklift Noktası',
    category: 'handling',
    svg: wrap(`
      <line x1="10" y1="40" x2="65" y2="40" stroke="black" stroke-width="7" stroke-linecap="round"/>
      <line x1="10" y1="65" x2="65" y2="65" stroke="black" stroke-width="7" stroke-linecap="round"/>
      <path d="M58 25 L82 52 L58 79" fill="none" stroke="black" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    `),
  },
  {
    id: 'stacking-limit',
    name: 'İstifleme Limiti',
    category: 'handling',
    svg: wrap(`
      <rect x="18" y="55" width="46" height="28" fill="none" stroke="black" stroke-width="4"/>
      <rect x="24" y="30" width="34" height="24" fill="none" stroke="black" stroke-width="4"/>
      <text x="84" y="63" font-size="30" font-weight="bold" text-anchor="middle" font-family="Arial" fill="black">2</text>
      <line x1="78" y1="20" x2="78" y2="88" stroke="black" stroke-width="3"/>
      <path d="M78 20 L72 29 M78 20 L84 29" stroke="black" stroke-width="3" fill="none" stroke-linecap="round"/>
    `),
  },
  {
    id: 'no-hand-truck',
    name: 'El Arabası Kullanmayın',
    category: 'handling',
    svg: wrap(`
      <circle cx="28" cy="80" r="9" fill="none" stroke="black" stroke-width="4"/>
      <path d="M28 71 L28 20 L52 20" fill="none" stroke="black" stroke-width="5" stroke-linecap="round"/>
      <rect x="52" y="15" width="26" height="45" fill="none" stroke="black" stroke-width="4"/>
      <line x1="10" y1="15" x2="90" y2="90" stroke="black" stroke-width="6"/>
    `),
  },
  {
    id: 'protect-from-sunlight',
    name: 'Güneşten Koruyun',
    category: 'handling',
    svg: wrap(`
      <circle cx="50" cy="42" r="15" fill="none" stroke="black" stroke-width="4"/>
      <line x1="50" y1="10" x2="50" y2="19" stroke="black" stroke-width="4"/>
      <line x1="50" y1="65" x2="50" y2="74" stroke="black" stroke-width="4"/>
      <line x1="18" y1="42" x2="27" y2="42" stroke="black" stroke-width="4"/>
      <line x1="73" y1="42" x2="82" y2="42" stroke="black" stroke-width="4"/>
      <line x1="27" y1="19" x2="34" y2="26" stroke="black" stroke-width="4"/>
      <line x1="66" y1="26" x2="73" y2="19" stroke="black" stroke-width="4"/>
      <line x1="27" y1="65" x2="34" y2="58" stroke="black" stroke-width="4"/>
      <line x1="66" y1="58" x2="73" y2="65" stroke="black" stroke-width="4"/>
      <line x1="10" y1="10" x2="90" y2="90" stroke="black" stroke-width="6"/>
    `),
  },
  {
    id: 'grip-here',
    name: 'Tutma Noktası',
    category: 'handling',
    svg: wrap(`
      <rect x="15" y="15" width="70" height="70" fill="none" stroke="black" stroke-width="4"/>
      <path d="M15 42 C27 36 27 64 15 58 Z" fill="black"/>
      <path d="M85 42 C73 36 73 64 85 58 Z" fill="black"/>
    `),
  },
  {
    id: 'do-not-roll',
    name: 'Yuvarlamayın',
    category: 'handling',
    svg: wrap(`
      <circle cx="50" cy="55" r="30" fill="none" stroke="black" stroke-width="5"/>
      <line x1="50" y1="25" x2="50" y2="85" stroke="black" stroke-width="3"/>
      <line x1="20" y1="55" x2="80" y2="55" stroke="black" stroke-width="3"/>
      <line x1="15" y1="15" x2="85" y2="95" stroke="black" stroke-width="6"/>
    `),
  },
  {
    id: 'esd-sensitive',
    name: 'Elektrostatik Hassas (ESD)',
    category: 'handling',
    svg: wrap(`
      <path d="M50 8 L90 82 L10 82 Z" fill="none" stroke="black" stroke-width="5" stroke-linejoin="round"/>
      <ellipse cx="50" cy="60" rx="16" ry="12" fill="none" stroke="black" stroke-width="3"/>
      <line x1="42" y1="48" x2="42" y2="36" stroke="black" stroke-width="3" stroke-linecap="round"/>
      <line x1="50" y1="48" x2="50" y2="33" stroke="black" stroke-width="3" stroke-linecap="round"/>
      <line x1="58" y1="48" x2="58" y2="36" stroke="black" stroke-width="3" stroke-linecap="round"/>
      <line x1="18" y1="70" x2="82" y2="70" stroke="black" stroke-width="4"/>
    `),
  },
  {
    id: 'corrosive',
    name: 'Aşındırıcı',
    category: 'handling',
    svg: wrap(`
      <line x1="30" y1="14" x2="45" y2="55" stroke="black" stroke-width="5" stroke-linecap="round"/>
      <line x1="56" y1="14" x2="43" y2="55" stroke="black" stroke-width="5" stroke-linecap="round"/>
      <circle cx="44" cy="59" r="3" fill="black"/>
      <circle cx="50" cy="66" r="2.5" fill="black"/>
      <line x1="15" y1="70" x2="85" y2="70" stroke="black" stroke-width="4"/>
      <path d="M25 86 C35 81 45 91 55 83 C65 77 75 89 85 85" fill="none" stroke="black" stroke-width="3"/>
    `),
  },
  {
    id: 'toxic',
    name: 'Zehirli',
    category: 'handling',
    svg: wrap(`
      <circle cx="50" cy="38" r="20" fill="none" stroke="black" stroke-width="4"/>
      <circle cx="42" cy="35" r="4" fill="black"/>
      <circle cx="58" cy="35" r="4" fill="black"/>
      <path d="M42 48 L46 52 L50 48 L54 52 L58 48" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
      <line x1="20" y1="75" x2="80" y2="60" stroke="black" stroke-width="5" stroke-linecap="round"/>
      <line x1="20" y1="60" x2="80" y2="75" stroke="black" stroke-width="5" stroke-linecap="round"/>
    `),
  },

  // ================= GERİ DÖNÜŞÜM / AMBALAJ İŞARETLERİ (recycling) =================
  {
    id: 'recycle',
    name: 'Genel Geri Dönüşüm',
    category: 'recycling',
    svg: wrap(`
      <path d="M50 10 L62 32 L38 32 Z" fill="black"/>
      <path d="M85 65 L73 87 L79 98 L55 98 L67 76 Z" fill="black"/>
      <path d="M15 65 L27 87 L21 98 L45 98 L33 76 Z" fill="black"/>
      <circle cx="50" cy="55" r="38" fill="none" stroke="black" stroke-width="4"/>
    `),
  },
  resinIcon(1, 'PETE', 'Polietilen Tereftalat'),
  resinIcon(2, 'HDPE', 'Yüksek Yoğunluklu Polietilen'),
  resinIcon(3, 'PVC', 'Polivinil Klorür'),
  resinIcon(4, 'LDPE', 'Düşük Yoğunluklu Polietilen'),
  resinIcon(5, 'PP', 'Polipropilen'),
  resinIcon(6, 'PS', 'Polistiren'),
  resinIcon(7, 'OTHER', 'Diğer'),
  {
    id: 'green-dot',
    name: 'Yeşil Nokta (Der Grüne Punkt)',
    category: 'recycling',
    svg: wrap(`
      <path d="M50 12 A38 38 0 0 1 88 50 L78 50 A28 28 0 0 0 50 22 Z" fill="black"/>
      <path d="M50 88 A38 38 0 0 1 12 50 L22 50 A28 28 0 0 0 50 78 Z" fill="black"/>
      <path d="M84 44 L94 50 L84 56 Z" fill="black"/>
      <path d="M16 56 L6 50 L16 44 Z" fill="black"/>
    `),
  },
  {
    id: 'tidyman',
    name: 'Çöpü Yere Atmayın',
    category: 'recycling',
    svg: wrap(`
      <circle cx="30" cy="25" r="8" fill="black"/>
      <path d="M30 33 L30 55 M30 40 L45 30 M30 55 L20 75 M30 55 L38 78" stroke="black" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="55" y="55" width="25" height="35" fill="none" stroke="black" stroke-width="4"/>
      <line x1="52" y1="55" x2="83" y2="55" stroke="black" stroke-width="4"/>
      <path d="M45 30 L57 56" stroke="black" stroke-width="3" fill="none" stroke-dasharray="3,3"/>
    `),
  },
  {
    id: 'weee',
    name: 'Elektronik Atık (Çöpe Atmayın)',
    category: 'recycling',
    svg: wrap(`
      <path d="M35 30 L65 30 L62 85 L38 85 Z" fill="none" stroke="black" stroke-width="4"/>
      <rect x="40" y="18" width="20" height="8" fill="none" stroke="black" stroke-width="4"/>
      <line x1="30" y1="30" x2="70" y2="30" stroke="black" stroke-width="4"/>
      <circle cx="42" cy="90" r="4" fill="black"/>
      <circle cx="58" cy="90" r="4" fill="black"/>
      <line x1="18" y1="14" x2="82" y2="90" stroke="black" stroke-width="6"/>
      <line x1="82" y1="14" x2="18" y2="90" stroke="black" stroke-width="6"/>
    `),
  },
  {
    id: 'compostable',
    name: 'Kompostlanabilir',
    category: 'recycling',
    svg: wrap(`
      <line x1="50" y1="90" x2="50" y2="52" stroke="black" stroke-width="4"/>
      <path d="M50 60 C30 55 25 35 40 25 C45 45 50 50 50 60 Z" fill="black"/>
      <path d="M50 55 C70 48 78 28 62 20 C58 40 52 45 50 55 Z" fill="black"/>
    `),
  },
  {
    id: 'glass-recycling',
    name: 'Cam Geri Dönüşüm',
    category: 'recycling',
    svg: wrap(`
      <path d="M45 8 L45 20 L36 32 L36 88 L64 88 L64 32 L55 20 L55 8 Z" fill="none" stroke="black" stroke-width="4"/>
      <line x1="45" y1="8" x2="55" y2="8" stroke="black" stroke-width="4"/>
      <text x="50" y="97" font-size="11" text-anchor="middle" font-family="Arial" fill="black">CAM</text>
    `),
  },
  {
    id: 'paper-recycling',
    name: 'Kağıt Geri Dönüşüm',
    category: 'recycling',
    svg: wrap(`
      <rect x="25" y="15" width="50" height="60" fill="none" stroke="black" stroke-width="4"/>
      <line x1="25" y1="30" x2="75" y2="30" stroke="black" stroke-width="3"/>
      <line x1="25" y1="45" x2="75" y2="45" stroke="black" stroke-width="3"/>
      <line x1="25" y1="60" x2="75" y2="60" stroke="black" stroke-width="3"/>
      <text x="50" y="93" font-size="11" text-anchor="middle" font-family="Arial" fill="black">KAĞIT</text>
    `),
  },
];

export function getIconById(id: string): LibraryIcon | undefined {
  return LOGISTICS_ICONS.find((i) => i.id === id);
}

export const ICON_CATEGORY_LABELS: Record<IconCategory, string> = {
  handling: 'Koli / Paket Taşıma İşaretleri',
  recycling: 'Geri Dönüşüm & Ambalaj İşaretleri',
};
