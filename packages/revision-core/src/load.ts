import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  AnalyzeInput,
  FeedbackItem,
  NewFeedbackInput,
  ScriptData,
  SentenceData,
} from "./types";
import { sanitizeFeedbackItem } from "./sanitize";
import type { RevisionStore } from "./store";
import { getDefaultStore } from "./store";

export function getDataDir(store: RevisionStore = getDefaultStore()): string {
  return store.getPackDir();
}

function readFileContent(
  packTarget: string | RevisionStore,
  filename: string,
): string {
  if (typeof packTarget === "string") {
    const p = join(packTarget, filename);
    if (!existsSync(p)) {
      throw new Error(`File không tồn tại: ${p}`);
    }
    return readFileSync(p, "utf-8");
  }
  return packTarget.readPackFile(filename);
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);

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

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length !== 2) return 0;
  const minutes = parseFloat(parts[0]);
  const seconds = parseFloat(parts[1]);
  return Math.round((minutes * 60 + seconds) * 10) / 10;
}

export function loadScriptD1(
  packTarget: string | RevisionStore = getDefaultStore(),
): ScriptData {
  const scriptContent = readFileContent(packTarget, "kich-ban-d1.json");
  const timecodeContent = readFileContent(packTarget, "cau-timecode-d1.csv");

  const rawScript = JSON.parse(scriptContent);
  const timecodeRows = parseCsv(timecodeContent);

  const timecodeByN = new Map<
    number,
    { batDau: number; ketThucTieng: number; ketThuc: number; loiCsv?: string }
  >();

  for (const row of timecodeRows) {
    const n = parseInt(row.cau || row.n, 10);
    if (!isNaN(n)) {
      const batDau = timeToSeconds(row.batDau || "00:00.0");
      const ketThucTieng = timeToSeconds(
        row.ketThucTieng || row.batDau || "00:00.0",
      );
      const ketThuc = timeToSeconds(
        row.ketThuc || row.ketThucTieng || "00:00.0",
      );
      timecodeByN.set(n, {
        batDau,
        ketThucTieng,
        ketThuc,
        loiCsv: row.loi,
      });
    }
  }

  // Kiểm tra C3-IN-01
  const sentences: SentenceData[] = [];
  let lastN = 0;

  for (const c of rawScript.cau) {
    const n = c.n;
    if (typeof n !== "number" || n <= lastN) {
      throw new Error(
        `C3-IN-01 Lỗi cấu trúc kịch bản: số câu n không tăng dần (câu ${n}, câu trước ${lastN})`,
      );
    }
    lastN = n;

    const hasLoi = typeof c.loi === "string" && c.loi.length > 0;
    const hasDung = typeof c.dungGiay === "number" && c.dungGiay > 0;

    if (hasLoi && hasDung) {
      throw new Error(
        `C3-IN-01 Lỗi cấu trúc: câu ${n} có cả lời lẫn khoảng lặng dừng giây`,
      );
    }
    if (!hasLoi && !hasDung) {
      throw new Error(
        `C3-IN-01 Lỗi cấu trúc: câu ${n} thiếu cả lời lẫn khoảng lặng dừng giây`,
      );
    }

    const tc = timecodeByN.get(n);
    if (!tc) {
      throw new Error(
        `C3-IN-01 Lỗi cấu trúc: câu ${n} không có mốc thời gian trong timecode`,
      );
    }

    if (!(tc.batDau <= tc.ketThucTieng && tc.ketThucTieng <= tc.ketThuc)) {
      throw new Error(
        `C3-IN-01 Lỗi cấu trúc: mốc câu ${n} vi phạm start <= speechEnd <= sceneEnd (${tc.batDau} <= ${tc.ketThucTieng} <= ${tc.ketThuc})`,
      );
    }

    const loi = hasLoi ? (c.loi as string) : undefined;
    const dungGiay = hasDung ? (c.dungGiay as number) : undefined;

    sentences.push({
      n,
      phan: c.phan,
      kieu: c.kieu,
      loi,
      dungGiay,
      chuTrenManHinh: c.chuTrenManHinh,
      yDoHinh: c.yDoHinh,
      batDauGiay: tc.batDau,
      ketThucTiengGiay: tc.ketThucTieng,
      ketThucGiay: tc.ketThuc,
      soKyTu: loi ? Array.from(loi.normalize("NFC")).length : 0,
    });
  }

  if (sentences.length !== timecodeRows.length) {
    throw new Error(
      `C3-IN-01 Lỗi cấu trúc: số câu kịch bản (${sentences.length}) khác số dòng timecode (${timecodeRows.length})`,
    );
  }

  return {
    id: rawScript.id || "d1",
    tieuDe: rawScript.tieuDe || "Bài học D1",
    mucTieu: rawScript.mucTieu || "",
    thoiLuongDuKienGiay: rawScript.thoiLuongDuKienGiay || 251,
    phan: rawScript.phan || [],
    cau: sentences,
  };
}

