export const TECHNICAL_GLOSSARY = [
  "trí tuệ nhân tạo",
  "học máy",
  "mô hình học máy",
  "tạo sinh",
  "mô hình ngôn ngữ lớn",
  "mô hình ngôn ngữ",
  "bộ lọc thư rác",
  "phân loại",
  "áp phích",
  "trợ lý",
  "ứng dụng trò chuyện",
  "xử lý văn bản",
];

/**
 * Trích xuất các thuật ngữ chuyên ngành xuất hiện LẦN ĐẦU TIÊN tại mỗi câu.
 */
export function extractNewTermsPerSentence(
  sentences: Array<{ n: number; loi?: string }>,
  customGlossary: string[] = TECHNICAL_GLOSSARY,
): Map<number, string[]> {
  const result = new Map<number, string[]>();
  const seenTerms = new Set<string>();

  // Sắp xếp thuật ngữ theo độ dài giảm dần để ưu tiên cụm từ dài (vd: "mô hình học máy" trước "học máy")
  const sortedTerms = [...customGlossary].sort((a, b) => b.length - a.length);

  for (const s of sentences) {
    const text = (s.loi || "").toLowerCase();
    const newTerms: string[] = [];

    for (const term of sortedTerms) {
      const termLower = term.toLowerCase();
      if (text.includes(termLower) && !seenTerms.has(termLower)) {
        seenTerms.add(termLower);
        newTerms.push(term);
      }
    }

    result.set(s.n, newTerms);
  }

  return result;
}
