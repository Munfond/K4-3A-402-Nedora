import lexiconData from "./moderation-lexicon.json" with { type: "json" };

export interface ModerationLexicon {
  version: string;
  caiLenh: {
    dongTu: string[];
    doiTuong: string[];
    vaiTro: string[];
    dauVaiTro: string[];
    thaoTung: string[];
  };
  congKich: {
    tu: string[];
    doiTuongNguoi: string[];
  };
  thoTuc: string[];
  teencode: Record<string, string>;
  lacDe: string[];
  camXuc: string[];
}

export const LEXICON: ModerationLexicon = lexiconData as ModerationLexicon;
