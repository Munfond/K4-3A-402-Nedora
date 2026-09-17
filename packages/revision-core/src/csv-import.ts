/**
 * CSV import utility cho tab Góp ý (dùng cả ở client và server).
 * Hỗ trợ 2 format:
 *  - Khảo sát: ma_gop_y, nguoi_gui, de_hieu_1_5, nhip_do_1_5, y_kien_them
 *  - Bình luận thô: id, nguoi_gui, noi_dung (+ các alias tiếng Anh)
 * Hỗ trợ dấu phân cách ',' và ';' (Excel tiếng Việt), ô nhiều dòng trong ngoặc kép, và UTF-8 BOM.
 */

import type { NewFeedbackInput } from "./types";
import { normalizeUnicodeNfc, stripInvisibleChars } from "./sanitize";

export const CSV_MAX_BYTES = 1024 * 1024; // 1 MB
export const CSV_MAX_ROWS = 500; // Tối đa 500 dòng dữ liệu

/** Một dòng đọc được từ CSV; nhãn, cách ly và mã nội bộ do server cấp khi lưu. */
export interface CsvFeedbackRow extends NewFeedbackInput {
  /** Mã định danh từ file CSV hoặc số dòng tạm thời. */
  rowKey: string;
  sourceRef?: string;
  sender: string;
}

export type CsvFormat = "khao-sat" | "binh-luan" | "unknown";

export interface CsvRowWarning {
  row: number;
  message: string;
}

export interface CsvParseResult {
  rows: CsvFeedbackRow[];
  format: CsvFormat;
  totalRows: number;
  warnings: CsvRowWarning[];
  error?: {
    code: "INPUT_INVALID" | "FILE_TOO_LARGE";
    message: string;
  };
}

// ─── Tạo fingerprint chống nạp trùng (C3) ───────────────────────────────────

export function computeFeedbackFingerprint(
  sender: string,
  text: string,
  survey?: { deHieu?: number; nhipDo?: number },
): string {
  const s = (sender || "").trim().toLowerCase();
  const t = (text || "").trim().toLowerCase();
  const dh = survey?.deHieu != null ? String(survey.deHieu) : "";
  const nd = survey?.nhipDo != null ? String(survey.nhipDo) : "";
  return `${s}:::${t}:::${dh}:::${nd}`;
}

// ─── Nhận diện dấu phân cách ',' hoặc ';' (Excel VN) ───────────────────────

export function detectDelimiter(firstLine: string): "," | ";" {
  let commaCount = 0;
  let semiCount = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes) {
      if (ch === ",") commaCount++;
      else if (ch === ";") semiCount++;
    }
  }

  return semiCount > commaCount ? ";" : ",";
}

// ─── CSV parser (ô trong ngoặc kép được chứa dấu phân cách và xuống dòng) ────

export function splitCsvRecords(
  text: string,
  delimiter?: "," | ";",
): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  if (!clean.trim()) return [];

  // Tìm dòng đầu tiên để nhận diện delimiter nếu chưa chỉ định
  const firstLineEnd = clean.search(/[\r\n]/);
  const firstLine = firstLineEnd !== -1 ? clean.slice(0, firstLineEnd) : clean;
  const sep = delimiter || detectDelimiter(firstLine);

  const records: string[][] = [];
  let record: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      record.push(current.trim());
      current = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      record.push(current.trim());
      records.push(record);
      record = [];
      current = "";
    } else {
      current += ch;
    }
  }
  record.push(current.trim());
  records.push(record);

  return records.filter((r) => r.some((v) => v !== ""));
}

export function parseCsvText(
  text: string,
  delimiter?: "," | ";",
): Array<Record<string, string>> {
  const records = splitCsvRecords(text, delimiter);
  if (records.length < 2) return [];

  const headers = records[0].map((h) => h.toLowerCase().trim());
  return records.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    return row;
  });
}

// ─── Detect format từ header ─────────────────────────────────────────────────

export function detectFormat(headers: string[]): CsvFormat {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  if (
    set.has("de_hieu_1_5") ||
    set.has("nhip_do_1_5") ||
    set.has("de_hieu") ||
    set.has("nhip_do") ||
    set.has("y_kien_them")
  ) {
    return "khao-sat";
  }
  if (
    set.has("noi_dung") ||
    set.has("text") ||
    set.has("comment") ||
    set.has("content")
  ) {
    return "binh-luan";
  }
  return "unknown";
}

// ─── Lấy giá trị từ nhiều alias cột ────────────────────────────────────────

function getCol(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v !== undefined && v !== "") return v.trim();
  }
  return "";
}

function parseScore(val: string): number | undefined {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1 || n > 5) return undefined;
  return n;
}

// ─── Main parse function ────────────────────────────────────────────────────

