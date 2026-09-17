import { loadScriptD1, loadD1RawFeedback } from "@/lib/revision/load";
import { sanitizeFeedbackItem } from "@/lib/revision/sanitize";
import type { StudioFeedback, StudioVideo, LocationSource } from "./types";

// Seed danh sách video mẫu của Studio
export function getInitialVideos(): StudioVideo[] {
  // Nạp kịch bản D1 mẫu nếu đang chạy server-side
  let scriptD1;
  let d1Feedbacks: StudioFeedback[] = [];

  try {
    scriptD1 = loadScriptD1();
    const rawF = loadD1RawFeedback();
    d1Feedbacks = rawF.map((item) => {
      // Gán locationSource thực tế dựa trên nội dung
      let locationSource: LocationSource = "chua-xac-dinh";
      let sentenceN: number | undefined;
      let timeSeconds: number | undefined;

      const txt = (item.sanitizedText || "").toLowerCase();
      if (txt.includes("câu 23") || txt.includes("23")) {
        locationSource = "nguoi-chon";
        sentenceN = 23;
        timeSeconds = 121;
      } else if (
        txt.includes("câu 10") ||
        txt.includes("câu 11") ||
        txt.includes("học máy") ||
        txt.includes("spam")
      ) {
        locationSource = "ai-de-xuat";
        sentenceN = 10;
        timeSeconds = 65;
      } else if (
        txt.includes("phút 2") ||
        txt.includes("02:00") ||
        txt.includes("đoạn đầu")
      ) {
        locationSource = "nguoi-chon";
        timeSeconds = 120;
        sentenceN = 22;
      } else if (item.channel === "khao-sat" && !item.sanitizedText) {
        locationSource = "chua-xac-dinh";
      }

      return {
        ...item,
        locationSource,
        sentenceN,
        timeSeconds,
      };
    });
  } catch (err) {
    // Client fallback nếu không nạp trực tiếp được từ fs
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
      hasScript: true,
      hasTimecodes: true,
      hasVideoFile: true,
      feedbackCount: 22,
      activeRunId: null,
      script: scriptD1,
      feedbacks: d1Feedbacks,
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
