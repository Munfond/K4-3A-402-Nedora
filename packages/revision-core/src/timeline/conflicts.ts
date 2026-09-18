import type { VideoIndex } from "../video-index/types";
import { simulateTimeline } from "./simulate";
import type { Change, Conflict } from "./types";

/**
 * Phát hiện 6 loại xung đột trong kế hoạch chỉnh sửa:
 * 1. ghi-de-loi-nhieu-lan: Nhiều phương án cùng sửa 1 câu với nội dung khác nhau
 * 2. lech-thoi-gian-vuot-nguong: |Delta tổng thời lượng| > 10s
 * 3. nhanh-cham-trai-nguoc: Một nơi kéo dài, một nơi rút ngắn trái ngược trong cùng phân đoạn
 * 4. sua-vung-bao-ve: Sửa vào vùng được đánh dấu bảo vệ / vùng giới thiệu cốt lõi
 * 5. lech-slide-chua-re-render: Câu bị co/dãn làm lệch slide nhưng chưa đánh dấu re-render
 * 6. lech-nhac-chua-mix: Sửa thời lượng đoạn có nhạc nền nhưng chưa có việc mix lại nhạc
 */
export function detectConflicts(
  videoIndex: VideoIndex,
  changes: Change[],
  protectedZones: number[] = [1, 2, 3],
): Conflict[] {
  const conflicts: Conflict[] = [];
  let confIdx = 1;

  // 1. Ghi đè lời nhiều lần (ghi-de-loi-nhieu-lan)
  const loiChangesBySentence = new Map<number, string[]>();
  for (const ch of changes) {
    if (ch.kind === "loi") {
      const list = loiChangesBySentence.get(ch.n) || [];
      list.push(ch.after.trim());
      loiChangesBySentence.set(ch.n, list);
    }
  }

  for (const [n, texts] of loiChangesBySentence.entries()) {
    const uniqueTexts = Array.from(new Set(texts));
    if (uniqueTexts.length > 1) {
      conflicts.push({
        id: `conf-ghi-de-${confIdx++}`,
        type: "ghi-de-loi-nhieu-lan",
        severity: "chan",
        affectedSentences: [n],
        description: `Câu ${n} đang có ${uniqueTexts.length} phương án sửa lời khác nhau cùng áp dụng`,
        resolutionOptions: uniqueTexts.map((txt, idx) => ({
          id: `opt-chon-${idx + 1}`,
          label: `Chọn phương án ${idx + 1}`,
          description: `Giữ lời: "${txt.slice(0, 45)}..."`,
        })),
      });
    }
  }

  // 2. Chạy mô phỏng để kiểm tra lệch thời gian và trượt slide
  const simulation = simulateTimeline(videoIndex, changes, protectedZones);

  // 2a. Lệch thời gian vượt ngưỡng (lech-thoi-gian-vuot-nguong)
  if (Math.abs(simulation.deltaTong) > 10.0) {
    conflicts.push({
      id: `conf-lech-tong-${confIdx++}`,
      type: "lech-thoi-gian-vuot-nguong",
      severity: "chan",
      affectedSentences: simulation.thuLai,
      description: `Tổng thời lượng video lệch ${simulation.deltaTong > 0 ? "+" : ""}${simulation.deltaTong}s, vượt ngưỡng an toàn ±10.0s`,
      resolutionOptions: [
        {
          id: "opt-co-khoang-lang",
          label: "Co ngắn khoảng lặng giữa các câu",
          description:
            "Tự động giảm bớt khoảng lặng để đưa tổng thời lượng về dưới ±10s",
        },
        {
          id: "opt-rut-ngan-loi",
          label: "Rút ngắn lời các câu dài",
          description: "Biên tập lại các câu mới để giảm bớt số lượng âm tiết",
        },
      ],
    });
  }

  // 3. Sửa vào vùng bảo vệ (sua-vung-bao-ve)
  const modifiedProtected = simulation.thuLai.filter((n) =>
    protectedZones.includes(n),
  );
  if (modifiedProtected.length > 0) {
    conflicts.push({
      id: `conf-bao-ve-${confIdx++}`,
      type: "sua-vung-bao-ve",
      severity: "canh-bao",
      affectedSentences: modifiedProtected,
      description: `Kế hoạch đang sửa câu ${modifiedProtected.join(", ")} thuộc vùng cốt lõi được bảo vệ`,
      resolutionOptions: [
        {
          id: "opt-xac-nhan-sua",
          label: "Xác nhận vẫn sửa vùng bảo vệ",
          description: "Người dùng đồng ý cho phép ghi đè lên các câu cốt lõi",
        },
        {
          id: "opt-bo-qua-sua",
          label: "Bỏ qua thay đổi vùng này",
          description: "Khôi phục lại lời gốc của các câu bảo vệ",
        },
      ],
    });
  }

  // 4. Lệch slide chưa re-render (lech-slide-chua-re-render)
  const visualReRenderSentences = new Set<number>();
  for (const ch of changes) {
    if (ch.kind === "chuTrenManHinh" || ch.kind === "yDoHinh") {
      visualReRenderSentences.add(ch.n);
    }
  }

  for (const s of videoIndex.segments) {
    const isThuLai = simulation.thuLai.includes(s.n);
    if (!isThuLai) continue;

    const oldDur = s.ketThuc - s.batDau;
    const moc = simulation.mocV2.find((m) => m.n === s.n);
    const newDur = moc ? moc.ketThuc - moc.batDau : oldDur;
    const delta = Math.abs(newDur - oldDur);

    if (delta > 1.5 && s.slideId && !visualReRenderSentences.has(s.n)) {
      conflicts.push({
        id: `conf-slide-${confIdx++}`,
        type: "lech-slide-chua-re-render",
        severity: "canh-bao",
        affectedSentences: [s.n],
        affectedSlideIds: [s.slideId],
        description: `Câu ${s.n} thay đổi thời lượng ${delta.toFixed(1)}s làm lệch slide ${s.slideId} nhưng slide chưa có việc re-render`,
        resolutionOptions: [
          {
            id: "opt-them-re-render",
            label: `Thêm nhiệm vụ re-render slide ${s.slideId}`,
            description:
              "Giao việc cho họa sĩ / kỹ thuật viên đồ họa cập nhật slide",
          },
          {
            id: "opt-can-chinh-loi",
            label: "Căn chỉnh lại số chữ của lời mới",
            description: "Viết lại lời để thời lượng khớp sát với độ dài cũ",
          },
        ],
      });
    }
  }

  // 5. Lệch nhạc chưa mix (lech-nhac-chua-mix)
  const hasMixTask = changes.some(
    (ch) => ch.kind === "ky-thuat" && ch.viec === "mix",
  );
  const musicZoneSentences = [11, 12, 13, 14, 15, 16, 17, 18, 19];
  const modifiedInMusicZone = simulation.thuLai.filter((n) =>
    musicZoneSentences.includes(n),
  );

  if (modifiedInMusicZone.length > 0 && !hasMixTask) {
    conflicts.push({
      id: `conf-nhac-${confIdx++}`,
      type: "lech-nhac-chua-mix",
      severity: "canh-bao",
      affectedSentences: modifiedInMusicZone,
      description: `Các câu ${modifiedInMusicZone.join(", ")} nằm trong phân đoạn có nhạc nền nhưng chưa có đầu việc mix lại âm thanh`,
      resolutionOptions: [
        {
          id: "opt-them-viec-mix",
          label: "Bổ sung đầu việc mix lại nhạc nền",
          description:
            "Tự động thêm nhiệm vụ kỹ thuật hạ âm lượng nhạc nền xuống -20dB",
        },
        {
          id: "opt-bo-qua-mix",
          label: "Giữ nguyên bản phối hiện tại",
          description: "Chấp nhận không xử lý lại track nhạc nền",
        },
      ],
    });
  }

  // 6. Nhanh chậm trái ngược (nhanh-cham-trai-nguoc)
  // Phát hiện nếu trong cùng 1 phân đoạn có câu vừa bị tăng mạnh vừa bị giảm mạnh
  for (const ch of videoIndex.chuong) {
    const chapterSentences = videoIndex.segments
      .filter((s) => s.phan === ch.phan)
      .map((s) => s.n);
    const chapterDeltas: Array<{ n: number; delta: number }> = [];

    for (const n of chapterSentences) {
      if (!simulation.thuLai.includes(n)) continue;
      const seg = videoIndex.segments.find((s) => s.n === n);
      const moc = simulation.mocV2.find((m) => m.n === n);
      if (seg && moc) {
        chapterDeltas.push({
          n,
          delta: moc.ketThuc - moc.batDau - (seg.ketThuc - seg.batDau),
        });
      }
    }

    const hasSignificantIncrease = chapterDeltas.some((d) => d.delta >= 2.5);
    const hasSignificantDecrease = chapterDeltas.some((d) => d.delta <= -2.5);

    if (hasSignificantIncrease && hasSignificantDecrease) {
      conflicts.push({
        id: `conf-trai-nguoc-${confIdx++}`,
        type: "nhanh-cham-trai-nguoc",
        severity: "canh-bao",
        affectedSentences: chapterDeltas.map((d) => d.n),
        description: `Phần ${ch.phan} (${ch.ten}) có xung đột nhịp điệu: vừa có câu kéo dài thêm > 2.5s vừa có câu rút ngắn > 2.5s`,
        resolutionOptions: [
          {
            id: "opt-can-bang-nhip",
            label: "Cân bằng lại độ dài các câu trong phân đoạn",
            description: "Điều chỉnh lời thoại để giữ nhịp điệu ổn định",
          },
        ],
      });
    }
  }

  return conflicts;
}
