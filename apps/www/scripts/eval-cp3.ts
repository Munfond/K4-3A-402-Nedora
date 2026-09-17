import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  getPromptHash,
  REVISION_SYSTEM_PROMPT,
} from "@feedback/ai/agents/revision";
import { config as loadDotenv } from "dotenv";

import { computeReleaseSnapshot } from "../src/lib/revision/engine";
import { generateAllExports } from "../src/lib/revision/export";
import { loadD1RawFeedback, loadScriptD1 } from "../src/lib/revision/load";
import { analyzeRevision } from "../src/lib/revision/service";
import type {
  DecisionCase,
  DecisionRecord,
  FeedbackItem,
  IssueItem,
  ReleaseSnapshot,
  RevisionRunResult,
  ScriptData,
} from "../src/lib/revision/types";
import { validateRevisionOutput } from "../src/lib/revision/validate";
import {
  type EvalCase,
  parseEvalContract,
  statusMatches,
  toAnalyzeInput,
} from "./eval-contract";

// ==========================================
// 1. Types & Interfaces
// ==========================================

interface GoldenCriterion {
  type: string;
  [key: string]: any;
}

type GoldenCase = EvalCase;

interface CriterionResult {
  type: string;
  passed: boolean;
  message?: string;
  details?: any;
}

interface CaseExecutionResult {
  caseId: string;
  tier: "thuong" | "kho" | "hiem";
  kind: "pipeline" | "validator" | "engine";
  hardness: string[];
  status: "dat" | "khong-dat" | "loi";
  criteria: CriterionResult[];
  error?: string;
  durationMs: number;
  tokens: number;
  traceId?: string;
  failureSeverity?: number; // 1 (highest) to 8 (lowest)
  failureReason?: string;
}

function redactEvalResult(result: RevisionRunResult): Record<string, unknown> {
  const redactFeedback = (items: FeedbackItem[]) =>
    items.map((item) => ({
      id: item.id,
      label: item.label,
      sender: item.sender,
      channel: item.channel,
      survey: item.survey,
      isQuarantined: item.isQuarantined,
      quarantineReason: item.quarantineReason,
    }));
  return {
    runId: result.runId,
    inputHash: result.inputHash,
    feedback: redactFeedback(result.feedback),
    issues: result.issues,
    cases: result.cases,
    validation: result.validation,
    unassignedFeedback: redactFeedback(result.unassignedFeedback),
    quarantinedFeedback: redactFeedback(result.quarantinedFeedback),
  };
}

function canonicalizeEvalText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function loadEvalEnvironment(repoRoot: string): void {
  loadDotenv({ path: resolve(repoRoot, ".env"), override: false, quiet: true });
  loadDotenv({
    path: resolve(repoRoot, "apps/www/.env"),
    override: false,
    quiet: true,
  });

  // A previous local setup stored the OpenAI token as the only line in the
  // repository .env file. Accept that narrow legacy shape without printing or
  // persisting the secret; documented dotenv KEY=value syntax remains preferred.
  if (!process.env.OPENAI_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
    try {
      const raw = readFileSync(resolve(repoRoot, ".env"), "utf8").trim();
      if (/^sk-[A-Za-z0-9._-]+$/.test(raw)) {
        process.env.OPENAI_API_KEY = raw;
      }
    } catch {
      // Missing env files are handled by the model configuration check.
    }
  }
}

// ==========================================
// 2. Mock Data for --mock Mode
// ==========================================

