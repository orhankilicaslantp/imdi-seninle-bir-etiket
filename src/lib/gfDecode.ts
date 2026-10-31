// ZPL ACS (Alternative Data Compression Scheme) çözücü.
// ^GF / ~DG grafik verisi ASCII-HEX olarak gönderilir ve genellikle run-length ile
// sıkıştırılır. Bu modül sıkıştırılmış veriyi tam (sıkıştırılmamış) HEX nibble dizisine açar.
//
// Sıkıştırma kuralları (Zebra ZPL II):
//  - '0'..'9','A'..'F'      : birer hex nibble (değer)
//  - 'G'..'Y' (büyük harf)  : takip eden nibble'ı 1..19 kez tekrarla
//  - 'g'..'z' (küçük harf)  : takip eden nibble'ı 20,40,...,400 kez tekrarla
//    (büyük + küçük harf art arda gelip toplanabilir, örn. "gV" = 20+16 = 36 tekrar)
//  - ','                    : satırın kalanını 0x00 ile doldur ve yeni satıra geç
//  - '!'                    : satırın kalanını 0xFF ile doldur ve yeni satıra geç
//  - ':'                    : bir önceki satırın tamamını tekrar et

/** Verinin sıkıştırılmış (ACS) olup olmadığını sezgisel olarak belirler. */
export function isAcsCompressed(data: string): boolean {
  return /[G-Zg-z,:!]/.test(data);
}

/**
 * Sıkıştırılmış ACS verisini tam HEX nibble dizisine açar.
 * @param data     ^GF veri alanı (sıkıştırılmış veya düz HEX; boşluk/yeni satır yok sayılır)
 * @param rowBytes satır başına bayt sayısı (^GF'deki `bytesPerRow` parametresi)
 * @param totalBytes toplam bayt sayısı (^GF'deki `graphicFieldCount` parametresi)
 * @returns totalBytes*2 uzunluğunda büyük harf HEX string
 */
export function decodeAcsToHex(data: string, rowBytes: number, totalBytes: number): string {
  const rowNibbles = Math.max(1, rowBytes * 2);
  const totalNibbles = Math.max(0, totalBytes * 2);
  const clean = data.replace(/[\s]/g, '');

  let out = '';
  let curRow = '';
  let prevRow = '';
  let i = 0;

  const commitRow = (row: string) => {
    let r = row;
    if (r.length < rowNibbles) r = r + '0'.repeat(rowNibbles - r.length);
    else if (r.length > rowNibbles) r = r.slice(0, rowNibbles);
    out += r;
    prevRow = r;
    curRow = '';
  };

  while (i < clean.length && out.length < totalNibbles) {
    const ch = clean[i];

    if (ch === ',') {
      commitRow(curRow); // kalanı 0 ile doldur
      i++;
      continue;
    }
    if (ch === '!') {
      let r = curRow;
      if (r.length < rowNibbles) r = r + 'F'.repeat(rowNibbles - r.length);
      commitRow(r);
      i++;
      continue;
    }
    if (ch === ':') {
      if (curRow.length > 0) commitRow(curRow);
      out += prevRow.length ? prevRow : '0'.repeat(rowNibbles);
      i++;
      continue;
    }

    // Tekrar sayacı harflerini topla
    let count = 0;
    while (i < clean.length) {
      const c = clean[i];
      if (c >= 'G' && c <= 'Y') {
        count += c.charCodeAt(0) - 70; // G=1 .. Y=19
        i++;
      } else if (c >= 'g' && c <= 'z') {
        count += (c.charCodeAt(0) - 102) * 20; // g=20 .. z=400
        i++;
      } else {
        break;
      }
    }

    const c = clean[i];
    if (c && /[0-9A-Fa-f]/.test(c)) {
      const n = count > 0 ? count : 1;
      curRow += c.toUpperCase().repeat(n);
      i++;
      while (curRow.length >= rowNibbles) {
        const full = curRow.slice(0, rowNibbles);
        out += full;
        prevRow = full;
        curRow = curRow.slice(rowNibbles);
      }
    } else {
      // Tekrar sayacı var ama nibble yoksa / beklenmeyen karakter: atla
      i++;
    }
  }

  if (curRow.length > 0 && out.length < totalNibbles) commitRow(curRow);

  // Eksik kalırsa son satır (yoksa sıfır) ile tamamla
  while (out.length < totalNibbles) {
    out += prevRow.length ? prevRow : '0'.repeat(rowNibbles);
  }

  return out.slice(0, totalNibbles);
}

