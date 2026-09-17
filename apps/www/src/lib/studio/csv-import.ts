/**
 * CSV import utility cho tab Góp ý.
 * Hỗ trợ 2 format:
 *  - Khảo sát: ma_gop_y, nguoi_gui, de_hieu_1_5, nhip_do_1_5, y_kien_them
 *  - Bình luận thô: id, nguoi_gui, noi_dung (+ các alias tiếng Anh)
 */

import type { NewFeedbackInput } from "@/lib/revision/types";

/** Một dòng đọc được từ CSV; nhãn, cách ly và mã góp ý do server gán khi lưu. */
export interface CsvFeedbackRow extends NewFeedbackInput {
  /** Chỉ để hiển thị xem trước, không gửi lên server. */
  rowKey: string;
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
}

// ─── CSV parser (ô trong ngoặc kép được chứa dấu phẩy và xuống dòng) ────────

function splitCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(current.trim());
      current = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
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

function parseCsvText(text: string): Array<Record<string, string>> {
  const records = splitCsvRecords(text.replace(/^\uFEFF/, ""));
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

function detectFormat(headers: string[]): CsvFormat {
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
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1 || n > 5) return undefined;
  return n;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function parseSurveyCsv(csvText: string): CsvParseResult {
  const rawRows = parseCsvText(csvText);
  if (rawRows.length === 0) {
    return { rows: [], format: "unknown", totalRows: 0, warnings: [] };
  }

  const headers = Object.keys(rawRows[0]);
  const format = detectFormat(headers);
  const warnings: CsvRowWarning[] = [];
  const rows: CsvFeedbackRow[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2; // +2 vì row 1 là header

    const rowKey = getCol(raw, "ma_gop_y", "id", "ma_id") || `dong-${rowNum}`;

    const sender =
      getCol(raw, "nguoi_gui", "sender", "nguoi_hoc", "user") ||
      `ng-csv-${idx + 1}`;

    const timeRaw = getCol(raw, "thoi_diem", "created_at", "time", "ngay");
    let time: string | undefined;
    if (timeRaw) {
      const d = new Date(timeRaw.replace(" ", "T"));
      if (!Number.isNaN(d.getTime())) time = d.toISOString();
    }

    let sanitizedText = "";
    let channel: CsvFeedbackRow["channel"] = "khao-sat";
    let deHieu: number | undefined;
    let nhipDo: number | undefined;

    if (format === "khao-sat" || format === "unknown") {
      sanitizedText = getCol(
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
      sanitizedText = getCol(
        raw,
        "noi_dung",
        "text",
        "comment",
        "content",
        "y_kien_them",
      );
      channel = "binh-luan";
    }

    // Bỏ qua dòng không có nội dung VÀ không có điểm
    if (!sanitizedText && deHieu == null && nhipDo == null) {
      warnings.push({
        row: rowNum,
        message:
          "Không có nội dung góp ý và không có điểm số — bỏ qua dòng này",
      });
      return;
    }

    const fb: CsvFeedbackRow = {
      rowKey,
      channel,
      sender,
      text: sanitizedText,
      ...(time ? { time } : {}),
      ...(deHieu != null || nhipDo != null
        ? { survey: { deHieu, nhipDo } }
        : {}),
    };

    rows.push(fb);
  });

  return {
    rows,
    format,
    totalRows: rawRows.length,
    warnings,
  };
}
