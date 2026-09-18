import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  resolveRevisionModelId,
  type RevisionAgentConfig,
} from "@feedback/ai/agents/revision";
import type {
  AnalyzeInput,
  FeedbackItem,
  RevisionBrief,
  RevisionRunResult,
  RunMetadata,
} from "../types";
import { prepareAnalyzeInput } from "../load";
import { generateRunId } from "../trace";
import { appendRunEvent, saveNodeDebugData } from "../events";
import { getDefaultStore, type RevisionStore } from "../store";
import { getOrBuildVideoIndex } from "../video-index/cache";
import { moderateFeedbackBatch } from "../moderation";
import { splitFeedbackToClaims } from "../claims/split";
import { localizeClaim } from "../localize";
import { formIssues } from "../issues/form";
import { routeAllIssues } from "../handlers/router";
import { planRevision } from "../planner/plan";
import { judgeAllWorkItems } from "../planner/judge";
import { buildRevisionBrief } from "../planner/brief";
import { GRAPH_VERSION_V3 } from "./graph-v3";
import {
  registerActiveRun,
  unregisterActiveRun,
  updateRunStatus,
  type PipelineDeps,
} from "./run";
import type { Claim, Localization } from "../claims/types";
import type { HandlerQuestion } from "../handlers/types";

export interface RunV3Input extends AnalyzeInput {
  graphVersion?: string;
  nganSach?: {
    cauThuLai: number;
    deltaTongGiay: number;
  };
  mode?: "k1" | "k2";
  previousRunId?: string;
}

export interface RunV3Output {
  runId: string;
  status: "xong" | "loi" | "da-huy";
  brief: RevisionBrief;
  videoIndex: any;
}

/**
 * Điều phối toàn bộ quy trình Revision Planner V3 (revision@3)
 */
