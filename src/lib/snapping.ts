// Sürükleme sırasında diğer elemanlara ve etiket kenarlarına/merkezine hizalama (snap guide) mantığı.

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapGuides {
  vertical: number[]; // mm cinsinden x konumları (dikey çizgiler)
  horizontal: number[]; // mm cinsinden y konumları (yatay çizgiler)
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuides;
}

/**
 * `dragged` kutusunun kenar/merkez noktalarını `others` (diğer elemanlar) ve etiketin
 * kendi kenar/merkez noktalarıyla karşılaştırır; eşik (thresholdMm) içine giren en yakın
 * eşleşmeye kilitler ve hangi kılavuz çizgilerin çizileceğini döndürür.
 */
export function computeSnap(
  dragged: Box,
  others: Box[],
  label: { widthMm: number; heightMm: number },
  thresholdMm: number,
): SnapResult {
  const xCandidates: number[] = [0, label.widthMm / 2, label.widthMm];
  const yCandidates: number[] = [0, label.heightMm / 2, label.heightMm];
  for (const o of others) {
    xCandidates.push(o.x, o.x + o.width / 2, o.x + o.width);
    yCandidates.push(o.y, o.y + o.height / 2, o.y + o.height);
  }

  const draggedXPoints = [
    { edge: 'left' as const, value: dragged.x },
    { edge: 'center' as const, value: dragged.x + dragged.width / 2 },
    { edge: 'right' as const, value: dragged.x + dragged.width },
  ];
  const draggedYPoints = [
    { edge: 'top' as const, value: dragged.y },
    { edge: 'center' as const, value: dragged.y + dragged.height / 2 },
    { edge: 'bottom' as const, value: dragged.y + dragged.height },
  ];

  let bestX: { diff: number; targetX: number; guide: number } | null = null;
  for (const dp of draggedXPoints) {
    for (const cand of xCandidates) {
      const diff = Math.abs(dp.value - cand);
      if (diff <= thresholdMm && (!bestX || diff < bestX.diff)) {
        const offset = dp.value - dragged.x; // dp.value konumunun kutunun x'ine göre ofseti
        bestX = { diff, targetX: cand - offset, guide: cand };
      }
    }
  }

  let bestY: { diff: number; targetY: number; guide: number } | null = null;
  for (const dp of draggedYPoints) {
    for (const cand of yCandidates) {
      const diff = Math.abs(dp.value - cand);
      if (diff <= thresholdMm && (!bestY || diff < bestY.diff)) {
        const offset = dp.value - dragged.y;
        bestY = { diff, targetY: cand - offset, guide: cand };
      }
    }
  }

  return {
    x: bestX ? bestX.targetX : dragged.x,
    y: bestY ? bestY.targetY : dragged.y,
    guides: {
      vertical: bestX ? [bestX.guide] : [],
      horizontal: bestY ? [bestY.guide] : [],
    },
  };
}