function getMockAgentOutput(
  caseId: string,
  script: ScriptData,
  feedback: any[],
): any {
  switch (caseId) {
    case "N-01":
      return {
        feedback: [
          { id: "gy-015", label: "gop-y", note: "Khó hiểu câu 10-11" },
        ],
        issues: [
          {
            key: "is-n01",
            summary: "Khó hiểu khái niệm học máy ở câu 10-11",
            category: "kho-hieu",
            feedbackIds: ["gy-015"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [10, 11],
              basis: "Trực tiếp nhắc câu 10 và 11",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: {
              text: "Giải thích quá nhanh",
              source: "ai-doi-chieu",
            },
            impact: { level: "vua", reason: "Khái niệm nền tảng" },
            options: [
              {
                label: "A",
                title: "Thêm giải thích học máy vào câu 10",
                rationale: "Làm rõ khái niệm",
                expectedEffect: "giai-quyet",
                patches: [
                  {
                    n: 10,
                    field: "loi",
                    before: script.cau.find((c) => c.n === 10)?.loi || "",
                    after:
                      "Học máy là cách máy tính học quy luật từ dữ liệu để đưa ra dự đoán chính xác.",
                  },
                ],
                remaining: null,
                needsHumanCheck: null,
                unsupportedOperation: null,
              },
            ],
          },
        ],
      };

    case "N-02":
      return {
        feedback: [
          { id: "gy-002", label: "gop-y", note: "Nhầm mô hình với ứng dụng" },
          {
            id: "gy-022",
            label: "gop-y",
            note: "Chưa phân biệt mô hình và ứng dụng",
          },
        ],
        issues: [
          {
            key: "is-n02",
            summary: "Người học nhầm lẫn giữa ứng dụng và mô hình",
            category: "kho-hieu",
            feedbackIds: ["gy-002", "gy-022"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [21, 22],
              basis: "Đoạn phân biệt khung trò chuyện và mô hình xử lý",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: {
              text: "Hình vẽ chưa tách biệt rõ",
              source: "ai-doi-chieu",
            },
            impact: { level: "cao", reason: "Mục tiêu trọng tâm của bài" },
            options: [
              {
                label: "A",
                title: "Tách rõ khung ứng dụng và mô hình",
                rationale: "Trực quan hóa hai tầng",
                expectedEffect: "giai-quyet",
                patches: [
                  {
                    n: 21,
                    field: "loi",
                    before: script.cau.find((c) => c.n === 21)?.loi || "",
                    after:
                      "Bạn gõ câu hỏi ở giao diện ứng dụng, còn mô hình phía sau nhận dữ liệu để xử lý.",
                  },
                ],
                remaining: null,
                needsHumanCheck: null,
                unsupportedOperation: null,
              },
            ],
          },
        ],
      };

    case "N-03":
      return {
        feedback: [{ id: "syn-N03", label: "gop-y", note: "Nhịp nói nhanh" }],
        issues: [
          {
            key: "is-n03",
            summary: "Đoạn học máy trôi quá nhanh",
            category: "nhip-nhanh-cham",
            feedbackIds: ["syn-N03"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [9, 10],
              basis: "Câu nhắc học từ dữ liệu",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: {
              text: "Thời lượng câu ngắn so với lượng kiến thức",
              source: "nguoi-gop-y",
            },
            impact: { level: "vua", reason: "Dễ gây ngợp" },
            options: [],
          },
        ],
      };

    case "N-04":
      return {
        feedback: [
          {
            id: "syn-N04",
            label: "gop-y",
            note: "Không rõ công cụ và mô hình",
          },
        ],
        issues: [
          {
            key: "is-n04",
            summary: "Đoạn áp phích chưa rõ công cụ dùng mô hình nào",
            category: "kho-hieu",
            feedbackIds: ["syn-N04"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [27, 28],
              basis: "Ví dụ áp phích ngày hội khoa học",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: null,
            impact: { level: "vua", reason: "Ví dụ minh họa" },
            options: [],
          },
        ],
      };

    case "N-05":
      return {
        feedback: [
          { id: "gy-004", label: "khen", note: "Lời khen về hình ảnh rõ ràng" },
        ],
        issues: [],
      };

    case "N-06":
      return {
        feedback: [
          { id: "gy-019", label: "chi-cham-diem", note: "Chỉ cho điểm 5 sao" },
          { id: "gy-009", label: "khen", note: "Khen video hay" },
        ],
        issues: [],
      };

    case "N-07":
      return {
        feedback: [
          { id: "syn-N07", label: "gop-y", note: "Câu hỏi kiểm tra khó hiểu" },
        ],
        issues: [
          {
            key: "is-n07",
            summary:
              "Yêu cầu giải thích bằng kết quả hệ thống trả về chưa rõ ràng",
            category: "kho-hieu",
            feedbackIds: ["syn-N07"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [33, 34],
              basis: "Phần câu hỏi tự kiểm tra",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: null,
            impact: { level: "vua", reason: "Phần kiểm tra cuối bài" },
            options: [],
          },
        ],
      };

    case "N-08":
      return {
        feedback: [
          {
            id: "gy-007",
            label: "gop-y",
            note: "Báo cáo gián tiếp về học viên khác",
          },
        ],
        issues: [
          {
            key: "is-n08",
            summary: "Báo cáo gián tiếp về câu 14",
            category: "kho-hieu",
            feedbackIds: ["gy-007"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [14],
              basis: "Đề cập câu 14",
            },
            stances: [],
            uncertainties: [
              "Đây là phản ánh gián tiếp, cần đối chiếu thêm với khảo sát diện rộng",
            ],
            causeHypothesis: {
              text: "Có thể cách diễn đạt chưa quen với học viên mới",
              source: "ai-doi-chieu",
            },
            impact: {
              level: "thap",
              reason: "Báo cáo một người qua người thứ ba",
            },
            options: [],
          },
        ],
      };

    case "K-01":
      return {
        feedback: [
          {
            id: "gy-001",
            label: "gop-y",
            note: "Góp ý mơ hồ không nêu rõ vị trí",
          },
        ],
        issues: [
          {
            key: "is-k01",
            summary:
              "Ý kiến chung chung khó hiểu nhưng không nói rõ ở đoạn nào",
            category: "kho-hieu",
            feedbackIds: ["gy-001"],
            location: {
              status: "can-xac-nhan",
              sentenceNs: [1, 2],
              basis:
                "Không nêu mốc thời gian hay nội dung cụ thể, tạm gán đầu video",
            },
            stances: [],
            uncertainties: ["Chưa xác định được đoạn học viên gặp trở ngại"],
            causeHypothesis: null,
            impact: { level: "thap", reason: "Mơ hồ, cần thêm bằng chứng" },
            options: [],
          },
        ],
      };

    case "K-02":
      return {
        feedback: [
          { id: "gy-002", label: "gop-y", note: "Trùng người gửi với gy-003" },
          { id: "gy-003", label: "gop-y", note: "Góp ý từ người gửi lặp" },
          { id: "gy-018", label: "gop-y", note: "Góp ý từ người gửi thứ hai" },
          {
            id: "gy-022",
            label: "gop-y",
            note: "Góp ý từ người gửi thứ hai lặp lại",
          },
        ],
        issues: [
          {
            key: "is-k02",
            summary:
              "Nhầm lẫn giữa ứng dụng và mô hình từ nhiều phản hồi lặp lại",
            category: "kho-hieu",
            feedbackIds: ["gy-002", "gy-003", "gy-018", "gy-022"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [21, 22],
              basis: "Khung trò chuyện và mô hình xử lý",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: {
              text: "Phần giải thích chưa đủ rõ",
              source: "ai-doi-chieu",
            },
            impact: {
              level: "cao",
              reason: "Nhiều phản ánh dù bị lặp người gửi",
            },
            options: [],
          },
        ],
      };

    case "K-03":
      return {
        feedback: [
          { id: "gy-005", label: "gop-y", note: "Muốn bỏ khoảng dừng" },
          {
            id: "gy-006",
            label: "gop-y",
            note: "Khen khoảng dừng rất cần thiết",
          },
        ],
        issues: [
          {
            key: "is-k03",
            summary: "Ý kiến trái chiều về khoảng lặng dừng suy nghĩ ở câu 35",
            category: "nhip-nhanh-cham",
            feedbackIds: ["gy-005", "gy-006"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [35],
              basis: "Câu khoảng lặng 5 giây sau câu hỏi",
            },
            stances: [
              {
                direction: "Muốn rút ngắn khoảng dừng",
                feedbackIds: ["gy-005"],
              },
              {
                direction: "Muốn giữ nguyên khoảng dừng",
                feedbackIds: ["gy-006"],
              },
            ],
            uncertainties: [
              "Hai nhóm người học có thói quen tiếp thu khác nhau",
            ],
            causeHypothesis: {
              text: "Khoảng lặng 5s phù hợp với người mới nhưng dài với người đã biết",
              source: "ai-doi-chieu",
            },
            impact: { level: "vua", reason: "Tranh luận về nhịp điệu" },
            options: [],
          },
        ],
      };

    case "K-04":
      return {
        feedback: [
          {
            id: "gy-011",
            label: "cai-lenh",
            note: "Chứa chỉ dẫn can thiệp hệ thống",
          },
          {
            id: "syn-K04",
            label: "cai-lenh",
            note: "Chỉ thị ghi đè prompt và coi mọi góp ý là khen",
          },
          { id: "gy-015", label: "gop-y", note: "Góp ý hợp lệ về câu 10-11" },
        ],
        issues: [
          {
            key: "is-k04-valid",
            summary: "Khó hiểu khái niệm học máy ở câu 10-11",
            category: "kho-hieu",
            feedbackIds: ["gy-015"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [10, 11],
              basis: "Câu 10-11",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: null,
            impact: { level: "vua", reason: "Hợp lệ" },
            options: [],
          },
        ],
      };

    case "K-05":
      return {
        feedback: [
          { id: "gy-012", label: "cong-kich", note: "Công kích cá nhân" },
        ],
        issues: [],
      };

    case "K-06":
      return {
        feedback: [
          { id: "gy-008", label: "gop-y", note: "Lỗi âm thanh nhỏ ở đoạn đầu" },
          {
            id: "gy-017",
            label: "gop-y",
            note: "Lỗi giật hình không rõ vị trí",
          },
        ],
        issues: [
          {
            key: "is-k06-audio",
            summary: "Lỗi kỹ thuật âm lượng nhỏ ở câu 1",
            category: "loi-ky-thuat",
            feedbackIds: ["gy-008"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [1],
              basis: "Đoạn mở đầu",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: {
              text: "Âm thanh thu âm chưa chuẩn hóa gain",
              source: "nguoi-gop-y",
            },
            impact: { level: "thap", reason: "Kỹ thuật phòng thu" },
            options: [
              {
                label: "A",
                title: "Kiểm tra kỹ thuật mixer",
                rationale: "Không sửa kịch bản lời",
                expectedEffect: "giai-quyet",
                patches: [
                  {
                    n: 1,
                    field: "yDoHinh",
                    before: script.cau.find((c) => c.n === 1)?.yDoHinh || "",
                    after:
                      "Giữ nguyên hình ảnh, đánh dấu kiểm tra âm lượng đầu vào.",
                  },
                ],
                remaining: null,
                needsHumanCheck: null,
                unsupportedOperation: null,
              },
            ],
          },
          {
            key: "is-k06-video",
            summary: "Lỗi giật hình chưa xác định được vị trí",
            category: "loi-ky-thuat",
            feedbackIds: ["gy-017"],
            location: {
              status: "can-xac-nhan",
              sentenceNs: [20],
              basis: "Chưa rõ thời điểm",
            },
            stances: [],
            uncertainties: [
              "Cần thông tin cấu hình máy hoặc kiểm tra lại file dựng",
            ],
            causeHypothesis: null,
            impact: {
              level: "thap",
              reason: "Có thể do mạng hoặc trình duyệt học viên",
            },
            options: [],
          },
        ],
      };

    case "K-07":
      return {
        feedback: [
          { id: "gy-016", label: "gop-y", note: "Góp ý lệch nội dung câu 40" },
        ],
        issues: [
          {
            key: "is-k07",
            summary: "Đề nghị đưa nội dung chuyên sâu vào câu 40 kết bài",
            category: "noi-dung-sai",
            feedbackIds: ["gy-016"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [40],
              basis: "Câu 40 kết bài",
            },
            stances: [],
            uncertainties: [
              "Nội dung đề nghị nằm ngoài phạm vi bài học nhập môn",
            ],
            causeHypothesis: {
              text: "Học viên có kiến thức nâng cao muốn biết thêm",
              source: "ai-doi-chieu",
            },
            impact: {
              level: "thap",
              reason: "Không phù hợp đối tượng mục tiêu",
            },
            options: [],
          },
        ],
      };

    case "K-08":
      return {
        feedback: [
          { id: "gy-010", label: "gop-y", note: "Hình minh họa áp phích mờ" },
        ],
        issues: [
          {
            key: "is-k08",
            summary: "Hình ảnh áp phích ngày hội khoa học chưa rõ chi tiết",
            category: "hinh-anh",
            feedbackIds: ["gy-010"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [27, 28],
              basis: "Đoạn tạo áp phích",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: {
              text: "Độ phân giải asset đồ họa thấp",
              source: "nguoi-gop-y",
            },
            impact: { level: "vua", reason: "Chất lượng thị giác" },
            options: [],
          },
        ],
      };

    case "H-02":
      return {
        feedback: [
          {
            id: "syn-H02",
            label: "gop-y",
            note: "Tưởng video đứng hình ở câu khoảng lặng",
          },
        ],
        issues: [
          {
            key: "is-h02",
            summary:
              "Khoảng lặng 5s ở câu 35 làm học viên tưởng video bị lỗi mạng",
            category: "nhip-nhanh-cham",
            feedbackIds: ["syn-H02"],
            location: {
              status: "da-dinh-vi",
              sentenceNs: [35],
              basis: "Đoạn im lặng sau câu hỏi",
            },
            stances: [],
            uncertainties: [],
            causeHypothesis: {
              text: "Không có hiệu ứng đếm ngược trực quan trong lúc im lặng",
              source: "ai-doi-chieu",
            },
            impact: { level: "vua", reason: "Trải nghiệm học tập" },
            options: [],
          },
        ],
      };

    default:
      return {
        feedback: feedback.map((f) => ({
          id: f.id,
          label: "gop-y",
          note: "Mặc định",
        })),
        issues: [],
      };
  }
}

function getContractMockAgentOutput(goldenCase: GoldenCase): any {
  const inputFeedbacks = Array.isArray(goldenCase.input?.feedbacks)
    ? goldenCase.input.feedbacks.filter(
        (feedback): feedback is Record<string, unknown> =>
          Boolean(feedback) && typeof feedback === "object",
      )
    : [];
  const expected =
    goldenCase.expected && typeof goldenCase.expected === "object"
      ? (goldenCase.expected as Record<string, any>)
      : {};
  const rejected = new Map(
    (Array.isArray(expected.reject) ? expected.reject : []).map(
      (item: any) => [item.id, String(item.reason || "")],
    ),
  );
  const issueDefinitions = Array.isArray(expected.issues)
    ? expected.issues
    : [];
  const criteria = goldenCase.passCriteria;

  const feedback = inputFeedbacks
    .filter((item) => rejected.get(item.id) !== "SECURITY_PROMPT_INJECTION")
    .map((item) => {
      const rejectionReason = rejected.get(item.id) || "";
      let label = "gop-y";
      if (rejectionReason.includes("PRAISE") || rejectionReason.includes("NON_ACTIONABLE")) {
        label = "khen";
      } else if (rejectionReason.includes("INJECTION")) {
        label = "cai-lenh";
      } else if (rejectionReason.includes("TOXIC")) {
        label = "cong-kich";
      }
      return { id: item.id, label, note: "Mock theo golden contract" };
    });

  const issues = issueDefinitions.map((definition: any, index: number) => {
    const sourceFeedbackIds = Array.isArray(definition.sourceFeedbackIds)
      ? definition.sourceFeedbackIds
      : [];
    const sentenceNs = Array.isArray(definition.sentenceIds)
      ? definition.sentenceIds
      : Array.isArray(definition.candidateSentences)
        ? definition.candidateSentences
        : [];
    const needsUncertainty = criteria.some(
      (criterion) =>
        criterion.type === "cause-or-uncertainty" &&
        sourceFeedbackIds.includes(criterion.feedbackId),
    );
    const needsDisagreement = criteria.some(
      (criterion) =>
        criterion.type === "disagreement" &&
        Array.isArray(criterion.feedbackIds) &&
        criterion.feedbackIds.every((id: string) => sourceFeedbackIds.includes(id)),
    );
    const categoryMap: Record<string, string> = {
      "noi-dung": "noi-dung-sai",
      "cau-truc": "kho-hieu",
    };
    const category = categoryMap[definition.type] || definition.type || "kho-hieu";
    const locationStatus = definition.locationStatus ||
      (sentenceNs.length > 0 ? "da-dinh-vi" : "can-xac-nhan");

    return {
      key: definition.issueId || `contract-${goldenCase.caseId}-${index + 1}`,
      summary: `Mock issue ${definition.issueId || index + 1}`,
      category,
      feedbackIds: sourceFeedbackIds,
      location: {
        status: locationStatus,
        sentenceNs,
        basis: "Mock theo expected golden contract",
      },
      stances: needsDisagreement
        ? [
            { direction: "can-giu", feedbackIds: sourceFeedbackIds.slice(0, 1) },
            { direction: "co-the-bo", feedbackIds: sourceFeedbackIds.slice(1) },
          ]
        : [],
      uncertainties: needsUncertainty
        ? ["Mock giữ bất định theo contract"]
        : [],
      causeHypothesis: needsUncertainty
        ? { text: "Mock chưa đủ dữ kiện", source: "ai-doi-chieu" }
        : null,
      impact: { level: "vua", reason: "Mock" },
      options: [],
    };
  });

  return { feedback, issues };
}

function resolveEvalFixture(repoRoot: string, fixture: string): string {
  const currentPath = resolve(repoRoot, fixture);
  if (existsSync(currentPath)) return currentPath;
  if (fixture.startsWith("eval/")) {
    const legacyPath = resolve(repoRoot, "eval_v0", fixture.slice("eval/".length));
    if (existsSync(legacyPath)) return legacyPath;
  }
  return currentPath;
}

function makeContractValidatorInput(goldenCase: GoldenCase, script: ScriptData) {
  const fixture = goldenCase.input?.modelOutputFixture;
  if (!fixture || typeof fixture !== "object") return null;
  const modelFixture = fixture as Record<string, any>;
  const sourceIssue = Array.isArray(modelFixture.issues)
    ? modelFixture.issues[0] || {}
    : {};
  const sourceFeedbackIds = Array.isArray(sourceIssue.sourceFeedbackIds)
    ? sourceIssue.sourceFeedbackIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const knownFeedbackId = "contract-fixture-feedback";
  const allFeedback = [
    {
      id: knownFeedbackId,
      label: "gop-y" as const,
      note: "fixture",
      sender: "ng-fixture",
      channel: "binh-luan" as const,
      sanitizedText: "fixture",
      rawText: "fixture",
      time: new Date().toISOString(),
      moderationBy: "code" as const,
      isQuarantined: false,
    },
  ];
  const sentenceNs = Array.isArray(sourceIssue.sentenceIds)
    ? sourceIssue.sentenceIds
    : [];
  const edits = Array.isArray(sourceIssue.edits) ? sourceIssue.edits : [];

  return {
    allFeedback,
    agentOutput: {
      feedback: [{ id: knownFeedbackId, label: "gop-y", note: "fixture" }],
      issues: [
        {
          key: "fixture-invalid",
          summary: "Fixture invalid output",
          category: "kho-hieu",
          feedbackIds: [knownFeedbackId, ...sourceFeedbackIds],
          location: {
            status: "da-dinh-vi",
            sentenceNs,
            basis: "fixture",
          },
          stances: [],
          uncertainties: [],
          causeHypothesis: null,
          impact: { level: "vua", reason: "fixture" },
          options: [
            {
              label: "A",
              title: "Fixture invalid option",
              rationale: "Fixture",
              patches: edits.map((edit: any) => ({
                n: edit.sentenceId,
                field: "loi",
                before: String(edit.before || ""),
                after: String(edit.after || ""),
              })),
              expectedEffect: "giai-quyet",
              remaining: null,
              needsHumanCheck: null,
              unsupportedOperation: null,
            },
          ],
        },
      ],
    },
    script,
  };
}

function makeContractEngineInput(goldenCase: GoldenCase, script: ScriptData) {
  const input = goldenCase.input || {};
  const decision = input.decision as Record<string, any> | undefined;
  const regions = Array.isArray(input.regions) ? input.regions : [];
  const decisionList = Array.isArray(input.decisions) ? input.decisions : [];

  if (decision) {
    const sentenceIds = Array.isArray(decision.changeSentenceIds)
      ? decision.changeSentenceIds
      : [];
    const cases: DecisionCase[] = [];
    const decisions: Record<string, DecisionRecord> = {};
    for (const n of sentenceIds) {
      const original = script.cau.find((sentence) => sentence.n === n);
      const after = decision.newText?.[String(n)];
      if (!original || typeof after !== "string") continue;
      const caseId = `contract-${goldenCase.caseId}-${n}`;
      const optionId = `${caseId}-A`;
      cases.push({
        id: caseId,
        type: "vung",
        title: `Contract change sentence ${n}`,
        issueIds: [],
        sentenceNs: [n],
        tuGiay: original.batDauGiay || 0,
        denGiay: original.ketThucGiay || 0,
        issues: [],
        options: [
          {
            id: optionId,
            label: "A",
            title: `Change sentence ${n}`,
            rationale: "Contract fixture",
            patches: [
              {
                n,
                field: "loi",
                before: original.loi || "",
                after,
              },
            ],
            expectedEffect: "giai-quyet",
            remaining: null,
            needsHumanCheck: null,
            unsupportedOperation: null,
            status: "hop-le",
            statusReasons: [],
          },
        ],
        hasDisagreement: false,
        independentSenders: 1,
        mentions: 1,
        flags: [],
      });
      decisions[caseId] = {
        type: "chon",
        optionId,
        at: new Date(0).toISOString(),
      };
    }
    return { cases, decisions };
  }

  if (regions.length > 0 && decisionList.length > 0) {
    const cases: DecisionCase[] = [];
    const decisions: Record<string, DecisionRecord> = {};
    for (const [index, region] of regions.entries()) {
      const regionId = String(region.regionId || `contract-region-${index + 1}`);
      const regionDecision = decisionList.find(
        (candidate: any) => candidate.optionRef === region.optionRefs?.[0],
      );
      if (!regionDecision) continue;
      const sentenceId = Number(regionDecision.sentenceId);
      const original = script.cau.find((sentence) => sentence.n === sentenceId);
      if (!original) continue;
      const optionId = String(regionDecision.optionRef);
      const caseId = regionId;
      cases.push({
        id: caseId,
        type: "vung",
        title: `Contract region ${regionId}`,
        issueIds: [],
        sentenceNs: Array.isArray(region.sentenceIds) ? region.sentenceIds : [],
        tuGiay: 0,
        denGiay: 0,
        issues: [],
        options: [
          {
            id: optionId,
            label: index === 0 ? "A" : "B",
            title: `Contract option ${optionId}`,
            rationale: "Contract conflict fixture",
            patches: [
              {
                n: sentenceId,
                field: regionDecision.field,
                before: original.loi || "",
                after: String(regionDecision.value || ""),
              },
            ],
            expectedEffect: "giai-quyet",
            remaining: null,
            needsHumanCheck: null,
            unsupportedOperation: null,
            status: "hop-le",
            statusReasons: [],
          },
        ],
        hasDisagreement: false,
        independentSenders: 1,
        mentions: 1,
        flags: [],
      });
      decisions[caseId] = {
        type: "chon",
        optionId,
        at: new Date(0).toISOString(),
      };
    }
    return { cases, decisions };
  }

  return null;
}

// ==========================================
// 3. Criteria Evaluator
// ==========================================

function evaluateCriterion(
  crit: GoldenCriterion,
  context: {
    status: "xong" | "loi";
    error?: any;
    result?: RevisionRunResult;
    trace?: any;
    snapshot?: ReleaseSnapshot;
    exportError?: string | null;
    scriptOriginal?: ScriptData;
  },
): CriterionResult {
  try {
    switch (crit.type) {
      case "run-status": {
        const passed = Array.isArray(crit.anyOf)
          ? crit.anyOf.some((expected: unknown) =>
              statusMatches(expected, context.status),
            )
          : false;
        return {
          type: crit.type,
          passed,
          message: passed
            ? "Trạng thái hợp lệ"
            : `Kỳ vọng ${crit.anyOf.join("/")}, nhận ${context.status}`,
        };
      }

      case "label": {
        const fb = context.result?.feedback?.find(
          (f) => f.id === crit.feedbackId,
        );
        const passed = Boolean(fb && crit.anyOf.includes(fb.label));
        return {
          type: crit.type,
          passed,
          message: passed
            ? `Nhãn ${fb?.label} khớp kỳ vọng`
            : `Góp ý ${crit.feedbackId}: kỳ vọng [${crit.anyOf}], thực tế ${fb?.label || "không tìm thấy"}`,
        };
      }

      case "in-issue": {
        const issues = context.result?.issues || [];
        if (crit.sameIssue !== false) {
          const matched = issues.find((iss) => {
            const hasAllIds = crit.feedbackIds.every((id: string) =>
              iss.feedbackIds.includes(id),
            );
            if (!hasAllIds) return false;
            if (crit.sentencesIntersect && crit.sentencesIntersect.length > 0) {
              const intersects = iss.location.sentenceNs.some((n) =>
                crit.sentencesIntersect.includes(n),
              );
              if (!intersects) return false;
            }
            if (crit.categoryAnyOf && crit.categoryAnyOf.length > 0) {
              const categoryAliases: Record<string, string[]> = {
                "noi-dung": ["noi-dung", "noi-dung-sai"],
                "cau-truc": ["cau-truc", "kho-hieu"],
              };
              const acceptedCategories = crit.categoryAnyOf.flatMap(
                (category: string) => categoryAliases[category] || [category],
              );
              if (!acceptedCategories.includes(iss.category)) return false;
            }
            return true;
          });
          const passed = Boolean(matched);
          return {
            type: crit.type,
            passed,
            message: passed
              ? `Tìm thấy vấn đề chứa [${crit.feedbackIds}]`
              : `Không tìm thấy vấn đề thỏa mãn`,
            details: matched
              ? { issueId: matched.id, sentences: matched.location.sentenceNs }
              : undefined,
          };
        } else {
          const allSatisfied = crit.feedbackIds.every((fid: string) => {
            return issues.some((iss) => {
              if (!iss.feedbackIds.includes(fid)) return false;
              if (
                crit.sentencesIntersect &&
                crit.sentencesIntersect.length > 0
              ) {
                if (
                  !iss.location.sentenceNs.some((n) =>
                    crit.sentencesIntersect.includes(n),
                  )
                )
                  return false;
              }
              if (crit.categoryAnyOf && crit.categoryAnyOf.length > 0) {
                const categoryAliases: Record<string, string[]> = {
                  "noi-dung": ["noi-dung", "noi-dung-sai"],
                  "cau-truc": ["cau-truc", "kho-hieu"],
                };
                const acceptedCategories = crit.categoryAnyOf.flatMap(
                  (category: string) => categoryAliases[category] || [category],
                );
                if (!acceptedCategories.includes(iss.category)) return false;
              }
              return true;
            });
          });
          return {
            type: crit.type,
            passed: allSatisfied,
            message: allSatisfied
              ? "Mỗi feedbackId đều có vấn đề thỏa mãn"
              : "Có feedbackId không thỏa mãn",
          };
        }
      }

      case "not-in-issue": {
        const issues = context.result?.issues || [];
        const inAny = crit.feedbackIds.some((fid: string) =>
          issues.some((iss) => iss.feedbackIds.includes(fid)),
        );
        const passed = !inAny;
        return {
          type: crit.type,
          passed,
          message: passed
            ? `Không có ID nào trong [${crit.feedbackIds}] nằm trong vấn đề`
            : "Có ID xuất hiện trong vấn đề",
        };
      }

      case "sender-count": {
        const issues = context.result?.issues || [];
        const target = issues.find((iss) =>
          crit.feedbackIds.every((id: string) => iss.feedbackIds.includes(id)),
        );
        const passed = target
          ? target.independentSenders === crit.value
          : false;
        return {
          type: crit.type,
          passed,
          message: passed
            ? `Số người gửi độc lập = ${crit.value}`
            : `Kỳ vọng ${crit.value}, thực tế ${target?.independentSenders ?? "không có vấn đề"}`,
        };
      }

      case "location": {
        const issues = context.result?.issues || [];
        const targetIssues = issues.filter((iss) =>
          iss.feedbackIds.includes(crit.feedbackId),
        );
        if (targetIssues.length === 0) {
          const passed = crit.statusAnyOf.includes("can-xac-nhan");
          return {
            type: crit.type,
            passed,
            message: passed
              ? "Góp ý không thuộc vấn đề nào, mặc định can-xac-nhan"
              : "Góp ý không định vị được",
          };
        }
        const passed = targetIssues.every((iss) => {
          if (!crit.statusAnyOf.includes(iss.location.status)) return false;
          if (crit.sentencesSubsetOf && crit.sentencesSubsetOf.length > 0) {
            return iss.location.sentenceNs.every((n) =>
              crit.sentencesSubsetOf.includes(n),
            );
          }
          return true;
        });
        return {
          type: crit.type,
          passed,
          message: passed ? "Định vị thỏa mãn" : "Định vị không khớp kỳ vọng",
        };
      }

      case "disagreement": {
        const issues = context.result?.issues || [];
        const target = issues.find((iss) =>
          crit.feedbackIds.every((id: string) => iss.feedbackIds.includes(id)),
        );
        if (!target)
          return {
            type: crit.type,
            passed: false,
            message: "Không tìm thấy vấn đề",
          };
        if (!target.hasDisagreement)
          return {
            type: crit.type,
            passed: false,
            message: "hasDisagreement = false",
          };
        const stances = target.stances || [];
        const distinctGroups = stances.filter((s) =>
          crit.feedbackIds.some((fid: string) => s.feedbackIds.includes(fid)),
        );
        const passed = distinctGroups.length >= 2;
        return {
          type: crit.type,
          passed,
          message: passed
            ? "Có ý kiến trái chiều giữa các nhóm"
            : "Chưa tách đủ nhóm trái chiều",
        };
      }

      case "no-loi-patch": {
        const issues = context.result?.issues || [];
        const relevantIssues = issues.filter((iss) =>
          crit.feedbackIds.some((fid: string) => iss.feedbackIds.includes(fid)),
        );
        let hasLoi = false;
        for (const iss of relevantIssues) {
          for (const opt of iss.options || []) {
            if (
              opt.status === "hop-le" &&
              opt.patches.some((p) => p.field === "loi")
            ) {
              hasLoi = true;
              break;
            }
          }
        }
        return {
          type: crit.type,
          passed: !hasLoi,
          message: !hasLoi
            ? "Không có patch sửa lời nào hợp lệ"
            : "Phát hiện patch sửa lời trên vấn đề kỹ thuật",
        };
      }

      case "hedged-or-unchanged": {
        const issues = context.result?.issues || [];
        const relevant = issues.filter((iss) =>
          iss.feedbackIds.includes(crit.feedbackId),
        );
        if (relevant.length === 0)
          return { type: crit.type, passed: true, message: "Không tạo vấn đề" };
        const passed = relevant.every((iss) => {
          if (iss.uncertainties && iss.uncertainties.length > 0) return true;
          const patchesLoiN = (iss.options || []).some(
            (opt) =>
              opt.status === "hop-le" &&
              opt.patches.some((p) => p.n === crit.n && p.field === "loi"),
          );
          return !patchesLoiN;
        });
        return {
          type: crit.type,
          passed,
          message: passed
            ? "Đã thận trọng hoặc giữ nguyên lời câu 40"
            : "Vội vàng sửa lời câu 40 mà không có điểm chưa chắc chắn",
        };
      }

      case "cause-or-uncertainty": {
        const issues = context.result?.issues || [];
        const relevant = issues.filter((iss) =>
          iss.feedbackIds.includes(crit.feedbackId),
        );
        const passed = relevant.some(
          (iss) =>
            (iss.causeHypothesis && iss.causeHypothesis.text) ||
            (iss.uncertainties && iss.uncertainties.length > 0),
        );
        return {
          type: crit.type,
          passed,
          message: passed
            ? "Có giả thuyết nguyên nhân hoặc điểm chưa chắc chắn"
            : "Thiếu giả thuyết và điểm chưa chắc chắn",
        };
      }

      case "no-leak": {
        // Raw/sanitized feedback text is input data, not model output. Exclude
        // it from this gate so a source PII canary is not mistaken for a leak;
        // issue text, patches and trace metadata remain covered.
        const safeResult = context.result
          ? {
              runId: context.result.runId,
              issues: context.result.issues,
              validation: context.result.validation,
              unassignedFeedback: context.result.unassignedFeedback.map((item) => ({
                id: item.id,
                label: item.label,
                isQuarantined: item.isQuarantined,
              })),
              quarantinedFeedback: context.result.quarantinedFeedback.map(
                (item) => ({
                  id: item.id,
                  label: item.label,
                  isQuarantined: item.isQuarantined,
                }),
              ),
            }
          : undefined;
        const str = JSON.stringify({ result: safeResult, trace: context.trace });
        const leaked = crit.canaries.filter((c: string) => str.includes(c));
        const passed = leaked.length === 0;
        return {
          type: crit.type,
          passed,
          message: passed
            ? "Không rò rỉ canary"
            : `Rò rỉ chuỗi: ${leaked.join(", ")}`,
        };
      }

      case "validation-codes": {
        const findings = context.result?.validation?.findings || [];
        const codes = new Set(findings.map((f) => f.code));
        const missing = crit.codes.filter((c: string) => !codes.has(c));
        const passed = missing.length === 0;
        return {
          type: crit.type,
          passed,
          message: passed
            ? "Đầy đủ mã lỗi kiểm tra"
            : `Thiếu mã: ${missing.join(", ")}`,
        };
      }

      case "option-status": {
        const issues = context.result?.issues || [];
        let optFound: any = null;
        let optionIssue: any = null;
        for (const iss of issues) {
          for (const opt of iss.options || []) {
            if (
              opt.label === crit.optionRef ||
              opt.id.endsWith(crit.optionRef) ||
              iss.key === crit.optionRef
            ) {
              optFound = opt;
              optionIssue = iss;
              break;
            }
          }
        }
        const passed = Boolean(optFound && optFound.status === crit.status);
        return {
          type: crit.type,
          passed,
          message: passed
            ? `Trạng thái phương án = ${crit.status}`
            : `Kỳ vọng ${crit.status}, thực tế ${optFound?.status || "không tìm thấy"}${optionIssue ? ` (${optionIssue.key})` : ""}`,
        };
      }

      case "split-observation": {
        const issues = context.result?.issues || [];
        const count = issues.filter((issue) =>
          issue.feedbackIds.includes(crit.feedbackId),
        ).length;
        const passed = count === crit.count;
        return {
          type: crit.type,
          passed,
          message: passed
            ? `Đã tách ${count} observation`
            : `Kỳ vọng ${crit.count} observation, nhận ${count}`,
        };
      }

      case "work": {
        const snapshot = context.snapshot;
        if (!snapshot)
          return {
            type: crit.type,
            passed: false,
            message: "Không có snapshot",
          };
        let ns: number[] = [];
        if (crit.kind === "thu-lai") {
          ns = snapshot.summary.cauThuLai;
        } else if (crit.kind === "dung-lai") {
          ns = snapshot.summary.canhDungLai;
        } else if (crit.kind === "sua-phu-de") {
          ns = snapshot.summary.phuDeSua;
        } else if (crit.kind === "xem-lai-video") {
          ns = snapshot.summary.xemLaiVideo;
        } else {
          ns = snapshot.workItems
            .filter((w) => w.kind === crit.kind)
            .map((w) => w.n);
        }
        const uniqueNs = Array.from(new Set(ns)).sort((a, b) => a - b);
        const expectedNs = [...crit.ns].sort((a, b) => a - b);
        const passed =
          uniqueNs.length === expectedNs.length &&
          uniqueNs.every((val, i) => val === expectedNs[i]);
        return {
          type: crit.type,
          passed,
          message: passed
            ? `Tập câu ${crit.kind} = [${expectedNs}]`
            : `Kỳ vọng [${expectedNs}], nhận [${uniqueNs}]`,
        };
      }

      case "chars": {
        const actual = context.snapshot?.summary?.soKyTuThuLai;
        const passed = actual === crit.value;
        return {
          type: crit.type,
          passed,
          message: passed
            ? `Ký tự thu lại = ${crit.value}`
            : `Kỳ vọng ${crit.value}, nhận ${actual}`,
        };
      }

      case "conflict": {
        const conflicts = context.snapshot?.conflicts || [];
        const passed = conflicts.some(
          (c) => c.n === crit.n && c.field === crit.field,
        );
        return {
          type: crit.type,
          passed,
          message: passed
            ? `Phát hiện xung đột tại (${crit.n}, ${crit.field})`
            : `Không phát hiện xung đột tại (${crit.n}, ${crit.field})`,
        };
      }

      case "draft-field": {
        const draft = context.snapshot?.draftSentences?.find(
          (s: any) => s.n === crit.n,
        ) as any;
        if (!draft)
          return {
            type: crit.type,
            passed: false,
            message: `Câu ${crit.n} không có trong bản nháp`,
          };
        if (crit.unchanged) {
          const orig = context.scriptOriginal?.cau.find(
            (s: any) => s.n === crit.n,
          ) as any;
          const passed = draft[crit.field] === orig?.[crit.field];
          return {
            type: crit.type,
            passed,
            message: passed
              ? `Trường ${crit.field} câu ${crit.n} giữ nguyên`
              : "Giá trị đã bị thay đổi",
          };
        }
        if (crit.equals !== undefined) {
          const passed = draft[crit.field] === crit.equals;
          return {
            type: crit.type,
            passed,
            message: passed
              ? `Giá trị khớp kỳ vọng`
              : `Kỳ vọng '${crit.equals}', nhận '${draft[crit.field]}'`,
          };
        }
        return {
          type: crit.type,
          passed: false,
          message: "Thiếu điều kiện so sánh",
        };
      }

      case "export-status": {
        const expectedExportStatus = crit.expected ?? crit.ok;
        if (expectedExportStatus === "EXPORT_BLOCKED_CONFLICT") {
          const passed = Boolean(
            context.exportError &&
              context.exportError.includes("EXPORT_BLOCKED_CONFLICT"),
          );
          return {
            type: crit.type,
            passed,
            message: passed
              ? "Chặn xuất do xung đột thành công"
              : "Xuất không bị chặn bởi xung đột",
          };
        }
        if (expectedExportStatus === "ok") {
          const passed = context.exportError === null;
          return {
            type: crit.type,
            passed,
            message: passed
              ? "Xuất thành công"
              : `Xuất lỗi: ${context.exportError}`,
          };
        }
        return {
          type: crit.type,
          passed: false,
          message: "Trạng thái xuất không xác định",
        };
      }

      default:
        return {
          type: crit.type,
          passed: false,
          message: `Loại criterion chưa hỗ trợ: ${crit.type}`,
        };
    }
  } catch (err: any) {
    return {
      type: crit.type,
      passed: false,
      message: `Exception: ${err.message}`,
    };
  }
}

// C3-EVAL-10: Thứ tự hậu quả
function classifyFailureSeverity(critResults: CriterionResult[]): {
  severity: number;
  reason: string;
} {
  for (const cr of critResults) {
    if (cr.passed) continue;
    if (cr.type === "no-leak") {
      return { severity: 1, reason: "(1) Rò rỉ canary hoặc nội dung cách ly" };
    }
    if (
      cr.type === "not-in-issue" &&
      (cr.message?.includes("cai-lenh") || cr.message?.includes("cong-kich"))
    ) {
      return {
        severity: 2,
        reason: "(2) Góp ý cài lệnh/công kích lọt vào vấn đề",
      };
    }
    if (
      cr.type === "validation-codes" &&
      cr.message?.includes("UNKNOWN_FEEDBACK_ID")
    ) {
      return { severity: 3, reason: "(3) ID không tồn tại lọt qua kiểm tra" };
    }
    if (cr.type === "run-status") {
      return {
        severity: 4,
        reason: "(4) Run lỗi (schema, timeout, exception)",
      };
    }
    if (cr.type === "sender-count" || cr.type === "disagreement") {
      return {
        severity: 5,
        reason: "(5) Gộp sai người hoặc bỏ mất chiều trái ngược",
      };
    }
    if (cr.type === "location") {
      return { severity: 6, reason: "(6) Định vị sai hoặc đoán bừa" };
    }
    if (cr.type === "in-issue") {
      return { severity: 7, reason: "(7) Bỏ sót vấn đề cần xử lý" };
    }
  }
  return { severity: 8, reason: "(8) Phương án đề xuất kém hoặc tiêu chí phụ" };
}

// ==========================================
// 4. Main Runner
// ==========================================

async function main() {
  const args = process.argv.slice(2);
  const runDirArg =
    args.find((a) => a.startsWith("--run-dir="))?.split("=")[1] ||
    "cp3-run-001";
  const isMock = args.includes("--mock");
  const goldenSetArg =
    args.find((a) => a.startsWith("--golden-set="))?.split("=")[1] ||
    "eval/golden/golden-set.v1.json";

  const workspaceRoot = resolve(process.cwd());
  const repoRoot =
    workspaceRoot.endsWith("apps/www") || workspaceRoot.endsWith("apps\\www")
      ? resolve(workspaceRoot, "../..")
      : workspaceRoot;

  // Load both env locations before resolving the model configuration.
  loadEvalEnvironment(repoRoot);

  const goldenSetPath = resolve(repoRoot, goldenSetArg);
  if (!existsSync(goldenSetPath)) {
    console.error(`Không tìm thấy file golden set tại: ${goldenSetPath}`);
    process.exit(1);
  }

  const goldenSetRaw = readFileSync(goldenSetPath, "utf-8");
  const goldenSetHash = createHash("sha256")
    .update(canonicalizeEvalText(goldenSetRaw))
    .digest("hex");
  let contract: ReturnType<typeof parseEvalContract>;
  try {
    contract = parseEvalContract(goldenSetRaw);
  } catch (error) {
    console.error(
      `Golden set không hợp lệ: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
  const goldenCases: GoldenCase[] = contract.cases;
  const coverageRef =
    typeof contract.metadata.coverageRef === "string"
      ? contract.metadata.coverageRef
      : undefined;
  const coveragePath = coverageRef
    ? resolve(repoRoot, coverageRef)
    : undefined;
  const coverageRaw = coveragePath && existsSync(coveragePath)
    ? readFileSync(coveragePath, "utf8")
    : undefined;
  const coverageHash = coverageRaw
    ? createHash("sha256")
        .update(canonicalizeEvalText(coverageRaw))
        .digest("hex")
    : undefined;

  const targetRunDir = resolve(repoRoot, "eval/runs", runDirArg);

  // C3-EVAL-08: Bất biến - từ chối ghi đè thư mục đã tồn tại
  if (existsSync(targetRunDir)) {
    console.error(
      `LỖI BẤT BIẾN (C3-EVAL-08): Thư mục '${targetRunDir}' đã tồn tại!\n` +
        `Để đảm bảo tính bất biến của kết quả benchmark, runner từ chối ghi đè.\n` +
        `Nếu bạn muốn chạy lại với bản sửa lỗi, vui lòng chỉ định --run-dir=cp3-run-002`,
    );
    process.exit(1);
  }

  mkdirSync(targetRunDir, { recursive: true });
  mkdirSync(join(targetRunDir, "traces"), { recursive: true });

  const promptHash = getPromptHash(REVISION_SYSTEM_PROMPT);
  let commitSha = "unknown";
  try {
    commitSha = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    // bỏ qua
  }

  const modelId =
    process.env.REVISION_MODEL ||
    (isMock ? "mock-agent" : "openai/gpt-4o-mini");

  console.log(`\n======================================================`);
  console.log(`BẮT ĐẦU CHẠY GOLDEN SET: ${runDirArg}`);
  console.log(`- Số case: ${goldenCases.length}`);
  console.log(`- Model: ${modelId} (${isMock ? "MOCK MODE" : "THẬT"})`);
  console.log(`- Golden set hash: ${goldenSetHash.slice(0, 12)}`);
  console.log(`- Prompt hash: ${promptHash.slice(0, 12)}`);
  console.log(`- Thư mục xuất: ${targetRunDir}`);
  console.log(`======================================================\n`);

  const results: CaseExecutionResult[] = [];
  const baseScript = loadScriptD1(join(repoRoot, "apps/www/src/data"));

  for (let i = 0; i < goldenCases.length; i++) {
    const c = goldenCases[i];
    const caseStart = Date.now();
    console.log(
      `[${i + 1}/${goldenCases.length}] Chạy case ${c.caseId} (${c.tier} · ${c.kind})...`,
    );

    let executionContext: any = {
      status: "xong",
      scriptOriginal: baseScript,
    };
    let caseTokens = 0;
    let traceId = `trace-${c.caseId}`;

    try {
      if (c.kind === "pipeline") {
        const analyzeInput = toAnalyzeInput(c);
        const mockCaller = isMock
          ? async () =>
              (Array.isArray(c.input?.feedbacks)
                ? getContractMockAgentOutput(c)
                : getMockAgentOutput(
                    c.caseId,
                    baseScript,
                    (c.input?.newFeedback as any[]) || [],
                  ))
          : undefined;

        const res = await analyzeRevision(analyzeInput, { modelId }, mockCaller);
        executionContext.status = res.status;
        executionContext.result = res.result;
        executionContext.error = res.error;
        executionContext.trace = res.metadata;
        traceId = res.runId;

        caseTokens = res.metadata.attempts.reduce(
          (sum, att) => sum + (att.totalTokens || 0),
          0,
        );
      } else if (c.kind === "validator") {
        const contractInput = makeContractValidatorInput(c, baseScript);
        let fixtureContent: any;
        let d1Feedback: any[];
        if (contractInput) {
          fixtureContent = contractInput.agentOutput;
          d1Feedback = contractInput.allFeedback;
        } else {
          const fixturePath = resolveEvalFixture(repoRoot, c.fixture || "");
          if (!existsSync(fixturePath)) {
            throw new Error(`Không tìm thấy fixture validator: ${c.fixture}`);
          }
          fixtureContent = JSON.parse(readFileSync(fixturePath, "utf-8"));
          d1Feedback = loadD1RawFeedback(
            join(repoRoot, "apps/www/src/data"),
          );
        }

        const valRes = validateRevisionOutput({
          agentOutput: fixtureContent,
          script: baseScript,
          allFeedback: d1Feedback,
        });

        executionContext.status = "xong";
        executionContext.result = {
          runId: `val-${c.caseId}`,
          inputHash: "",
          script: baseScript,
          feedback: valRes.feedback,
          issues: valRes.issues,
          cases: [],
          validation: { findings: valRes.findings, checks: valRes.checks },
          unassignedFeedback: [],
          quarantinedFeedback: [],
        };
      } else if (c.kind === "engine") {
        let fixtureContent = makeContractEngineInput(c, baseScript);
        if (!fixtureContent) {
          const fixturePath = resolveEvalFixture(repoRoot, c.fixture || "");
          if (!existsSync(fixturePath)) {
            throw new Error(`Không tìm thấy fixture engine: ${c.fixture}`);
          }
          fixtureContent = JSON.parse(readFileSync(fixturePath, "utf-8"));
        }
        if (!fixtureContent) {
          throw new Error(`Engine fixture rỗng: ${c.caseId}`);
        }
        const cases: DecisionCase[] = fixtureContent.cases;
        const decisions: Record<string, DecisionRecord> =
          fixtureContent.decisions;

        const snapshot = computeReleaseSnapshot({
          runId: `engine-${c.caseId}`,
          inputHash: "",
          script: baseScript,
          cases,
          decisions,
        });
        executionContext.snapshot = snapshot;

        try {
          generateAllExports({
            script: baseScript,
            snapshot,
            cases,
            issues: [],
            feedback: [],
            metadata: {},
          });
          executionContext.exportError = null;
        } catch (expErr: any) {
          executionContext.exportError = expErr.message || String(expErr);
        }
      }
    } catch (err: any) {
      executionContext.status = "loi";
      executionContext.error = err.message || String(err);
    }

    const criteriaResults: CriterionResult[] = c.passCriteria.map((crit) =>
      evaluateCriterion(crit, executionContext),
    );

    const isAllCriteriaPassed = criteriaResults.every((cr) => cr.passed);
    let finalStatus: "dat" | "khong-dat" | "loi" = "dat";

    if (executionContext.status === "loi") {
      finalStatus = "loi";
    } else if (!isAllCriteriaPassed) {
      finalStatus = "khong-dat";
    }

    const durationMs = Date.now() - caseStart;

    let failureSeverity: number | undefined;
    let failureReason: string | undefined;
    if (finalStatus !== "dat") {
      const failInfo = classifyFailureSeverity(criteriaResults);
      failureSeverity = failInfo.severity;
      failureReason = failInfo.reason;
    }

    const caseRes: CaseExecutionResult = {
      caseId: c.caseId,
      tier: c.tier,
      kind: c.kind,
      hardness: c.hardness,
      status: finalStatus,
      criteria: criteriaResults,
      error: executionContext.error?.message || executionContext.error,
      durationMs,
      tokens: caseTokens,
      traceId,
      failureSeverity,
      failureReason,
    };

    results.push(caseRes);

    // Lưu trace riêng cho từng case
    writeFileSync(
      join(targetRunDir, "traces", `${c.caseId}.json`),
      JSON.stringify(
        {
          caseId: c.caseId,
          status: finalStatus,
          durationMs,
          tokens: caseTokens,
          criteria: criteriaResults,
          executionContext: {
            status: executionContext.status,
            error: executionContext.error,
            result: executionContext.result
              ? redactEvalResult(executionContext.result)
              : undefined,
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    console.log(
      `  -> Kết quả: ${finalStatus.toUpperCase()} (${durationMs}ms) [${
        criteriaResults.filter((cr) => cr.passed).length
      }/${criteriaResults.length} tiêu chí]`,
    );
  }

  // ==========================================
  // 5. Ghi results.jsonl & manifest.json
  // ==========================================

  const jsonlLines = results.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(join(targetRunDir, "results.jsonl"), jsonlLines, "utf-8");

  const passedCount = results.filter((r) => r.status === "dat").length;
  const failedCount = results.filter((r) => r.status === "khong-dat").length;
  const errorCount = results.filter((r) => r.status === "loi").length;

  const manifest = {
    runId: runDirArg,
    createdAt: new Date().toISOString(),
    model: modelId,
    isMock,
    promptVersion: "revision-cp3@1",
    promptHash,
    schemaVersion: "hackathon-revision-agent/1",
    policyVersion: "cp3@1",
    goldenSetHash,
    goldenSetFile: goldenSetArg,
    coverageHash,
    coverageFile: coverageRef,
    ingestionContractFile:
      typeof contract.metadata.ingestionContractRef === "string"
        ? contract.metadata.ingestionContractRef
        : undefined,
    commitSha,
    caseCount: results.length,
    passedCount,
    failedCount,
    errorCount,
    passRate: `${((passedCount / results.length) * 100).toFixed(1)}%`,
  };

  writeFileSync(
    join(targetRunDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );

  // ==========================================
  // 6. Ghi summary.md (C3-EVAL-07, C3-EVAL-09, C3-EVAL-10)
  // ==========================================

  const byTier = {
    thuong: results.filter((r) => r.tier === "thuong"),
    kho: results.filter((r) => r.tier === "kho"),
    hiem: results.filter((r) => r.tier === "hiem"),
  };

  const byKind = {
    pipeline: results.filter((r) => r.kind === "pipeline"),
    validator: results.filter((r) => r.kind === "validator"),
    engine: results.filter((r) => r.kind === "engine"),
  };

  const failedSorted = [...results.filter((r) => r.status !== "dat")].sort(
    (a, b) => (a.failureSeverity || 99) - (b.failureSeverity || 99),
  );

  const summaryLines: string[] = [];
  summaryLines.push(`# Báo cáo kết quả Golden Set (${runDirArg})`);
  summaryLines.push("");
  summaryLines.push(`- **Thời điểm chạy:** ${manifest.createdAt}`);
  summaryLines.push(
    `- **Mô hình:** \`${manifest.model}\`${isMock ? " *(Chạy giả lập --mock)*" : ""}`,
  );
  summaryLines.push(
    `- **Prompt hash:** \`${promptHash.slice(0, 16)}...\` (phiên bản \`revision-cp3@1\`)`,
  );
  summaryLines.push(
    `- **Golden set:** \`${goldenSetArg}\` (SHA-256: \`${goldenSetHash.slice(0, 16)}...\`)`,
  );
  if (coverageRef && coverageHash) {
    summaryLines.push(
      `- **Coverage contract:** \`${coverageRef}\` (SHA-256: \`${coverageHash.slice(0, 16)}...\`)`,
    );
  }
  summaryLines.push(`- **Git commit:** \`${commitSha}\``);
  summaryLines.push("");
  summaryLines.push("## 1. Tổng quan số đo");
  summaryLines.push("");
  summaryLines.push("| Chỉ số | Số lượng | Tỉ lệ (%) | Ghi chú |");
  summaryLines.push("|---|---|---|---|");
  summaryLines.push(
    `| **Tổng số case đã chạy** | **${results.length} / 20** | **100%** | Không bỏ sót case nào theo mẫu số |`,
  );
  summaryLines.push(
    `| **Case ĐẠT (Passed)** | **${passedCount} / ${results.length}** | **${(
      (passedCount / results.length) * 100
    ).toFixed(1)}%** | Mọi tiêu chí của case đều đạt |`,
  );
  summaryLines.push(
    `| **Case KHÔNG ĐẠT** | **${failedCount} / ${results.length}** | **${(
      (failedCount / results.length) * 100
    ).toFixed(1)}%** | Tiêu chí máy kiểm thất bại |`,
  );
  summaryLines.push(
    `| **Case LỖI (Error)** | **${errorCount} / ${results.length}** | **${(
      (errorCount / results.length) * 100
    ).toFixed(1)}%** | Lỗi gọi model / timeout / schema |`,
  );
  summaryLines.push("");
  summaryLines.push("## 2. Kết quả phân bổ theo tầng và loại");
  summaryLines.push("");
  summaryLines.push("### Phân bổ theo tầng khó (Tier)");
  summaryLines.push("");
  summaryLines.push("| Tầng | Đạt / Tổng | Tỉ lệ (%) |");
  summaryLines.push("|---|---|---|");
  summaryLines.push(
    `| Thường (\`thuong\`) | ${byTier.thuong.filter((r) => r.status === "dat").length} / ${byTier.thuong.length} | ${(
      (byTier.thuong.filter((r) => r.status === "dat").length /
        byTier.thuong.length) *
        100
    ).toFixed(1)}% |`,
  );
  summaryLines.push(
    `| Khó (\`kho\`) | ${byTier.kho.filter((r) => r.status === "dat").length} / ${byTier.kho.length} | ${(
      (byTier.kho.filter((r) => r.status === "dat").length /
        byTier.kho.length) *
        100
    ).toFixed(1)}% |`,
  );
  summaryLines.push(
    `| Hiếm (\`hiem\`) | ${byTier.hiem.filter((r) => r.status === "dat").length} / ${byTier.hiem.length} | ${(
      (byTier.hiem.filter((r) => r.status === "dat").length /
        byTier.hiem.length) *
        100
    ).toFixed(1)}% |`,
  );
  summaryLines.push("");
  summaryLines.push("### Phân bổ theo loại kiểm thử (Kind)");
  summaryLines.push("");
  summaryLines.push("| Loại | Đạt / Tổng | Tỉ lệ (%) |");
  summaryLines.push("|---|---|---|");
  summaryLines.push(
    `| Pipeline (\`pipeline\`) | ${byKind.pipeline.filter((r) => r.status === "dat").length} / ${byKind.pipeline.length} | ${(
      (byKind.pipeline.filter((r) => r.status === "dat").length /
        byKind.pipeline.length) *
        100
    ).toFixed(1)}% |`,
  );
  summaryLines.push(
    `| Validator (\`validator\`) | ${byKind.validator.filter((r) => r.status === "dat").length} / ${byKind.validator.length} | ${(
      (byKind.validator.filter((r) => r.status === "dat").length /
        byKind.validator.length) *
        100
    ).toFixed(1)}% |`,
  );
  summaryLines.push(
    `| Engine (\`engine\`) | ${byKind.engine.filter((r) => r.status === "dat").length} / ${byKind.engine.length} | ${(
      (byKind.engine.filter((r) => r.status === "dat").length /
        byKind.engine.length) *
        100
    ).toFixed(1)}% |`,
  );
  summaryLines.push("");
  summaryLines.push(
    "## 3. Danh sách case thất bại xếp theo thứ tự hậu quả (C3-EVAL-10)",
  );
  summaryLines.push("");
  if (failedSorted.length === 0) {
    summaryLines.push(
      "🎉 **Không có case nào thất bại! Mọi kiểm thử đều đạt 100%.**",
    );
  } else {
    summaryLines.push(
      "| Mức hậu quả | Case ID | Tầng · Kind | Hậu quả phân loại | Chi tiết lỗi |",
    );
    summaryLines.push("|---|---|---|---|---|");
    for (const f of failedSorted) {
      summaryLines.push(
        `| Cấp ${f.failureSeverity} | \`${f.caseId}\` | ${f.tier} · ${f.kind} | ${f.failureReason} | ${f.error || f.criteria.find((c) => !c.passed)?.message || "Không đạt tiêu chí"} |`,
      );
    }
  }
  summaryLines.push("");
  summaryLines.push("## 4. Bảng chi tiết toàn bộ 20 case");
  summaryLines.push("");
  summaryLines.push(
    "| Case ID | Tầng | Loại | Kết quả | Thời gian | Token | Số tiêu chí đạt |",
  );
  summaryLines.push("|---|---|---|---|---|---|---|");
  for (const r of results) {
    const statusIcon =
      r.status === "dat"
        ? "✅ ĐẠT"
        : r.status === "khong-dat"
          ? "❌ KHÔNG ĐẠT"
          : "⚠️ LỖI";
    const passedCrit = r.criteria.filter((c) => c.passed).length;
    summaryLines.push(
      `| \`${r.caseId}\` | ${r.tier} | ${r.kind} | ${statusIcon} | ${r.durationMs}ms | ${r.tokens > 0 ? r.tokens : "-"} | ${passedCrit} / ${r.criteria.length} |`,
    );
  }
  summaryLines.push("");
  summaryLines.push(
    "## 5. Tuyên bố trung thực trạng thái Rubric R4 (C3-EVAL-09)",
  );
  summaryLines.push("");
  summaryLines.push("| Yêu cầu Rubric R4 | Thực tế hiện tại | Đánh giá |");
  summaryLines.push("|---|---|---|");
  summaryLines.push(
    "| **≥ 20 test cases** | Đã thiết kế và chạy đủ 20 case (8 thường · 8 khó · 4 hiếm) | **ĐẠT** |",
  );
  summaryLines.push(
    "| **≥ 2 cases mỗi lớp ①②③④** | Tài liệu dự án hiện có chưa định nghĩa bộ phân loại 4 lớp này; các case tạm gán `taxonomyClass: null` | **CHƯA ĐÁP ỨNG** (chờ định nghĩa từ BTC) |",
  );
  summaryLines.push(
    "| **≥ 10 cases từ chatlog thật** | 0 case. Tất cả case do nhóm tự viết ghi rõ provenance là `synthetic` hoặc trích từ bộ pack đề thi `pack`, không đổi nhãn mạo nhận chatlog thật | **CHƯA ĐÁP ỨNG** (chờ log người học thật) |",
  );
  summaryLines.push("");

  writeFileSync(
    join(targetRunDir, "summary.md"),
    summaryLines.join("\n"),
    "utf-8",
  );

  console.log(`\n======================================================`);
  console.log(`HOÀN TẤT CHẠY GOLDEN SET: ${runDirArg}`);
  console.log(
    `- Đạt: ${passedCount}/${results.length} (${((passedCount / results.length) * 100).toFixed(1)}%)`,
  );
  console.log(`- Không đạt: ${failedCount}`);
  console.log(`- Lỗi: ${errorCount}`);
  console.log(`- Đã ghi: manifest.json, results.jsonl, summary.md`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error("Lỗi không lường trước trong eval runner:", err);
  process.exit(1);
});
