/**
 * CSV import utility cho tab Góp ý.
 * Hỗ trợ 2 format:
 *  - Khảo sát: ma_gop_y, nguoi_gui, de_hieu_1_5, nhip_do_1_5, y_kien_them
 *  - Bình luận thô: id, nguoi_gui, noi_dung (+ các alias tiếng Anh)
 */

import type { StudioFeedback } from "@/lib/studio/types";

export type CsvFormat = "khao-sat" | "binh-luan" | "unknown";

export interface CsvRowWarning {
  row: number;
  message: string;
}

export interface CsvParseResult {
  rows: StudioFeedback[];
  format: CsvFormat;
  totalRows: number;
  warnings: CsvRowWarning[];
}

// ─── CSV parser đơn giản (xử lý quoted fields) ─────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
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
  const rows: StudioFeedback[] = [];

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2; // +2 vì row 1 là header

    const id =
      getCol(raw, "ma_gop_y", "id", "ma_id") ||
      `csv-${Date.now().toString(36)}-${idx}`;

    const sender =
      getCol(raw, "nguoi_gui", "sender", "nguoi_hoc", "user") ||
      `ng-csv-${idx + 1}`;

    const timeRaw = getCol(raw, "thoi_diem", "created_at", "time", "ngay");
    let time = new Date().toISOString();
    if (timeRaw) {
      try {
        const normalized = timeRaw.replace(" ", "T");
        const withTz = normalized.includes("+")
          ? normalized
          : `${normalized}:00+07:00`;
        time = new Date(withTz).toISOString();
      } catch {
        // dùng thời điểm hiện tại nếu parse lỗi
      }
    }

    let sanitizedText = "";
    let channel: StudioFeedback["channel"] = "khao-sat";
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

    const fb: StudioFeedback = {
      id,
      channel,
      sender,
      sanitizedText,
      time,
      label: sanitizedText ? "gop-y" : "chi-cham-diem",
      moderationBy: "code",
      isQuarantined: false,
      locationSource: "chua-xac-dinh",
      survey: deHieu != null || nhipDo != null ? { deHieu, nhipDo } : undefined,
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
