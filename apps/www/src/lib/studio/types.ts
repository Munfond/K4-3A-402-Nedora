import type { FeedbackItem, ScriptData } from "@/lib/revision/types";

export type LocationSource = "nguoi-chon" | "ai-de-xuat" | "chua-xac-dinh";

export interface StudioFeedback extends FeedbackItem {
  locationSource: LocationSource;
  sentenceN?: number;
  timeSeconds?: number;
}

export interface StudioVersion {
  versionId: string; // e.g. "v1", "v2"
  name: string;
  status: "current" | "draft" | "archived";
  releaseStatus: "has_video" | "draft_plan_only" | "planned";
  createdAt: string;
  description?: string;
  durationSeconds?: number;
  sentenceCount?: number;
}

export interface StudioVideo {
  id: string; // e.g. "d1"
  title: string;
  description: string;
  thumbnailUrl?: string;
  videoUrl?: string; // e.g. "/video/d1.mp4"
  durationSeconds: number; // e.g. 251
  currentVersion: string; // e.g. "v1"
  isSample?: boolean; // true for D1 ("Dữ liệu mẫu")
  createdAt: string;
  // Checklist trạng thái dữ liệu (để hiển thị trung thực khi thiếu dữ liệu)
  hasScript: boolean;
  hasTimecodes: boolean;
  hasVideoFile: boolean;
  // Số góp ý & đợt sửa
  feedbackCount: number;
  activeRunId?: string | null;
  // Kịch bản và danh sách phiên bản
  script?: ScriptData;
  versions: StudioVersion[];
  feedbacks: StudioFeedback[];
}