export async function runRevisionV3(
  input: RunV3Input,
  deps: PipelineDeps = {},
): Promise<RunV3Output> {
  const store = deps.store || getDefaultStore();
  const runId = generateRunId();
  const startTime = Date.now();

  const abortController = new AbortController();
  const signal = abortController.signal;

  const videoId = input.videoId || "d1";
  const versionId = input.versionId || "v1";

  registerActiveRun(runId, {
    runId,
    abortController,
    startedAt: startTime,
    videoId,
    versionId,
  });

  try {
    // 1. Khởi tạo Run & Sự kiện bắt đầu
    appendRunEvent(
      runId,
      {
        type: "run.started",
        runId,
        videoId,
        versionId,
        graphVersion: GRAPH_VERSION_V3,
      },
      undefined,
      store,
    );

    const canhBao: string[] = [];
    const {
      script,
      allFeedback: rawFeedbackList,
      inputHash,
    } = prepareAnalyzeInput(input, store, deps.storedFeedback, {
      onWarning: (msg) => canhBao.push(msg),
    });

    if (rawFeedbackList.length === 0) {
      const errMsg = "Không có góp ý nào để phân tích (tổng số góp ý = 0)";
      canhBao.push(errMsg);
      appendRunEvent(
        runId,
        {
          type: "run.failed",
          errorCode: "NO_FEEDBACK",
          message: errMsg,
        },
        undefined,
        store,
      );
      updateRunStatus(runId, "loi");
      unregisterActiveRun(runId);
      return {
        runId,
        status: "loi",
        brief: {
          canhBao,
          pheu: {
            gopY: 0,
            cachLy: 0,
            choDuyet: 0,
            y: 0,
            vanDe: 0,
            theoNhom: {},
            deXuat: 0,
            quaThamDinh: 0,
          },
          viec: [],
          cauHoi: [],
          ghiNhan: [],
          vungBaoVe: [],
          keHoach: {
            thuLai: [],
            kyTuThuLai: 0,
            canhDungLai: [],
            trangPhuDe: 0,
            deltaTong: 0,
            mocV2: [],
            chuong: [],
            viPham: [],
            chongLan: [],
            soVoiLamLaiToanBo: { kyTu: 0, canh: 0 },
          },
          nganSach: input.nganSach || { cauThuLai: 8, deltaTongGiay: 10 },
        },
        videoIndex: null,
      };
    }

    let timecodeCsvText: string;
    try {
      timecodeCsvText = store.readPackFile("cau-timecode-d1.csv");
    } catch (err: any) {
      throw new Error(
        `TIMECODE_MISSING: Thiếu file timecode bắt buộc: ${err.message}`,
      );
    }

    let transcriptText: string | undefined;
    try {
      transcriptText = store.readPackFile("transcript-d1.txt");
    } catch (err: any) {
      canhBao.push(`Thiếu file transcript: ${err.message}`);
    }

    let slideJsonText: string | undefined;
    try {
      slideJsonText = store.readPackFile("slide-d1.json");
    } catch (err: any) {
      canhBao.push(`Thiếu file slide: ${err.message}`);
    }

    let videoFilePath: string | undefined;
    const candidateVideo = join(store.getPackDir(), "video-mau", "d1.mp4");
    if (existsSync(candidateVideo)) {
      videoFilePath = candidateVideo;
    }

    // 2. Node 1: chi-muc-video
    const node1Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "chi-muc-video",
        nodeType: "chi-muc-video",
        attempt: 1,
      },
      undefined,
      store,
    );

    const videoIndex = getOrBuildVideoIndex(
      {
        videoId,
        versionId,
        script,
        timecodeCsvText,
        transcriptText,
        slideJsonText,
        videoFilePath,
      },
      store,
    );

    saveNodeDebugData(
      runId,
      {
        nodeId: "chi-muc-video",
        nodeType: "chi-muc-video",
        status: "xong",
        ms: Date.now() - node1Start,
        attempts: 1,
        input: { videoId, versionId },
        output: {
          segmentsCount: videoIndex.segments.length,
          duration: videoIndex.tongThoiLuong,
        },
      },
      store,
    );

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "chi-muc-video",
        status: "xong",
        ms: Date.now() - node1Start,
        summary: `Đã nạp chỉ mục video gồm ${videoIndex.segments.length} câu`,
      },
      undefined,
      store,
    );

    if (signal.aborted) throw new Error("RUN_CANCELLED");

    // 3. Node 2: cong-an-toan (Kiểm duyệt & Quét PII)
    const node2Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "cong-an-toan",
        nodeType: "cong-an-toan",
        attempt: 1,
      },
      undefined,
      store,
    );

    const modResults = await moderateFeedbackBatch(
      rawFeedbackList.map((f) => ({
        id: f.id,
        sender: f.sender || "nguoi-dung",
        rawText: f.rawText || f.sanitizedText || "",
      })),
      {
        model: (deps as any)?.model,
        onWarning: (msg) => canhBao.push(msg),
      },
    );

    const safeFeedback: FeedbackItem[] = [];
    const quarantinedFeedback: FeedbackItem[] = [];

    for (let i = 0; i < rawFeedbackList.length; i++) {
      const item = rawFeedbackList[i];
      const mod = modResults[i];
      const isQuar = mod?.isQuarantined || item.isQuarantined;

      let mappedLabel = item.label;
      if (mod?.label) {
        switch (mod.label) {
          case "an-toan":
          case "tho-tuc-noi-dung":
            mappedLabel = item.label || "gop-y";
            break;
          case "cong-kich-ca-nhan":
            mappedLabel = "cong-kich";
            break;
          case "cai-lenh":
            mappedLabel = "cai-lenh";
            break;
          case "co-pii":
          case "rui-ro-rieng-tu-trong-video":
            mappedLabel = "thong-tin-ca-nhan";
            break;
          case "spam":
          case "lac-de":
          case "chi-cam-xuc":
            mappedLabel = "bo-qua";
            break;
          default:
            mappedLabel = item.label || "gop-y";
        }
      }

      const sanitized: FeedbackItem = {
        ...item,
        isQuarantined: isQuar,
        quarantineReason: isQuar
          ? mod?.quarantineReason ||
            item.quarantineReason ||
            "Nội dung không hợp lệ"
          : undefined,
        sanitizedText: mod?.displayContent || item.sanitizedText,
        label: mappedLabel,
      };

      if (isQuar) {
        quarantinedFeedback.push(sanitized);
      } else {
        safeFeedback.push(sanitized);
      }
    }

    saveNodeDebugData(
      runId,
      {
        nodeId: "cong-an-toan",
        nodeType: "cong-an-toan",
        status: "xong",
        ms: Date.now() - node2Start,
        attempts: 1,
        input: { total: rawFeedbackList.length },
        output: {
          total: rawFeedbackList.length,
          safe: safeFeedback.length,
          quarantined: quarantinedFeedback.length,
        },
      },
      store,
    );

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "cong-an-toan",
        status: "xong",
        ms: Date.now() - node2Start,
        summary: `Cổng an toàn: ${safeFeedback.length} hợp lệ, ${quarantinedFeedback.length} cách ly`,
      },
      undefined,
      store,
    );

    if (signal.aborted) throw new Error("RUN_CANCELLED");

    // 4. Node 3: tach-y (Tách ý & Intent)
    const node3Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "tach-y",
        nodeType: "tach-y",
        attempt: 1,
      },
      undefined,
      store,
    );

    const claims: Claim[] = [];
    for (const item of safeFeedback) {
      const itemClaims = splitFeedbackToClaims(item);
      claims.push(...itemClaims);
    }

    appendRunEvent(
      runId,
      {
        type: "partial",
        kind: "claims.ready",
        payload: claims,
      },
      undefined,
      store,
    );

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "tach-y",
        status: "xong",
        ms: Date.now() - node3Start,
        summary: `Đã trích xuất ${claims.length} ý kiến cụ thể`,
      },
      undefined,
      store,
    );

    if (signal.aborted) throw new Error("RUN_CANCELLED");

    // 5. Node 4: dinh-vi (Định vị lai & CRAG)
    const node4Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "dinh-vi",
        nodeType: "dinh-vi",
        attempt: 1,
      },
      undefined,
      store,
    );

    const localizations = new Map<string, Localization>();
    for (const cl of claims) {
      const loc = await localizeClaim(cl, videoIndex, {
        mode: input.mode || "k2",
      });
      localizations.set(cl.id, loc);
    }

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "dinh-vi",
        status: "xong",
        ms: Date.now() - node4Start,
        summary: `Đã định vị ${localizations.size} ý kiến trên dòng thời gian`,
      },
      undefined,
      store,
    );

    if (signal.aborted) throw new Error("RUN_CANCELLED");

    // 6. Node 5: kiem-chung & Node 6: gom-van-de
    const node6Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "gom-van-de",
        nodeType: "gom-van-de",
        attempt: 1,
      },
      undefined,
      store,
    );

    const issuesResult = formIssues(claims, localizations, videoIndex);
    const { issues, vungBaoVe } = issuesResult;

    appendRunEvent(
      runId,
      {
        type: "partial",
        kind: "issues.ready",
        payload: issues,
      },
      undefined,
      store,
    );

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "gom-van-de",
        status: "xong",
        ms: Date.now() - node6Start,
        summary: `Gom thành ${issues.length} vấn đề sư phạm & ${vungBaoVe.length} vùng bảo vệ`,
      },
      undefined,
      store,
    );

    if (signal.aborted) throw new Error("RUN_CANCELLED");

    // 7. Node 7: dinh-tuyen & Node 8: bo-xu-ly
    const node7Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "dinh-tuyen",
        nodeType: "dinh-tuyen",
        attempt: 1,
      },
      undefined,
      store,
    );

    const handlerResults = await routeAllIssues(issues, videoIndex, {
      claims,
      vungBaoVe,
      nganSach: input.nganSach,
      mode: input.mode || "k2",
      signal,
    });

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "dinh-tuyen",
        status: "xong",
        ms: Date.now() - node7Start,
        summary: `Đã định tuyến và giải quyết ${handlerResults.length} đề xuất`,
      },
      undefined,
      store,
    );

    if (signal.aborted) throw new Error("RUN_CANCELLED");

    // 8. Node 9: lap-ke-hoach & dong-co-thoi-gian
    const node9Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "lap-ke-hoach",
        nodeType: "lap-ke-hoach",
        attempt: 1,
      },
      undefined,
      store,
    );

    const planResult = planRevision({
      videoIndex,
      handlerResults,
      issues,
      vungBaoVe,
      nganSach: input.nganSach,
    });

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "lap-ke-hoach",
        status: "xong",
        ms: Date.now() - node9Start,
        summary: `Tối ưu ngân sách: ${planResult.keHoachToanCuc.thuLai.length} câu thu lại (${planResult.keHoachToanCuc.kyTuThuLai} ký tự)`,
      },
      undefined,
      store,
    );

    // 9. Node 10: tham-dinh
    const node10Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "tham-dinh",
        nodeType: "tham-dinh",
        attempt: 1,
      },
      undefined,
      store,
    );

    const judgeResults = await judgeAllWorkItems({
      workItems: planResult.viecDuocChon,
      issues,
      videoIndex,
      signal,
    });

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "tham-dinh",
        status: "xong",
        ms: Date.now() - node10Start,
        summary: `Đã thẩm định ${judgeResults.size} đề xuất`,
      },
      undefined,
      store,
    );

    // 10. Node 11: tong-hop-brief
    const node11Start = Date.now();
    appendRunEvent(
      runId,
      {
        type: "node.started",
        nodeId: "tong-hop-brief",
        nodeType: "tong-hop-brief",
        attempt: 1,
      },
      undefined,
      store,
    );

    const allQuestions: HandlerQuestion[] = [];
    const allGhiNhan: Array<{ gopYIds: string[]; lyDo: string }> = [];

    for (const hr of handlerResults) {
      if (hr.cauHoi) allQuestions.push(...hr.cauHoi);
      if (hr.ghiNhan) allGhiNhan.push(...hr.ghiNhan);
    }

    const brief = buildRevisionBrief({
      canhBao: canhBao.length > 0 ? canhBao : undefined,
      feedback: rawFeedbackList,
      quarantinedFeedback,
      claims,
      issues,
      planResult,
      questions: allQuestions,
      ghiNhanList: allGhiNhan,
      vungBaoVeList: vungBaoVe,
      judgeResults,
    });

    appendRunEvent(
      runId,
      {
        type: "partial",
        kind: "brief.ready",
        payload: brief,
      },
      undefined,
      store,
    );

    appendRunEvent(
      runId,
      {
        type: "node.finished",
        nodeId: "tong-hop-brief",
        status: "xong",
        ms: Date.now() - node11Start,
        summary: `RevisionBrief đã hoàn thành với ${brief.viec.length} việc cần làm`,
      },
      undefined,
      store,
    );

    // 11. Lưu trữ kết quả và Kết thúc Run
    const totalDuration = Date.now() - startTime;

    const runMeta: RunMetadata = {
      runId,
      status: "xong",
      createdAt: new Date().toISOString(),
      inputHash: "",
      modelId: "gemini-2.5-flash",
      promptVersion: "v3",
      promptHash: "",
      schemaVersion: "v3",
      policyVersion: "v3",
      graphVersion: GRAPH_VERSION_V3,
      attempts: [
        {
          attemptNumber: 1,
          status: "xong",
          durationMs: totalDuration,
        },
      ],
      totalFeedback: rawFeedbackList.length,
      newFeedbackCount: rawFeedbackList.length,
      independentSenders: brief.pheu.vanDe,
      caseCount: brief.viec.length,
      durationMs: totalDuration,
      videoId,
      versionId,
    };

    const runResult: RevisionRunResult = {
      runId,
      inputHash: "",
      script,
      feedback: rawFeedbackList,
      issues: [],
      cases: [],
      validation: {
        findings: [],
        checks: {
          schemaOk: true,
          feedbackCoverageOk: true,
          evidenceOk: true,
          locationsOk: true,
          patchesOk: true,
        },
      },
      unassignedFeedback: [],
      quarantinedFeedback,
      brief,
    };

    store.saveRunTrace({
      runId,
      metadata: runMeta,
      sanitizedInput: input,
      attempts: runMeta.attempts,
      result: runResult,
    });

    appendRunEvent(
      runId,
      {
        type: "run.finished",
        status: "xong",
        ms: totalDuration,
        totalTokens: 0,
      },
      undefined,
      store,
    );

    return {
      runId,
      status: "xong",
      brief,
      videoIndex,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const isCancelled = errorMsg === "RUN_CANCELLED";
    const status = isCancelled ? "da-huy" : "loi";

    updateRunStatus(
      runId,
      status,
      {
        code: isCancelled ? "RUN_CANCELLED" : "PIPELINE_ERROR",
        message: errorMsg,
      },
      store,
    );

    appendRunEvent(
      runId,
      {
        type: "run.failed",
        errorCode: isCancelled ? "RUN_CANCELLED" : "PIPELINE_ERROR",
        message: errorMsg,
      },
      undefined,
      store,
    );

    throw err;
  } finally {
    unregisterActiveRun(runId);
  }
}
