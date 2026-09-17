export interface PipelineNodeDef {
  id: string; // ổn định, không chứa chỉ số lần lặp
  label: string; // nhãn cho người dùng
  kind: "code" | "ai" | "iteration" | "human";
  next: string[];
  childOf?: string; // node con của iteration
  userVisible: boolean; // hiện ở màn người dùng hay chỉ ở debug
}

export type GraphNodeDefinition = PipelineNodeDef;

export const GRAPH_VERSION = "revision@2";

export const PIPELINE_GRAPH: PipelineNodeDef[] = [
  {
    id: "nhan-dau-vao",
    label: "Chuẩn bị dữ liệu",
    kind: "code",
    next: ["lam-sach"],
    userVisible: true,
  },
  {
    id: "lam-sach",
    label: "Làm sạch & an toàn",
    kind: "code",
    next: ["hieu-gop-y"],
    userVisible: false,
  },
  {
    id: "hieu-gop-y",
    label: "Hiểu góp ý",
    kind: "ai",
    next: ["kiem-tra-hieu"],
    userVisible: true,
  },
  {
    id: "kiem-tra-hieu",
    label: "Kiểm tra hiểu",
    kind: "code",
    next: ["lap-ho-so"],
    userVisible: false,
  },
  {
    id: "lap-ho-so",
    label: "Lập hồ sơ vùng",
    kind: "code",
    next: ["lap-phuong-an"],
    userVisible: true,
  },
  {
    id: "lap-phuong-an",
    label: "Đề xuất cách sửa",
    kind: "iteration",
    next: ["cho-duyet"],
    userVisible: true,
  },
  {
    id: "de-xuat",
    label: "Đề xuất phương án",
    kind: "ai",
    childOf: "lap-phuong-an",
    next: ["kiem-tra-de-xuat"],
    userVisible: false,
  },
  {
    id: "kiem-tra-de-xuat",
    label: "Kiểm tra đề xuất",
    kind: "code",
    childOf: "lap-phuong-an",
    next: ["tinh-pham-vi"],
    userVisible: false,
  },
  {
    id: "tinh-pham-vi",
    label: "Tính phạm vi",
    kind: "code",
    childOf: "lap-phuong-an",
    next: [],
    userVisible: false,
  },
  {
    id: "cho-duyet",
    label: "Chờ bạn duyệt",
    kind: "human",
    next: ["ap-dung"],
    userVisible: true,
  },
  {
    id: "ap-dung",
    label: "Áp dụng quyết định",
    kind: "code",
    next: ["xuat-goi"],
    userVisible: false,
  },
  {
    id: "xuat-goi",
    label: "Xuất gói",
    kind: "code",
    next: [],
    userVisible: false,
  },
];

export function getNodeDef(nodeId: string): PipelineNodeDef | undefined {
  return PIPELINE_GRAPH.find((n) => n.id === nodeId);
}

export function getUserVisibleNodes(): PipelineNodeDef[] {
  return PIPELINE_GRAPH.filter((n) => n.userVisible);
}
