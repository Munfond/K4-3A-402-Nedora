export interface SubtitlePage {
  index: number;
  batDau: number;
  ketThuc: number;
  text: string;
  kyTuMoiGiay: number;
}

/**
 * Phân tích file transcript/phụ đề (dạng "00:00 - 00:02: Lời phụ đề...").
 * D1 có đúng 72 trang phụ đề.
 */
export function parseSubtitleFile(transcriptText: string): SubtitlePage[] {
  const lines = transcriptText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const pages: SubtitlePage[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2}):\s*(.*)$/.exec(
      line,
    );
    if (!match) continue;

    const m1 = parseInt(match[1], 10);
    const s1 = parseInt(match[2], 10);
    const m2 = parseInt(match[3], 10);
    const s2 = parseInt(match[4], 10);

    const batDau = m1 * 60 + s1;
    const ketThuc = m2 * 60 + s2;
    const text = match[5].trim();
    const duration = Math.max(0.5, ketThuc - batDau);
    const kyTuMoiGiay = Math.round((text.length / duration) * 10) / 10;

    pages.push({
      index: pages.length + 1,
      batDau,
      ketThuc,
      text,
      kyTuMoiGiay,
    });
  }

  return pages;
}

/**
 * Ánh xạ các trang phụ đề vào từng câu theo độ giao thoa thời gian (n-to-m mapping).
 */
export function mapSubtitlesToSentences<
  T extends { n: number; batDau: number; ketThuc: number },
>(sentences: T[], subtitles: SubtitlePage[]): Map<number, SubtitlePage[]> {
  const mapping = new Map<number, SubtitlePage[]>();
  for (const s of sentences) {
    mapping.set(s.n, []);
  }

  for (const sub of subtitles) {
    // Tìm các câu có giao thoa thời gian với trang phụ đề này
    let matchedSentence: T | null = null;
    let maxOverlap = 0;

    for (const sent of sentences) {
      const overlapStart = Math.max(sub.batDau, sent.batDau);
      const overlapEnd = Math.min(sub.ketThuc, sent.ketThuc);
      const overlap = overlapEnd - overlapStart;

      if (overlap > 0) {
        mapping.get(sent.n)?.push(sub);
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          matchedSentence = sent;
        }
      }
    }

    // Nếu không có giao thoa thực sự (do lệch mép 0.5s), gán vào câu gần nhất
    if (maxOverlap <= 0) {
      let minDistance = Infinity;
      for (const sent of sentences) {
        const d = Math.min(
          Math.abs(sub.batDau - sent.batDau),
          Math.abs(sub.ketThuc - sent.ketThuc),
        );
        if (d < minDistance) {
          minDistance = d;
          matchedSentence = sent;
        }
      }
      if (matchedSentence && minDistance <= 2.0) {
        mapping.get(matchedSentence.n)?.push(sub);
      }
    }
  }

  return mapping;
}
