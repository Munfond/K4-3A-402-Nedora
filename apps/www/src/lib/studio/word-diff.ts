/**
 * Thuật toán so sánh diff cấp từ (Word-level LCS Diff)
 * Thiết kế cho Studio UI để hiển thị trực quan các thay đổi câu chữ giữa kịch bản v1 và đề xuất v2.
 */

export type DiffType = "equal" | "delete" | "insert";

export interface DiffPart {
  type: DiffType;
  value: string;
}

/**
 * Tách văn bản thành mảng các từ và khoảng trắng / dấu câu
 */
export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  // Tách theo ranh giới từ hoặc cụm khoảng trắng/dấu câu để bảo tồn cấu trúc
  const tokens = text.match(/\S+|\s+/g);
  return tokens || [];
}

/**
 * Tính bảng ma trận LCS (Longest Common Subsequence) cho hai chuỗi tokens
 */
function computeLCSMatrix(tokensA: string[], tokensB: string[]): number[][] {
  const m = tokensA.length;
  const n = tokensB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (tokensA[i - 1] === tokensB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * So sánh diff cấp từ giữa hai chuỗi văn bản bằng LCS
 */
export function computeWordDiff(
  textBefore: string,
  textAfter: string,
): DiffPart[] {
  const tokensA = tokenizeWords(textBefore);
  const tokensB = tokenizeWords(textAfter);

  if (tokensA.length === 0 && tokensB.length === 0) return [];
  if (tokensA.length === 0) {
    return [{ type: "insert", value: textAfter }];
  }
  if (tokensB.length === 0) {
    return [{ type: "delete", value: textBefore }];
  }

  const dp = computeLCSMatrix(tokensA, tokensB);

  // Truy vết ngược để tạo danh sách diff
  let i = tokensA.length;
  let j = tokensB.length;
  const rawParts: DiffPart[] = [];

  while (i > 0 && j > 0) {
    if (tokensA[i - 1] === tokensB[j - 1]) {
      rawParts.push({ type: "equal", value: tokensA[i - 1] });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      rawParts.push({ type: "delete", value: tokensA[i - 1] });
      i--;
    } else {
      rawParts.push({ type: "insert", value: tokensB[j - 1] });
      j--;
    }
  }

  while (i > 0) {
    rawParts.push({ type: "delete", value: tokensA[i - 1] });
    i--;
  }

  while (j > 0) {
    rawParts.push({ type: "insert", value: tokensB[j - 1] });
    j--;
  }

  rawParts.reverse();

  // Gom cụm các phần tử cùng type liền kề để render mượt mà
  const consolidated: DiffPart[] = [];
  for (const part of rawParts) {
    const last = consolidated[consolidated.length - 1];
    if (last && last.type === part.type) {
      last.value += part.value;
    } else {
      consolidated.push({ type: part.type, value: part.value });
    }
  }

  return consolidated;
}

/**
 * Thống kê số từ thêm, bớt và giữ nguyên
 */
export function getDiffStats(parts: DiffPart[]): {
  insertedChars: number;
  deletedChars: number;
  insertedWords: number;
  deletedWords: number;
  isUnchanged: boolean;
} {
  let insertedChars = 0;
  let deletedChars = 0;
  let insertedWords = 0;
  let deletedWords = 0;

  for (const part of parts) {
    const wordCount = part.value.trim().split(/\s+/).filter(Boolean).length;
    if (part.type === "insert") {
      insertedChars += part.value.length;
      insertedWords += wordCount;
    } else if (part.type === "delete") {
      deletedChars += part.value.length;
      deletedWords += wordCount;
    }
  }

  return {
    insertedChars,
    deletedChars,
    insertedWords,
    deletedWords,
    isUnchanged: insertedWords === 0 && deletedWords === 0,
  };
}