export const parseFeedbackCsv = parseSurveyCsv;

export function parseSurveyCsv(
  csvText: string,
  options: { maxBytes?: number; maxRows?: number; delimiter?: "," | ";" } = {},
): CsvParseResult {
  const maxBytes = options.maxBytes ?? CSV_MAX_BYTES;
  const maxRows = options.maxRows ?? CSV_MAX_ROWS;

  // 1. Kiểm tra kích thước tệp
  const byteLength =
    typeof Buffer !== "undefined"
      ? Buffer.byteLength(csvText, "utf-8")
      : new TextEncoder().encode(csvText).length;

  if (byteLength > maxBytes) {
    return {
      rows: [],
      format: "unknown",
      totalRows: 0,
      warnings: [],
      error: {
        code: "FILE_TOO_LARGE",
        message: `Kích thước tệp CSV (${(byteLength / 1024).toFixed(1)} KB) vượt quá giới hạn tối đa ${(maxBytes / 1024).toFixed(0)} KB`,
      },
    };
  }

  // 2. Parse các bản ghi CSV
  const records = splitCsvRecords(csvText, options.delimiter);
  if (records.length === 0) {
    return { rows: [], format: "unknown", totalRows: 0, warnings: [] };
  }

  // Dòng 0 là header, các dòng còn lại là data
  const dataRowCount = records.length - 1;
  if (dataRowCount > maxRows) {
    return {
      rows: [],
      format: "unknown",
      totalRows: dataRowCount,
      warnings: [],
      error: {
        code: "INPUT_INVALID",
        message: `Số dòng trong tệp (${dataRowCount}) vượt quá giới hạn tối đa ${maxRows} dòng`,
      },
    };
  }

  const rawHeaders = records[0].map((h) => h.toLowerCase().trim());
  const format = detectFormat(rawHeaders);
  const warnings: CsvRowWarning[] = [];
  const rows: CsvFeedbackRow[] = [];

  for (let idx = 0; idx < dataRowCount; idx++) {
    const rowNum = idx + 2; // +2 vì row 1 là header
    const values = records[idx + 1];
    const raw: Record<string, string> = {};
    rawHeaders.forEach((h, i) => {
      raw[h] = values[i] ?? "";
    });

    const sourceRef =
      getCol(raw, "ma_gop_y", "id", "ma_id", "sourceref") || undefined;
    const rowKey = sourceRef || `dong-${rowNum}`;

    const senderRaw = getCol(
      raw,
      "nguoi_gui",
      "sender",
      "nguoi_hoc",
      "user",
      "author",
    );
    const sender = senderRaw || `ng-csv-${idx + 1}`;

    const timeRaw = getCol(raw, "thoi_diem", "created_at", "time", "ngay");
    let time: string | undefined;
    if (timeRaw) {
      const d = new Date(timeRaw.replace(" ", "T"));
      if (!Number.isNaN(d.getTime())) time = d.toISOString();
    }

    let textRaw = "";
    let channel: CsvFeedbackRow["channel"] = "khao-sat";
    let deHieu: number | undefined;
    let nhipDo: number | undefined;

    if (format === "khao-sat" || format === "unknown") {
      textRaw = getCol(
        raw,
        "y_kien_them",
        "noi_dung",
        "text",
        "comment",
        "content",
      );
      deHieu = parseScore(
        getCol(raw, "de_hieu_1_5", "de_hieu", "comprehension"),
      );
      nhipDo = parseScore(getCol(raw, "nhip_do_1_5", "nhip_do", "pace"));
      channel = "khao-sat";
    }

    if (format === "binh-luan") {
      textRaw = getCol(
        raw,
        "noi_dung",
        "text",
        "comment",
        "content",
        "y_kien_them",
      );
      channel = "binh-luan";
    }

    // Làm sạch sơ bộ text: strip invisible chars và normalize Unicode
    const { cleanText } = stripInvisibleChars(textRaw);
    const sanitizedText = normalizeUnicodeNfc(cleanText).trim();

    // Bỏ qua dòng không có nội dung VÀ không có điểm
    if (!sanitizedText && deHieu == null && nhipDo == null) {
      warnings.push({
        row: rowNum,
        message:
          "Không có nội dung góp ý và không có điểm số — bỏ qua dòng này",
      });
      continue;
    }

    const fb: CsvFeedbackRow = {
      rowKey,
      sourceRef,
      channel,
      sender,
      text: sanitizedText,
      ...(time ? { time } : {}),
      ...(deHieu != null || nhipDo != null
        ? { survey: { deHieu, nhipDo } }
        : {}),
    };

    rows.push(fb);
  }

  return {
    rows,
    format,
    totalRows: dataRowCount,
    warnings,
  };
}
