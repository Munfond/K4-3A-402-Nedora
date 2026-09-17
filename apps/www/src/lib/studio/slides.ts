export interface SlideSentenceMeta {
  sentenceN: number;
  slideId: string;
  image: string;
  khacAnh: string;
  giuNet: string;
}

export interface SlideGroup {
  id: string; // e.g. "s01", "s20"
  cau: number[];
  tuGiay: number;
  denGiay: number;
  sentences: SlideSentenceMeta[];
}

export const D1_SLIDE_SENTENCES: Record<
  number,
  { slideId: string; khacAnh: string; giuNet: string }
> = {
  1: { slideId: "s01", khacAnh: "—", giuNet: "—" },
  2: { slideId: "s02", khacAnh: "6.0%", giuNet: "13%" },
  3: { slideId: "s03", khacAnh: "7.3%", giuNet: "7%" },
  4: { slideId: "s04", khacAnh: "6.2%", giuNet: "3%" },
  5: { slideId: "s05", khacAnh: "2.9%", giuNet: "51%" },
  6: { slideId: "s06", khacAnh: "6.2%", giuNet: "7%" },
  7: { slideId: "s07", khacAnh: "4.1%", giuNet: "32%" },
  8: { slideId: "s08", khacAnh: "4.1%", giuNet: "33%" },
  9: { slideId: "s09", khacAnh: "5.2%", giuNet: "2%" },
  10: { slideId: "s10", khacAnh: "5.2%", giuNet: "4%" },
  11: { slideId: "s11", khacAnh: "5.7%", giuNet: "3%" },
  12: { slideId: "s12", khacAnh: "4.8%", giuNet: "2%" },
  13: { slideId: "s13", khacAnh: "3.8%", giuNet: "1%" },
  14: { slideId: "s14", khacAnh: "4.9%", giuNet: "3%" },
  15: { slideId: "s15", khacAnh: "5.3%", giuNet: "9%" },
  16: { slideId: "s15", khacAnh: "0.8%", giuNet: "91%" },
  17: { slideId: "s16", khacAnh: "5.5%", giuNet: "6%" },
  18: { slideId: "s17", khacAnh: "6.8%", giuNet: "7%" },
  19: { slideId: "s18", khacAnh: "6.7%", giuNet: "7%" },
  20: { slideId: "s19", khacAnh: "6.6%", giuNet: "6%" },
  21: { slideId: "s19", khacAnh: "1.0%", giuNet: "95%" },
  22: { slideId: "s20", khacAnh: "7.3%", giuNet: "9%" },
  23: { slideId: "s20", khacAnh: "1.1%", giuNet: "100%" },
  24: { slideId: "s21", khacAnh: "8.0%", giuNet: "5%" },
  25: { slideId: "s21", khacAnh: "0.0%", giuNet: "100%" },
  26: { slideId: "s21", khacAnh: "0.3%", giuNet: "100%" },
  27: { slideId: "s21", khacAnh: "0.8%", giuNet: "93%" },
  28: { slideId: "s21", khacAnh: "1.8%", giuNet: "81%" },
  29: { slideId: "s21", khacAnh: "1.6%", giuNet: "89%" },
  30: { slideId: "s21", khacAnh: "0.4%", giuNet: "100%" },
  31: { slideId: "s22", khacAnh: "8.0%", giuNet: "4%" },
  32: { slideId: "s23", khacAnh: "2.0%", giuNet: "48%" },
  33: { slideId: "s24", khacAnh: "4.7%", giuNet: "3%" },
  34: { slideId: "s24", khacAnh: "0.5%", giuNet: "99%" },
  35: { slideId: "s24", khacAnh: "0.6%", giuNet: "98%" },
  36: { slideId: "s25", khacAnh: "2.7%", giuNet: "64%" },
  37: { slideId: "s26", khacAnh: "6.0%", giuNet: "3%" },
  38: { slideId: "s27", khacAnh: "5.8%", giuNet: "4%" },
  39: { slideId: "s28", khacAnh: "7.0%", giuNet: "2%" },
  40: { slideId: "s29", khacAnh: "5.6%", giuNet: "4%" },
};