export function loadD1RawFeedback(
  packTarget: string | RevisionStore = getDefaultStore(),
): FeedbackItem[] {
  let gopYList: any[] = [];
  try {
    const raw = JSON.parse(readFileContent(packTarget, "gop-y-mau.json"));
    gopYList = raw.gopY || [];
  } catch {}

  let khaoSatRows: any[] = [];
  try {
    khaoSatRows = parseCsv(readFileContent(packTarget, "khao-sat-mau.csv"));
  } catch {}

  const khaoSatMap = new Map<string, any>();
  for (const r of khaoSatRows) {
    khaoSatMap.set(r.ma_gop_y || r.id, r);
  }

  const combinedItems: FeedbackItem[] = [];
  const processedIds = new Set<string>();

  // 1. Duyệt qua 18 mục trong gop-y-mau.json
  for (const gy of gopYList) {
    processedIds.add(gy.id);
    const ks = khaoSatMap.get(gy.id);

    const deHieu = ks ? parseInt(ks.de_hieu_1_5, 10) : undefined;
    const nhipDo = ks ? parseInt(ks.nhip_do_1_5, 10) : undefined;
    const diemSo = gy.diemSo ?? deHieu;

    const item = sanitizeFeedbackItem({
      id: gy.id,
      channel: gy.kenh || "binh-luan",
      sender: gy.nguoiGui,
      text: gy.noiDung || "",
      time: gy.thoiDiem,
      survey: {
        deHieu: isNaN(deHieu!) ? undefined : deHieu,
        nhipDo: isNaN(nhipDo!) ? undefined : nhipDo,
        diemSo: isNaN(diemSo!) ? undefined : diemSo,
      },
    });

    combinedItems.push(item);
  }

  // 2. Duyệt các dòng chỉ có trong khao-sat-mau.csv
  for (const ks of khaoSatRows) {
    const id = ks.ma_gop_y || ks.id;
    if (!processedIds.has(id)) {
      processedIds.add(id);
      const deHieu = parseInt(ks.de_hieu_1_5, 10);
      const nhipDo = parseInt(ks.nhip_do_1_5, 10);

      const item = sanitizeFeedbackItem({
        id,
        channel: "khao-sat",
        sender: ks.nguoi_gui,
        text: ks.y_kien_them || "",
        time: ks.thoi_diem
          ? ks.thoi_diem.replace(" ", "T") + ":00+07:00"
          : undefined,
        survey: {
          deHieu: isNaN(deHieu) ? undefined : deHieu,
          nhipDo: isNaN(nhipDo) ? undefined : nhipDo,
          diemSo: isNaN(deHieu) ? undefined : deHieu,
        },
      });

      combinedItems.push(item);
    }
  }

  return combinedItems.sort((a, b) => a.id.localeCompare(b.id));
}

function validateSurvey(
  survey: NewFeedbackInput["survey"],
): FeedbackItem["survey"] | undefined {
  if (!survey) return undefined;
  const check = (v: number | undefined, name: string) => {
    if (v === undefined || v === null) return undefined;
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      throw new Error(`C3-IN-03 Điểm ${name} phải là số nguyên 1–5`);
    }
    return v;
  };
  const deHieu = check(survey.deHieu, "dễ hiểu");
  const nhipDo = check(survey.nhipDo, "nhịp độ");
  if (deHieu === undefined && nhipDo === undefined) return undefined;
  return { deHieu, nhipDo, diemSo: deHieu };
}