/**
 * ^GF veri alanını (sıkıştırılmış olabilir) tam bayt dizisine çevirir.
 */
export function gfDataToBytes(data: string, rowBytes: number, totalBytes: number): Uint8Array {
  const hex = isAcsCompressed(data)
    ? decodeAcsToHex(data, rowBytes, totalBytes)
    : data.replace(/[^0-9A-Fa-f]/g, '');
  const bytes = new Uint8Array(totalBytes);
  for (let i = 0; i < totalBytes; i++) {
    const h = hex.substr(i * 2, 2);
    bytes[i] = h.length === 2 ? parseInt(h, 16) || 0 : 0;
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// ACS Kodlayıcı (Labelery ile aynı biçimde sıkıştırma)
// ---------------------------------------------------------------------------

/** 1..19 tekrar için büyük harf (G=1 .. Y=19). */
function upperCount(n: number): string {
  return String.fromCharCode(70 + n); // G..Y
}

/** n, 20'nin katı ve <=400 olmalı: g=20 .. z=400. */
function lowerCount(n: number): string {
  return String.fromCharCode(102 + n / 20); // g..z
}

/** Verilen tekrar sayısını sayaç harflerine çevirir (hex nibble hariç). */
function encodeCount(n: number): string {
  if (n < 1) return '';
  if (n <= 19) return upperCount(n);
  let out = '';
  let rest = n;
  while (rest > 400) {
    out += 'z';
    rest -= 400;
  }
  // rest artık 20..400 (veya daha küçük) -- 20'nin katı kısmı küçük harf,
  // kalan 1..19'luk kısım büyük harf.
  const mult20 = Math.floor(rest / 20);
  const rem = rest % 20;
  if (mult20 > 0) out += lowerCount(mult20 * 20);
  if (rem > 0) out += upperCount(rem);
  return out;
}

/**
 * Tam (sıkıştırılmamış) ASCII-HEX veriyi ACS run-length biçiminde sıkıştırır.
 * Labelery'nin ürettiği biçimle uyumlu: satır sonu `,` (kalanı 0), `!` (kalanı F),
 * önceki satırla birebir aynı satır `:` ve tekrarler G-Y / g-z harfleriyle.
 */
export function encodeAcsFromHex(hexData: string, rowBytes: number): string {
  const rowNibbles = Math.max(2, rowBytes * 2);
  const hex = hexData.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  const rows = Math.ceil(hex.length / rowNibbles);
  let out = '';
  let prevRow = '';

  for (let r = 0; r < rows; r++) {
    const row = hex.substr(r * rowNibbles, rowNibbles);

    // Tam olarak önceki satırın aynısı mı? -> ':'
    if (prevRow && row === prevRow) {
      out += ':';
      continue;
    }

    let i = 0;
    let rowOut = '';
    while (i < row.length) {
      // Satırın kalanı tamamı '0' mı? -> ','
      let allZero = true;
      for (let k = i; k < row.length; k++) {
        if (row[k] !== '0') {
          allZero = false;
          break;
        }
      }
      if (allZero) {
        rowOut += ',';
        break;
      }
      // Satırın kalanı tamamı 'F' mi? -> '!'
      let allF = true;
      for (let k = i; k < row.length; k++) {
        if (row[k] !== 'F') {
          allF = false;
          break;
        }
      }
      if (allF) {
        rowOut += '!';
        break;
      }

      // Aynı nibble'ın tekrar uzunluğu
      const c = row[i];
      let j = i + 1;
      while (j < row.length && row[j] === c) j++;
      const count = j - i;
      // İki nibble'ı ham yazmak sayaç+nibble ile aynı uzunlukta; Labelary gibi ham bırak.
      rowOut += count > 2 ? encodeCount(count) + c : c.repeat(count);
      i = j;
    }

    out += rowOut;
    prevRow = row;
  }

  return out;
}
