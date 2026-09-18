import type { VideoIndex } from "../video-index/types";
import type { PlanSimulation, RevisionBudgetSummary } from "./types";

/**
 * Ngưỡng ngân sách an toàn mặc định theo TK §5:
 * - Tối đa 8 câu thu lại (khoảng 701 ký tự) thay vì 21 câu như revision@2
 * - Tổng độ lệch thời lượng |delta| <= 10.0s
 */
export const DEFAULT_BUDGET_CONSTRAINTS = {
  maxSentencesToReRecord: 8,
  maxDeltaDurationSeconds: 10.0,
};

/**
 * Tính toán tác động ngân sách và tài nguyên sản xuất thực tế:
 * - Giờ thu âm của diễn viên lồng tiếng (Voice Talent)
 * - Giờ dựng hình / render đồ họa (Motion Graphics)
 * - Giờ hậu kỳ âm thanh (Audio Mixing)
 * - % chi phí tiết kiệm so với việc đập đi làm lại toàn bộ video
 */
export function calculateRevisionBudget(
  simulation: PlanSimulation,
  _videoIndex: VideoIndex,
): RevisionBudgetSummary {
  const soCauThuLai = simulation.thuLai.length;
  const tongKyTuThuLai = simulation.kyTuThuLai;
  const soSlideCanRender = simulation.canhDungLai.length;
  const soTrangPhuDeChinhSua = simulation.trangPhuDe;
  const deltaThoiLuongGiay = simulation.deltaTong;

  // Ước tính giờ công chuyên môn:
  // Thu âm: ~0.15 giờ (9 phút) cho mỗi câu cần thu lại (gồm setup, thu nhiều take, lọc tạp âm)
  const gioThuAmUocTinh = Math.round(soCauThuLai * 0.15 * 10) / 10;

  // Render đồ họa: ~0.4 giờ (24 phút) cho mỗi slide cần sửa layout / re-render
  const gioRenderUocTinh = Math.round(soSlideCanRender * 0.4 * 10) / 10;

  // Mix âm thanh: 0.8 giờ nếu có lệch thời lượng, 0.2 giờ nếu thời lượng giữ nguyên
  const gioAudioMixUocTinh =
    deltaThoiLuongGiay !== 0 ? 0.8 : soCauThuLai > 0 ? 0.3 : 0.1;

  // % tiết kiệm trung bình giữa ký tự thoại và cảnh dựng so với làm lại 100%
  const phanTramTietKiemSoVoiLamLai = Math.round(
    (simulation.soVoiLamLaiToanBo.kyTu + simulation.soVoiLamLaiToanBo.canh) / 2,
  );

  // Kiểm tra ngưỡng ngân sách an toàn
  const datNguongNganSach =
    soCauThuLai <= DEFAULT_BUDGET_CONSTRAINTS.maxSentencesToReRecord &&
    Math.abs(deltaThoiLuongGiay) <=
      DEFAULT_BUDGET_CONSTRAINTS.maxDeltaDurationSeconds;

  return {
    soCauThuLai,
    tongKyTuThuLai,
    soSlideCanRender,
    soTrangPhuDeChinhSua,
    deltaThoiLuongGiay,
    gioThuAmUocTinh,
    gioRenderUocTinh,
    gioAudioMixUocTinh,
    phanTramTietKiemSoVoiLamLai,
    datNguongNganSach,
  };
}
