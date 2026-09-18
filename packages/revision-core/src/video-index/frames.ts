export interface SlideEntry {
  id: string;
  cau: number[];
  tuGiay: number;
  denGiay: number;
  anhDaiDien: string;
}

export interface SlideChain {
  slideId: string;
  cau: number[];
  tuGiay: number;
  denGiay: number;
}

/**
 * Phân tích file slide-d1.json.
 */
export function parseSlideJson(jsonText: string): SlideEntry[] {
  try {
    const data = JSON.parse(jsonText);
    return Array.isArray(data.slide) ? data.slide : [];
  } catch {
    return [];
  }
}

/**
 * Phát hiện các chuỗi phụ thuộc slide (Slide Chains):
 * Các câu cùng chia sẻ một slide thì khi sửa 1 câu, các câu còn lại phải rà soát/re-render lại slide.
 */
export function detectSlideChains(slides: SlideEntry[]): SlideChain[] {
  const chains: SlideChain[] = [];
  for (const s of slides) {
    if (s.cau && s.cau.length > 1) {
      chains.push({
        slideId: s.id,
        cau: [...s.cau],
        tuGiay: s.tuGiay,
        denGiay: s.denGiay,
      });
    }
  }
  return chains;
}

/**
 * Tìm slide chứa câu thứ n.
 */
export function findSlideForSentence(
  slides: SlideEntry[],
  n: number,
): {
  slide: SlideEntry | null;
  viTriTrongSlide: number;
  soCauCungSlide: number;
} {
  for (const s of slides) {
    const idx = s.cau.indexOf(n);
    if (idx !== -1) {
      return {
        slide: s,
        viTriTrongSlide: idx,
        soCauCungSlide: s.cau.length,
      };
    }
  }
  return {
    slide: null,
    viTriTrongSlide: 0,
    soCauCungSlide: 1,
  };
}
