import { countSyllables } from "../video-index/pace";
import type { VideoIndex } from "../video-index/types";
import { estimateSentenceDuration } from "./duration";
import type { Change, PlanSimulation } from "./types";

/**
 * Mô phỏng timeline v2 sau khi áp dụng tập các thay đổi (Changes).
 * Tính toán độ trượt tích lũy (accumulated shift), các mốc thời gian mới,
 * và kiểm tra các ràng buộc kỹ thuật T1 - T6.
 */
export function simulateTimeline(
  videoIndex: VideoIndex,
  changes: Change[],
  protectedZones: number[] = [1, 2, 3],
): PlanSimulation {
  const changeBySentence = new Map<number, Change[]>();
  for (const ch of changes) {
    if ("n" in ch) {
      const list = changeBySentence.get(ch.n) || [];
      list.push(ch);
      changeBySentence.set(ch.n, list);
    }
  }

  const thuLaiSet = new Set<number>();
  let kyTuThuLai = 0;
  const canhDungLaiSet = new Set<number>();
  let affectedSubtitleCount = 0;

  const mocV2: PlanSimulation["mocV2"] = [];
  const viPham: PlanSimulation["viPham"] = [];
  const chongLan: PlanSimulation["chongLan"] = [];

  let accumulatedShift = 0;
  const totalChars = videoIndex.segments.reduce(
    (acc, s) => acc + (s.loi ? s.loi.length : 0),
    0,
  );
  const totalSlides =
    new Set(videoIndex.segments.map((s) => s.slideId).filter(Boolean)).size ||
    40;

  for (const segment of videoIndex.segments) {
    const sChanges = changeBySentence.get(segment.n) || [];
    const loiChange = sChanges.find((c) => c.kind === "loi") as
      | { kind: "loi"; n: number; after: string }
      | undefined;
    const dungChange = sChanges.find((c) => c.kind === "dung") as
      | { kind: "dung"; n: number; giay: number }
      | undefined;
    const visualChange = sChanges.find(
      (c) => c.kind === "chuTrenManHinh" || c.kind === "yDoHinh",
    );

    const oldDuration = segment.ketThuc - segment.batDau;
    let newDuration = oldDuration;
    let currentLoi = segment.loi || "";

    if (loiChange) {
      currentLoi = loiChange.after;
      thuLaiSet.add(segment.n);
      kyTuThuLai += currentLoi.length;

      // Tính thời lượng mới theo tốc độ giọng đọc trung bình
      const est = estimateSentenceDuration(
        currentLoi,
        videoIndex.tocDoGiong.trungBinh,
        dungChange ? dungChange.giay : segment.khoangLangCuoi,
      );
      newDuration = est.totalDuration;

      // Kiểm tra T1: Tốc độ nói mới không vượt ngưỡng
      const newSyllables = countSyllables(currentLoi);
      const speechDur = Math.max(0.1, est.speechDuration);
      const newPace = newSyllables / speechDur;
      if (newPace > 6.0) {
        viPham.push({
          ma: "T1",
          n: segment.n,
          chiTiet: `Câu ${segment.n} có tốc độ nói dự kiến ${newPace.toFixed(1)} âm tiết/s (> 6.0: nguy cơ nuốt chữ)`,
        });
      } else if (newPace < 2.5) {
        viPham.push({
          ma: "T1",
          n: segment.n,
          chiTiet: `Câu ${segment.n} có tốc độ nói dự kiến ${newPace.toFixed(1)} âm tiết/s (< 2.5: quá chậm)`,
        });
      }

      // Kiểm tra T2: Dung sai thời lượng câu (|delta| <= 3.0s đối với câu đơn)
      const deltaSentence = newDuration - oldDuration;
      if (Math.abs(deltaSentence) > 3.0 && !visualChange) {
        viPham.push({
          ma: "T2",
          n: segment.n,
          chiTiet: `Câu ${segment.n} lệch thời lượng ${deltaSentence > 0 ? "+" : ""}${deltaSentence.toFixed(1)}s so với ban đầu (> 3.0s)`,
        });
      }

      // Kiểm tra T6: Chuỗi phụ thuộc Slide (Slide Chains)
      if (segment.tinHieuHinh.soCauCungSlide > 1) {
        chongLan.push({
          loai: "cung-slide",
          ns: [segment.n],
          xuLy: `Câu ${segment.n} nằm trong chuỗi slide ${segment.slideId || ""} cùng ${segment.tinHieuHinh.soCauCungSlide} câu khác, cần đồng bộ slide`,
        });
        if (Math.abs(deltaSentence) > 1.5 && !visualChange) {
          viPham.push({
            ma: "T6",
            n: segment.n,
            chiTiet: `Câu ${segment.n} làm lệch slide ${segment.slideId || ""} nhưng chưa được gắn việc re-render slide`,
          });
        }
      }

      // Kiểm tra vùng bảo vệ
      if (protectedZones.includes(segment.n)) {
        chongLan.push({
          loai: "vung-bao-ve",
          ns: [segment.n],
          xuLy: `Câu ${segment.n} thuộc vùng giới thiệu cốt lõi được bảo vệ`,
        });
      }
    } else if (dungChange) {
      const deltaDung = dungChange.giay - segment.khoangLangCuoi;
      newDuration = Math.max(0.5, oldDuration + deltaDung);
    }

    if (visualChange || loiChange || dungChange) {
      canhDungLaiSet.add(segment.n);
      if (segment.slideDungDan || segment.slideId) {
        const chain = videoIndex.slideChains?.find(
          (sc) => sc.slideId === segment.slideId || sc.cau.includes(segment.n),
        );
        if (chain) {
          for (const cNum of chain.cau) {
            if (visualChange || cNum >= segment.n) {
              canhDungLaiSet.add(cNum);
            }
          }
        }
      }
    }

    if (
      segment.trangPhuDe.length > 0 &&
      (loiChange || Math.abs(newDuration - oldDuration) > 0.5)
    ) {
      affectedSubtitleCount += segment.trangPhuDe.length;
    }

    // Tính mốc thời gian v2 với độ trượt tích lũy
    const batDauV2 = Math.round((segment.batDau + accumulatedShift) * 10) / 10;
    const ketThucV2 = Math.round((batDauV2 + newDuration) * 10) / 10;

    mocV2.push({
      n: segment.n,
      batDau: batDauV2,
      ketThuc: ketThucV2,
      dai: [batDauV2, ketThucV2],
    });

    // Cập nhật độ trượt tích lũy cho các câu sau
    const sentenceDelta = newDuration - oldDuration;
    accumulatedShift += sentenceDelta;

    // Kiểm tra T4: Khoảng lặng tối thiểu >= 0.3s
    const effectiveSilence = dungChange
      ? dungChange.giay
      : segment.khoangLangCuoi;
    if (effectiveSilence < 0.3) {
      viPham.push({
        ma: "T4",
        n: segment.n,
        chiTiet: `Câu ${segment.n} có khoảng lặng cuối ${effectiveSilence}s (< 0.3s tiêu chuẩn)`,
      });
    }

    // Kiểm tra T5: Tốc độ đọc chữ màn hình
    const chuLen = segment.tinHieuHinh.doDaiChuManHinh;
    if (chuLen > 0 && newDuration > 0) {
      const charRate = chuLen / newDuration;
      if (charRate > 22.0) {
        viPham.push({
          ma: "T5",
          n: segment.n,
          chiTiet: `Chữ màn hình câu ${segment.n} hiển thị ở tốc độ ${charRate.toFixed(1)} ký tự/s (> 22 ký tự/s)`,
        });
      }
    }
  }

  // Kiểm tra T3: Tổng độ lệch thời lượng video (|accumulatedShift| <= 10.0s)
  const deltaTong = Math.round(accumulatedShift * 10) / 10;
  if (Math.abs(deltaTong) > 10.0) {
    viPham.push({
      ma: "T3",
      chiTiet: `Tổng độ lệch thời lượng video là ${deltaTong > 0 ? "+" : ""}${deltaTong}s, vượt ngưỡng an toàn ±10.0s`,
    });
  }

  // Cập nhật mốc chương v2
  const chuongV2: PlanSimulation["chuong"] = videoIndex.chuong.map((ch) => {
    // Tìm câu đầu tiên của chương
    const firstSent = videoIndex.segments.find((s) => s.phan === ch.phan);
    const v2Match = firstSent
      ? mocV2.find((m) => m.n === firstSent.n)
      : undefined;
    return {
      phan: ch.phan,
      batDau: v2Match ? v2Match.batDau : ch.batDau,
    };
  });

  const thuLai = Array.from(thuLaiSet).sort((a, b) => a - b);
  const canhDungLai = Array.from(canhDungLaiSet).sort((a, b) => a - b);

  const charSavings =
    totalChars > 0 ? Math.round((1 - kyTuThuLai / totalChars) * 100) : 100;
  const slideSavings =
    totalSlides > 0
      ? Math.round((1 - canhDungLai.length / totalSlides) * 100)
      : 100;

  return {
    thuLai,
    kyTuThuLai,
    canhDungLai,
    trangPhuDe: affectedSubtitleCount,
    deltaTong,
    mocV2,
    chuong: chuongV2,
    viPham,
    chongLan,
    soVoiLamLaiToanBo: {
      kyTu: Math.max(0, charSavings),
      canh: Math.max(0, slideSavings),
    },
  };
}
