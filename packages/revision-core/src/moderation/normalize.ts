import { LEXICON } from "./lexicon";

const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;

export function stripInvisibleChars(text: string): {
  cleanText: string;
  invisibleCount: number;
} {
  const matches = text.match(INVISIBLE_CHARS_REGEX);
  const invisibleCount = matches ? matches.length : 0;
  const cleanText = text.replace(INVISIBLE_CHARS_REGEX, "");
  return { cleanText, invisibleCount };
}

export function toDisplay(text: string): string {
  if (!text) return "";
  return text.replace(INVISIBLE_CHARS_REGEX, "").normalize("NFC").trim();
}

export function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function replaceLeetspeak(str: string): string {
  return str
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a");
}

function joinSpacedLetters(str: string): string {
  // Nối các chữ đơn lẻ đứng cách nhau bởi dấu cách: ví dụ "n g u" -> "ngu", "v l" -> "vl", "d m" -> "dm"
  return str.replace(/\b([a-z])(?:\s+([a-z]))+\b/gi, (match) => {
    return match.replace(/\s+/g, "");
  });
}

function collapseRepeatedChars(str: string): string {
  // Gộp ký tự lặp ≥ 3 lần thành 1: ví dụ "nguuuu" -> "ngu", "quáaaaa" -> "quá"
  return str.replace(/(.)\1{2,}/gu, "$1");
}

export function toDetection(text: string): string {
  if (!text) return "";
  let s = text
    .replace(INVISIBLE_CHARS_REGEX, "")
    .normalize("NFKC")
    .toLowerCase();

  // Đổi leetspeak
  s = replaceLeetspeak(s);

  // Bỏ dấu tiếng Việt
  s = removeVietnameseDiacritics(s);

  // Gộp chữ lặp ≥ 3 -> 1
  s = collapseRepeatedChars(s);

  // Nối chữ cái đơn bị cách có chủ đích: "n g u" -> "ngu"
  s = joinSpacedLetters(s);

  // Thay thế teencode theo từ nguyên vẹn
  const words = s.split(/\s+/);
  const expanded = words.map((w) => {
    const cleanWord = w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    if (LEXICON.teencode[cleanWord]) {
      return w.replace(cleanWord, LEXICON.teencode[cleanWord]);
    }
    return w;
  });

  return expanded.join(" ").replace(/\s+/g, " ").trim();
}
