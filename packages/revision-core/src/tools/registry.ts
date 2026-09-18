import { tool } from "ai";
import { z } from "zod";
import type { VideoIndex, SegmentIndex } from "../video-index/types";
import { retrieveCandidates } from "../localize/retrieve";

export interface ToolCallTelemetry {
  name: string;
  ms: number;
  ok: boolean;
  bytes: number;
}

export interface ToolOptions {
  onToolCall?: (event: ToolCallTelemetry) => void;
}

/**
 * 1. find_by_time: Tìm các câu giao nhau với mốc thời gian
 */
export function findByTimeFn(videoIndex: VideoIndex, tu: number, den?: number) {
  const start = tu;
  const end = den !== undefined && den >= tu ? den : tu;
  const segments = videoIndex.segments || [];

  const matches: Array<{
    n: number;
    batDau: number;
    ketThuc: number;
    phanGiaoGiay: number;
    tyLeGiao: number;
    loi: string;
  }> = [];

  for (const seg of segments) {
    // Trường hợp điểm thời gian tức thời
    if (start === end) {
      if (seg.batDau <= start && start <= seg.ketThuc) {
        matches.push({
          n: seg.n,
          batDau: seg.batDau,
          ketThuc: seg.ketThuc,
          phanGiaoGiay: seg.ketThuc - seg.batDau,
          tyLeGiao: 1.0,
          loi: seg.loi || "",
        });
      }
      continue;
    }

    // Trường hợp khoảng thời gian [start, end]
    const overlapStart = Math.max(seg.batDau, start);
    const overlapEnd = Math.min(seg.ketThuc, end);
    const overlap = Math.max(0, overlapEnd - overlapStart);

    if (overlap > 0) {
      const segDuration = seg.ketThuc - seg.batDau;
      const tyLeGiao = segDuration > 0 ? overlap / segDuration : 1.0;
      matches.push({
        n: seg.n,
        batDau: seg.batDau,
        ketThuc: seg.ketThuc,
        phanGiaoGiay: Number(overlap.toFixed(2)),
        tyLeGiao: Number(tyLeGiao.toFixed(2)),
        loi: seg.loi || "",
      });
    }
  }

  return {
    khoangTim: [start, end],
    soLuong: matches.length,
    ketQua: matches,
  };
}

/**
 * 2. search_segments: Tìm kiếm BM25 trên nội dung video
 */
export function searchSegmentsFn(
  videoIndex: VideoIndex,
  query: string,
  topK = 5,
) {
  const candidates = retrieveCandidates(query, videoIndex, topK);
  return {
    query,
    soLuong: candidates.length,
    ungVien: candidates.map((c) => ({
      n: c.n,
      diem: c.diem,
      lyDo: c.lyDo,
      phanTen: c.segment.phanTen,
      batDau: c.segment.batDau,
      ketThuc: c.segment.ketThuc,
      loi: c.segment.loi,
      chuTrenManHinh: c.segment.chuTrenManHinh,
      yDoHinh: c.segment.yDoHinh,
    })),
  };
}

/**
 * 3. get_segment: Lấy chi tiết câu và ngữ cảnh lân cận
 */
export function getSegmentFn(videoIndex: VideoIndex, n: number, lanCan = 0) {
  const segments = videoIndex.segments || [];
  const minN = Math.max(1, n - lanCan);
  const maxN = Math.min(segments.length, n + lanCan);

  const matched = segments.filter((s) => s.n >= minN && s.n <= maxN);
  const target = segments.find((s) => s.n === n);

  return {
    cauChinh: target || null,
    lanCan: matched,
    slideChains:
      videoIndex.slideChains?.filter((sc) => sc.cau.includes(n)) || [],
    audioKhoangCachDb: target?.amThanh?.khoangCachDb,
  };
}

/**
 * 4. glossary: Tra cứu thuật ngữ chuyên môn
 */
export function glossaryFn(videoIndex: VideoIndex, term?: string) {
  const list = videoIndex.glossary || [];
  if (!term || term.trim() === "") {
    return { tongSo: list.length, danhSach: list };
  }

  const norm = term.toLowerCase().trim();
  const matched = list.filter((g) => g.thuatNgu.toLowerCase().includes(norm));
  return {
    timKiem: term,
    soLuong: matched.length,
    ketQua: matched,
  };
}

/**
 * Bộ tạo công cụ (Tools Registry) tương thích hoàn toàn với AI SDK
 */
export function createRevisionTools(
  videoIndex: VideoIndex,
  options?: ToolOptions,
) {
  const wrap = <TIn, TOut>(name: string, fn: (input: TIn) => TOut) => {
    return async (input: TIn): Promise<TOut> => {
      const t0 = performance.now();
      let ok = true;
      try {
        const result = fn(input);
        const ms = Math.round(performance.now() - t0);
        const bytes = Buffer.byteLength(JSON.stringify(result));
        options?.onToolCall?.({ name, ms, ok: true, bytes });
        return result;
      } catch (err) {
        ok = false;
        const ms = Math.round(performance.now() - t0);
        options?.onToolCall?.({ name, ms, ok: false, bytes: 0 });
        throw err;
      }
    };
  };

  return {
    find_by_time: tool({
      description:
        "Tìm các câu trong video giao với mốc thời gian hoặc khoảng thời gian (giây).",
      parameters: z.object({
        tu: z.number().describe("Mốc thời gian bắt đầu (tính bằng giây)"),
        den: z
          .number()
          .optional()
          .describe(
            "Mốc thời gian kết thúc (tính bằng giây). Bỏ trống nếu là mốc đơn lẻ.",
          ),
      }),
      execute: wrap("find_by_time", ({ tu, den }) =>
        findByTimeFn(videoIndex, tu, den),
      ),
    }),

    search_segments: tool({
      description:
        "Truy xuất danh sách câu khớp nhất với câu hỏi hoặc phản hồi bằng thuật toán BM25 và ngữ nghĩa.",
      parameters: z.object({
        query: z.string().describe("Từ khóa hoặc nội dung cần tìm trong video"),
        topK: z
          .number()
          .optional()
          .default(5)
          .describe("Số lượng ứng viên muốn lấy (mặc định 5)"),
      }),
      execute: wrap("search_segments", ({ query, topK }) =>
        searchSegmentsFn(videoIndex, query, topK),
      ),
    }),

    get_segment: tool({
      description:
        "Lấy thông tin chi tiết của một câu cụ thể (lời thoại, hình ảnh, thời gian, phụ đề, âm thanh) và các câu lân cận.",
      parameters: z.object({
        n: z.number().describe("Số thứ tự câu (1-indexed)"),
        lanCan: z
          .number()
          .optional()
          .default(0)
          .describe(
            "Số câu lân cận trước và sau cần lấy thêm (ví dụ 1 hoặc 2)",
          ),
      }),
      execute: wrap("get_segment", ({ n, lanCan }) =>
        getSegmentFn(videoIndex, n, lanCan),
      ),
    }),

    glossary: tool({
      description:
        "Tra cứu danh mục thuật ngữ chuyên môn của bài giảng, vị trí xuất hiện lần đầu và câu định nghĩa.",
      parameters: z.object({
        term: z
          .string()
          .optional()
          .describe("Thuật ngữ cần tìm kiếm (bỏ trống để lấy toàn bộ)"),
      }),
      execute: wrap("glossary", ({ term }) => glossaryFn(videoIndex, term)),
    }),
  };
}
