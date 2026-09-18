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

function replaceWordLeetspeak(word: string): string {
  // Nếu là mốc thời gian (ví dụ 1:15, 01:20:00, v.v.) thì không đổi
  if (/^\(?\d+:\d+(?::\d+)?\)?$/.test(word)) {
    return word;
  }
  // Nếu không chứa chữ cái (chỉ là số hoặc dấu câu như "5", "3", "100%", "3.") -> giữ nguyên
  if (!/\p{L}/u.test(word)) {
    return word;
  }
  // Chỉ đổi chữ số khi nó kề với chữ cái trong cùng một từ
  return word
    .replace(/(?<=\p{L})0|0(?=\p{L})/gu, "o")
    .replace(/(?<=\p{L})1|1(?=\p{L})/gu, "i")
    .replace(/(?<=\p{L})3|3(?=\p{L})/gu, "e")
    .replace(/(?<=\p{L})4|4(?=\p{L})/gu, "a")
    .replace(/(?<=\p{L})5|5(?=\p{L})/gu, "s")
    .replace(/(?<=\p{L})7|7(?=\p{L})/gu, "t")
    .replace(/(?<=\p{L})@|@(?=\p{L})/gu, "a");
}

function replaceLeetspeak(str: string): string {
  return str.replace(/\S+/g, (word) => replaceWordLeetspeak(word));
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
