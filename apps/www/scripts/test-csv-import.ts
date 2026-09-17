import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  parseSurveyCsv,
  detectDelimiter,
  computeFeedbackFingerprint,
  CSV_MAX_ROWS,
} from "../src/lib/studio/csv-import";
import { loadD1RawFeedback } from "../src/lib/revision/load";

async function runTests() {
  console.log("======================================================");
  console.log("CHẠY BỘ KIỂM THỬ CSV IMPORT VÀ INGESTION CASES (C4)");
  console.log("======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ ĐẠT: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ THẤT BẠI: ${testName}`);
      if (detail) console.error(`    Chi tiết: ${detail}`);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Kiểm thử các case trong eval/ingestion-cases.v1.json (ING-01, ING-02, ING-03)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(
    "[PHẦN 1] Kiểm tra Ingestion Cases từ eval/ingestion-cases.v1.json",
  );
  const repoRoot =
    process.cwd().endsWith("apps/www") || process.cwd().endsWith("apps\\www")
      ? join(process.cwd(), "../..")
      : process.cwd();
  const ingestionCasesPath = join(repoRoot, "eval/ingestion-cases.v1.json");
  if (!existsSync(ingestionCasesPath)) {
    throw new Error(`Không tìm thấy file: ${ingestionCasesPath}`);
  }

  const ingestionConfig = JSON.parse(readFileSync(ingestionCasesPath, "utf-8"));
  const dataDir = join(repoRoot, "apps/www/src/data");
  const d1Feedbacks = loadD1RawFeedback(dataDir);

  // ING-01
  const ing01 = ingestionConfig.cases.find((c: any) => c.caseId === "ING-01");
  if (ing01) {
    const totalCount = d1Feedbacks.length;
    const modelInputCount = d1Feedbacks.filter(
      (f) => f.label !== "chi-cham-diem",
    ).length;
    const senders = new Set(d1Feedbacks.map((f) => f.sender));

    assert(
      totalCount === ing01.expected.normalizedCount,
      "ING-01: Tổng số góp ý chuẩn hóa = 22",
      `Thực tế: ${totalCount}, Kỳ vọng: ${ing01.expected.normalizedCount}`,
    );

    assert(
      modelInputCount === ing01.expected.modelInputCount,
      "ING-01: Số góp ý gửi model = 21",
      `Thực tế: ${modelInputCount}, Kỳ vọng: ${ing01.expected.modelInputCount}`,
    );

    assert(
      senders.size === ing01.expected.independentSenderCount,
      "ING-01: Số người gửi độc lập = 20",
      `Thực tế: ${senders.size}, Kỳ vọng: ${ing01.expected.independentSenderCount}`,
    );

    const mergedFound = ing01.expected.mergedIds.every((id: string) =>
      d1Feedbacks.some((f) => f.id === id),
    );
    assert(mergedFound, "ING-01: Chứa đủ 6 ID gộp giữa JSON và CSV");
  }

  // ING-02
  const ing02 = ingestionConfig.cases.find((c: any) => c.caseId === "ING-02");
  if (ing02) {
    const gy001 = d1Feedbacks.find((f) => f.id === "gy-001");
    assert(
      Boolean(gy001 && gy001.sanitizedText.includes("Đoạn giữa hơi nhanh")),
      "ING-02: gy-001 ưu tiên text từ JSON",
      `Text: ${gy001?.sanitizedText}`,
    );
    assert(
      gy001?.survey?.deHieu === 3 && gy001?.survey?.nhipDo === 2,
      "ING-02: gy-001 lấy điểm dễ hiểu & nhịp độ từ CSV",
      `deHieu: ${gy001?.survey?.deHieu}, nhipDo: ${gy001?.survey?.nhipDo}`,
    );
  }

  // ING-03
  const ing03 = ingestionConfig.cases.find((c: any) => c.caseId === "ING-03");
  if (ing03) {
    const gy019 = d1Feedbacks.find((f) => f.id === "gy-019");
    assert(
      gy019?.label === "chi-cham-diem",
      "ING-03: gy-019 không có text được gán nhãn chi-cham-diem",
      `Label: ${gy019?.label}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Kiểm thử dấu phân cách ';' (Excel VN)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[PHẦN 2] Kiểm tra định dạng Excel VN (dấu chấm phẩy ';')");
  const semiCsv = [
    "ma_gop_y;nguoi_gui;de_hieu_1_5;nhip_do_1_5;y_kien_them",
    "ks-001;hv-999;4;3;Bài giảng rất hay",
    "ks-002;hv-998;2;5;Nói hơi nhanh ở đoạn đầu",
  ].join("\r\n");

  const delimiterDetected = detectDelimiter(
    "ma_gop_y;nguoi_gui;de_hieu_1_5;nhip_do_1_5;y_kien_them",
  );
  assert(
    delimiterDetected === ";",
    "Nhận diện chính xác dấu phân cách ';'",
    `Phát hiện: ${delimiterDetected}`,
  );

  const semiResult = parseSurveyCsv(semiCsv);
  assert(
    semiResult.rows.length === 2,
    "Parse thành công 2 dòng phân cách bằng ';'",
    `Số dòng: ${semiResult.rows.length}`,
  );
  assert(
    semiResult.rows[0].text === "Bài giảng rất hay" &&
      semiResult.rows[0].survey?.deHieu === 4,
    "Trường text và điểm số khớp chính xác với delimiter ';'",
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Kiểm thử ô nhiều dòng trong ngoặc kép
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[PHẦN 3] Kiểm tra ô chứa xuống dòng trong ngoặc kép");
  const multilineCsv = [
    "id,nguoi_gui,noi_dung",
    'bl-01,hv-111,"Đoạn này câu chữ rất dài,\nxuống dòng lần 1,\nxuống dòng lần 2."',
    'bl-02,hv-222,"Bình luận bình thường"',
  ].join("\n");

  const multilineResult = parseSurveyCsv(multilineCsv);
  assert(
    multilineResult.rows.length === 2,
    "Parse đúng 2 bản ghi mặc dù có ô chứa nhiều dòng",
    `Số dòng: ${multilineResult.rows.length}`,
  );
  assert(
    multilineResult.rows[0].text.includes("xuống dòng lần 1") &&
      multilineResult.rows[0].text.includes("xuống dòng lần 2"),
    "Nội dung nhiều dòng được giữ trọn vẹn trong ô",
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Kiểm thử UTF-8 BOM (\uFEFF)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[PHẦN 4] Kiểm tra UTF-8 BOM");
  const bomCsv =
    "\uFEFF" +
    [
      "ma_gop_y,nguoi_gui,de_hieu_1_5,nhip_do_1_5,y_kien_them",
      "ks-bom-1,hv-bom,5,5,File xuất từ Excel có BOM",
    ].join("\n");

  const bomResult = parseSurveyCsv(bomCsv);
  assert(
    bomResult.rows.length === 1,
    "Bỏ qua UTF-8 BOM thành công và đọc đúng 1 dòng",
  );
  assert(
    bomResult.format === "khao-sat",
    "Định dạng nhận diện đúng là 'khao-sat' (không bị lỗi tên cột đầu)",
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Kiểm thử dòng trống và dòng chỉ có điểm
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[PHẦN 5] Kiểm tra dòng trống và dòng chỉ có điểm");
  const blankScoreCsv = [
    "ma_gop_y,nguoi_gui,de_hieu_1_5,nhip_do_1_5,y_kien_them",
    "ks-empty-1,hv-001,,,,", // dòng trống không chữ không điểm
    "ks-score-only,hv-002,4,5,", // dòng chỉ có điểm
    ",,,,", // dòng hoàn toàn rỗng
    "ks-valid,hv-003,3,3,Có nhận xét",
  ].join("\n");

  const blankScoreResult = parseSurveyCsv(blankScoreCsv);
  assert(
    blankScoreResult.rows.length === 2,
    "Chỉ nhận 2 dòng hợp lệ (1 dòng chỉ có điểm + 1 dòng có nhận xét)",
    `Số dòng hợp lệ: ${blankScoreResult.rows.length}`,
  );
  assert(
    blankScoreResult.warnings.length >= 1,
    "Ghi nhận cảnh báo cho các dòng không có nội dung và không có điểm",
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Kiểm thử giới hạn tối đa 500 dòng (501 dòng báo lỗi INPUT_INVALID)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[PHẦN 6] Kiểm tra giới hạn 500 dòng");
  const header = "id,nguoi_gui,noi_dung";
  const rows501 = [header];
  for (let i = 1; i <= 501; i++) {
    rows501.push(`id-${i},hv-${i},Nội dung góp ý số ${i}`);
  }
  const largeCsv = rows501.join("\n");

  const limitResult = parseSurveyCsv(largeCsv);
  assert(
    limitResult.error?.code === "INPUT_INVALID",
    "Tệp 501 dòng bị từ chối với mã lỗi INPUT_INVALID",
    `Mã lỗi: ${limitResult.error?.code}`,
  );
  assert(
    Boolean(limitResult.error?.message.includes("501")),
    "Thông báo lỗi nêu rõ số dòng thực tế (501)",
    `Thông báo: ${limitResult.error?.message}`,
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Kiểm thử chống nạp trùng (Deduplication)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n[PHẦN 7] Kiểm tra cơ chế chống nạp trùng (Fingerprint)");
  const fp1 = computeFeedbackFingerprint("hv-001", "Góp ý về âm thanh", {
    deHieu: 3,
    nhipDo: 4,
  });
  const fp2 = computeFeedbackFingerprint("HV-001 ", "  góp ý về âm thanh  ", {
    deHieu: 3,
    nhipDo: 4,
  });
  const fp3 = computeFeedbackFingerprint("hv-002", "Góp ý về âm thanh", {
    deHieu: 3,
    nhipDo: 4,
  });

  assert(
    fp1 === fp2,
    "Hai góp ý cùng người gửi và nội dung (dù khác hoa/thường/khoảng trắng) có cùng fingerprint",
  );
  assert(fp1 !== fp3, "Góp ý khác người gửi có fingerprint khác nhau");

  // ─────────────────────────────────────────────────────────────────────────────
  // Tổng kết
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n======================================================");
  console.log(`KẾT QUẢ KIỂM THỬ: ${passed} ĐẠT / ${passed + failed} TỔNG SỐ`);
  console.log("======================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Lỗi không mong muốn trong khi chạy test:", err);
  process.exit(1);
});
