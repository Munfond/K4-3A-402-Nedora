import { loadScriptD1 } from "@/lib/revision/load";
import type { FeedbackItem } from "@/lib/revision/types";
import { RevisionServiceError, revisionClient } from "@/lib/revision-client";
import type { StudioFeedback, StudioVideo } from "./types";

export function toStudioFeedback(item: FeedbackItem): StudioFeedback {
  const { rawText: _rawText, ...rest } = item;
  const loc = item.location;
  return {
    ...rest,
    locationSource:
      loc && (loc.sentenceN != null || loc.timeSeconds != null)
        ? "nguoi-chon"
        : "chua-xac-dinh",
    sentenceN: loc?.sentenceN,
    timeSeconds: loc?.timeSeconds,
  };
}

/**
 * Góp ý chỉ có một nguồn: Revision service. Next không đọc/ghi kho góp ý riêng,
 * nên góp ý vừa lưu và góp ý đem đi phân tích luôn là cùng một bộ.
 * Service không trả lời thì báo lỗi, không trả danh sách rỗng âm thầm.
 */
export async function attachServiceFeedback(
  video: StudioVideo,
): Promise<StudioVideo> {
  if (!video.hasScript) return video;
  try {
    const { feedback } = await revisionClient.getVideoFeedback(
      video.id,
      video.currentVersion,
    );
    const feedbacks = feedback.map(toStudioFeedback);
    return { ...video, feedbacks, feedbackCount: feedbacks.length };
  } catch (err) {
    const e =
      err instanceof RevisionServiceError
        ? err
        : new RevisionServiceError(String(err));
    return {
      ...video,
      feedbacks: [],
      feedbackCount: 0,
      feedbackError: {
        code: e.code,
        message: e.message,
        serviceUrl: e.serviceUrl,
      },
    };
  }
}

// Seed danh sách video mẫu của Studio
export function getInitialVideos(): StudioVideo[] {
  // Nạp kịch bản D1 mẫu nếu đang chạy server-side
  let scriptD1;
  try {
    scriptD1 = loadScriptD1();
  } catch {
    // Thiếu gói dữ liệu: trang video báo "chưa có kịch bản" thay vì lỗi.
    scriptD1 = undefined;
  }

  return [
    {
      id: "d1",
      title: "Phân biệt AI, học máy, tạo sinh và mô hình ngôn ngữ lớn",
      description:
        "Bài học giải thích trực quan sự khác nhau và mối quan hệ lồng ghép giữa Trí tuệ nhân tạo (AI), Học máy (ML), AI tạo sinh (GenAI) và Mô hình ngôn ngữ lớn (LLM).",
      durationSeconds: 251,
      currentVersion: "v1",
      isSample: true,
      videoUrl: "/video/d1.mp4",
      thumbnailUrl: "/thumbnails/d1.png",
      createdAt: "2026-03-10T08:00:00.000Z",
      hasScript: Boolean(scriptD1),
      hasTimecodes: Boolean(scriptD1),
      hasVideoFile: true,
      feedbackCount: 0,
      activeRunId: null,
      script: scriptD1,
      feedbacks: [],
      versions: [
        {
          versionId: "v1",
          name: "Phiên bản v1 (Đã sản xuất)",
          status: "current",
          releaseStatus: "has_video",
          createdAt: "2026-03-10T08:00:00.000Z",
          description: "Bản dựng gốc đang phát hành trên hệ thống LMS.",
          durationSeconds: 251,
          sentenceCount: 40,
        },
        {
          versionId: "v2",
          name: "Bản sửa dự kiến cho v2",
          status: "draft",
          releaseStatus: "draft_plan_only",
          createdAt: "2026-03-17T10:00:00.000Z",
          description:
            "Bản sửa dự kiến cho v2 · Chưa có video v2. Gói chỉnh sửa đang được lập kế hoạch từ góp ý.",
          sentenceCount: 40,
        },
      ],
    },
    {
      id: "ml-deep-learning",
      title: "Tổng quan Mạng nơ-ron nhân tạo và Deep Learning",
      description:
        "Giới thiệu kiến trúc Multi-Layer Perceptron (MLP), hàm kích hoạt ReLU, và thuật toán lan truyền ngược Backpropagation trong huấn luyện mạng sâu.",
      durationSeconds: 156,
      currentVersion: "v1",
      isSample: false,
      videoUrl: "",
      thumbnailUrl: "",
      createdAt: "2026-03-14T14:30:00.000Z",
      hasScript: true,
      hasTimecodes: true,
      hasVideoFile: false,
      feedbackCount: 0,
      activeRunId: null,
      feedbacks: [],
      versions: [
        {
          versionId: "v1",
          name: "Phiên bản v1",
          status: "current",
          releaseStatus: "has_video",
          createdAt: "2026-03-14T14:30:00.000Z",
          description: "Kịch bản bài học đã duyệt, đang chờ thu âm tệp MP4.",
          durationSeconds: 156,
          sentenceCount: 20,
        },
      ],
    },
    {
      id: "prompt-engineering",
      title: "Kỹ thuật Viết Prompt Hiệu Quả cho LLM",
      description:
        "Hướng dẫn thiết kế prompt theo công thức 4 thành phần: Vai trò (Role), Ngữ cảnh (Context), Nhiệm vụ (Task) và Ràng buộc định dạng (Output constraints).",
      durationSeconds: 118,
      currentVersion: "v1",
      isSample: false,
      videoUrl: "",
      thumbnailUrl: "",
      createdAt: "2026-03-16T09:15:00.000Z",
      hasScript: false,
      hasTimecodes: false,
      hasVideoFile: true,
      feedbackCount: 0,
      activeRunId: null,
      feedbacks: [],
      versions: [
        {
          versionId: "v1",
          name: "Bản quay thô v1",
          status: "current",
          releaseStatus: "has_video",
          createdAt: "2026-03-16T09:15:00.000Z",
          description:
            "Video quay thô từ giảng viên; cần bổ sung tệp kịch bản và timecode để đồng bộ câu.",
          durationSeconds: 118,
          sentenceCount: 0,
        },
      ],
    },
  ];
}
