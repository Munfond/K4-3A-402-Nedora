import type { Intent, Claim } from "../claims/types";
import type { IssueV3, ProtectedZone } from "../issues/form";
import type { Change, PlanSimulation } from "../timeline/types";
import type { VideoIndex } from "../video-index/types";
import type { ScriptProposal } from "@feedback/ai";

export interface HandlerQuestion {
  id: string;
  noiDung: string;
  luaChon: string[];
  gopYIds: string[];
  moPhongLuaChon?: Array<{
    luaChon: string;
    deltaTong: number;
    canhDungLai: number[];
  }>;
}

export interface HandlerResult {
  vanDeId: string;
  nhom: "bien-kich" | "thu-am" | "dung-hinh" | "am-thanh" | "phu-de";
  uuTien: number;
  lyDoUuTien: string;
  viTri: {
    ns: number[];
    v1: [number, number];
    v2?: [number, number];
  };
  bangChungDo?: string;
  deXuat?: unknown;
  cachKhac?: unknown;
  changes: Change[];
  chiPhi?: PlanSimulation;
  cauHoi?: HandlerQuestion[];
  ghiNhan?: Array<{ gopYIds: string[]; lyDo: string }>;
  vungBaoVe?: Array<{ ns: number[]; gopYIds: string[] }>;
  canhBao?: string[];
  ketLuan?: string;
}

export interface HandlerContext {
  issue: IssueV3;
  claims?: Claim[];
  videoIndex: VideoIndex;
  vungBaoVe?: ProtectedZone[];
  nganSach?: { cauThuLai: number; deltaTongGiay: number };
  mode?: "k1" | "k2";
  model?: any;
  signal?: AbortSignal;
}