function validateLocation(
  location: NewFeedbackInput["location"],
  script: ScriptData,
): FeedbackItem["location"] | undefined {
  if (!location) return undefined;
  const { sentenceN, timeSeconds } = location;
  const lastEnd = script.cau.at(-1)?.ketThucGiay ?? 0;
  if (sentenceN != null && !script.cau.some((c) => c.n === sentenceN)) {
    throw new Error(`C3-IN-03 Câu ${sentenceN} không có trong kịch bản`);
  }
  if (timeSeconds != null && (timeSeconds < 0 || timeSeconds > lastEnd)) {
    throw new Error(
      `C3-IN-03 Mốc ${timeSeconds} giây nằm ngoài thời lượng video (0–${lastEnd})`,
    );
  }
  if (sentenceN == null && timeSeconds == null) return undefined;
  return {
    sentenceN: sentenceN ?? undefined,
    timeSeconds: timeSeconds ?? undefined,
  };
}

export function buildNewFeedbackItems(
  items: NewFeedbackInput[],
  script: ScriptData,
  idPrefix: string,
  startAt = 1,
): FeedbackItem[] {
  let counter = startAt;
  return items.map((item) => {
    const text = (item.text || "").trim();
    const survey = validateSurvey(item.survey);
    const surveyOnly = item.channel === "khao-sat" && survey !== undefined;
    if ((text.length < 1 && !surveyOnly) || text.length > 2000) {
      throw new Error(
        `C3-IN-03 Nội dung góp ý mới phải từ 1 đến 2000 ký tự (hiện có ${text.length} ký tự)`,
      );
    }
    const location = validateLocation(item.location, script);
    const sanitized = sanitizeFeedbackItem({
      id: item.id || `${idPrefix}-${counter++}`,
      channel: item.channel || "binh-luan",
      sender: item.sender,
      text,
      time: item.time,
      survey,
    });
    const withSource = item.sourceRef
      ? { ...sanitized, sourceRef: item.sourceRef }
      : sanitized;
    return location ? { ...withSource, location } : withSource;
  });
}

export function prepareAnalyzeInput(
  input: AnalyzeInput,
  packTarget: string | RevisionStore = getDefaultStore(),
  storedFeedback: FeedbackItem[] = [],
): {
  script: ScriptData;
  allFeedback: FeedbackItem[];
  feedbackForModel: FeedbackItem[];
  inputHash: string;
} {
  const script = loadScriptD1(packTarget);
  const allFeedback: FeedbackItem[] = [];

  // 1. Nạp D1 nếu bật
  if (input.includeD1Feedback) {
    const d1Items = loadD1RawFeedback(packTarget);
    if (input.feedbackIds && input.feedbackIds.length > 0) {
      allFeedback.push(
        ...d1Items.filter((f) => input.feedbackIds!.includes(f.id)),
      );
    } else {
      allFeedback.push(...d1Items);
    }
  }

  // 2. Kiểm tra giới hạn C3-IN-04
  const newItems = input.newFeedback || [];
  if (newItems.length > 20) {
    throw new Error(
      `C3-IN-04 Giới hạn mỗi run: tối đa 20 góp ý mới (hiện có ${newItems.length})`,
    );
  }

  // 3. Xử lý góp ý mới C3-IN-03
  allFeedback.push(...buildNewFeedbackItems(newItems, script, "moi"));

  // 3b. Góp ý đã lưu cùng video
  allFeedback.push(...storedFeedback);

  if (allFeedback.length > 60) {
    throw new Error(
      `C3-IN-04 Giới hạn mỗi run: tối đa 60 góp ý (hiện có ${allFeedback.length})`,
    );
  }

  // 4. Lọc danh sách gửi model
  const feedbackForModel = allFeedback.filter(
    (f) => !f.isQuarantined && f.label !== "chi-cham-diem",
  );

  // 5. Tính inputHash C3-IN-05
  const normalizedFeedbackList = allFeedback.map((f) => ({
    id: f.id,
    channel: f.channel,
    sender: f.sender,
    text: f.sanitizedText,
    survey: f.survey ?? null,
    location: f.location ?? null,
  }));

  const hashPayload = {
    videoId: input.videoId ?? script.id,
    versionId: input.versionId ?? "v1",
    scriptId: script.id,
    scriptSentenceCount: script.cau.length,
    feedback: normalizedFeedbackList.sort((a, b) => a.id.localeCompare(b.id)),
  };

  const inputHash = createHash("sha256")
    .update(JSON.stringify(hashPayload))
    .digest("hex");

  return {
    script,
    allFeedback,
    feedbackForModel,
    inputHash,
  };
}