export const D1_SLIDE_GROUPS: Array<{
  id: string;
  cau: number[];
  tuGiay: number;
  denGiay: number;
}> = [
  { id: "s01", cau: [1], tuGiay: 0.0, denGiay: 6.8 },
  { id: "s02", cau: [2], tuGiay: 6.8, denGiay: 13.0 },
  { id: "s03", cau: [3], tuGiay: 13.0, denGiay: 21.3 },
  { id: "s04", cau: [4], tuGiay: 21.3, denGiay: 28.0 },
  { id: "s05", cau: [5], tuGiay: 28.0, denGiay: 34.2 },
  { id: "s06", cau: [6], tuGiay: 34.2, denGiay: 40.6 },
  { id: "s07", cau: [7], tuGiay: 40.6, denGiay: 46.6 },
  { id: "s08", cau: [8], tuGiay: 46.6, denGiay: 52.6 },
  { id: "s09", cau: [9], tuGiay: 52.6, denGiay: 56.2 },
  { id: "s10", cau: [10], tuGiay: 56.2, denGiay: 61.9 },
  { id: "s11", cau: [11], tuGiay: 61.9, denGiay: 69.3 },
  { id: "s12", cau: [12], tuGiay: 69.3, denGiay: 75.0 },
  { id: "s13", cau: [13], tuGiay: 75.0, denGiay: 80.6 },
  { id: "s14", cau: [14], tuGiay: 80.6, denGiay: 88.5 },
  { id: "s15", cau: [15, 16], tuGiay: 88.5, denGiay: 101.9 },
  { id: "s16", cau: [17], tuGiay: 101.9, denGiay: 108.5 },
  { id: "s17", cau: [18], tuGiay: 108.5, denGiay: 115.2 },
  { id: "s18", cau: [19], tuGiay: 115.2, denGiay: 121.5 },
  { id: "s19", cau: [20, 21], tuGiay: 121.5, denGiay: 134.6 },
  { id: "s20", cau: [22, 23], tuGiay: 134.6, denGiay: 146.8 },
  {
    id: "s21",
    cau: [24, 25, 26, 27, 28, 29, 30],
    tuGiay: 146.8,
    denGiay: 187.1,
  },
  { id: "s22", cau: [31], tuGiay: 187.1, denGiay: 194.3 },
  { id: "s23", cau: [32], tuGiay: 194.3, denGiay: 202.1 },
  { id: "s24", cau: [33, 34, 35], tuGiay: 202.1, denGiay: 217.1 },
  { id: "s25", cau: [36], tuGiay: 217.1, denGiay: 223.0 },
  { id: "s26", cau: [37], tuGiay: 223.0, denGiay: 229.8 },
  { id: "s27", cau: [38], tuGiay: 229.8, denGiay: 237.2 },
  { id: "s28", cau: [39], tuGiay: 237.2, denGiay: 244.2 },
  { id: "s29", cau: [40], tuGiay: 244.2, denGiay: 251.0 },
];

export function getSlideImageUrl(sentenceN: number): string {
  const pad = String(sentenceN).padStart(2, "0");
  return `/slide-anh/cau-${pad}.jpg`;
}

export function getSlideMetaForSentence(sentenceN: number): SlideSentenceMeta {
  const meta = D1_SLIDE_SENTENCES[sentenceN] || {
    slideId: `s${String(Math.ceil(sentenceN / 2)).padStart(2, "0")}`,
    khacAnh: "—",
    giuNet: "—",
  };

  return {
    sentenceN,
    slideId: meta.slideId,
    image: getSlideImageUrl(sentenceN),
    khacAnh: meta.khacAnh,
    giuNet: meta.giuNet,
  };
}

export function getFullSlideGroups(): SlideGroup[] {
  return D1_SLIDE_GROUPS.map((g) => ({
    ...g,
    sentences: g.cau.map((n) => getSlideMetaForSentence(n)),
  }));
}
