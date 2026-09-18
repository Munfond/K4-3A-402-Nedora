import { TestSuite } from "./lib/assert";
import {
  extractTimeMentions,
  classifyIntent,
  splitFeedbackToClaims,
} from "../src/claims";
import type { FeedbackItem } from "../src/types";

async function runClaimsTests() {
  const suite = new TestSuite(
    "KIỂM THỬ TÁCH Ý & PHÂN LOẠI GÓP Ý (CLAIMS & INTENT - TK §6)",
  );

  // --------------------------------------------------------------------------
  // 1. Trích xuất Mốc thời gian
  // --------------------------------------------------------------------------
  console.log("\n--- [1] Trích xuất Mốc thời gian đa dạng ---");

  await suite.run("TM-01: Mốc thời gian đơn lẻ 'ở phút 1:15'", () => {
    const res = extractTimeMentions("ở phút 1:15 đoạn này nói hơi nhanh");
    if (!res || res.tu !== 75 || res.den !== 75) {
      throw new Error(`Kỳ vọng 75s, nhận: ${JSON.stringify(res)}`);
    }
  });

  await suite.run("TM-02: Khoảng thời gian 'từ 1:00 đến 1:30'", () => {
    const res = extractTimeMentions("Nhạc nền bị to từ 1:00 đến 1:30");
    if (!res || res.tu !== 60 || res.den !== 90) {
      throw new Error(`Kỳ vọng khoảng [60, 90], nhận: ${JSON.stringify(res)}`);
    }
  });

  await suite.run("TM-03: Khoảng giây 'từ 35s đến 45s'", () => {
    const res = extractTimeMentions("ở đoạn từ 35s đến 45s slide bị nhảy");
    if (!res || res.tu !== 35 || res.den !== 45) {
      throw new Error(`Kỳ vọng khoảng [35, 45], nhận: ${JSON.stringify(res)}`);
    }
  });

  await suite.run("TM-04: Nhắc số câu 'ở câu số 12'", () => {
    const res = extractTimeMentions("ở câu số 12 thầy nói nhầm chữ");
    if (!res || !res.isSentenceNumber || res.sentenceN !== 12) {
      throw new Error(`Kỳ vọng câu 12, nhận: ${JSON.stringify(res)}`);
    }
  });

  await suite.run("TM-05: Mốc '02:10'", () => {
    const res = extractTimeMentions("Đoạn 02:10 chữ trên màn hình mờ");
    if (!res || res.tu !== 130) {
      throw new Error(`Kỳ vọng 130s, nhận: ${JSON.stringify(res)}`);
    }
  });

  // --------------------------------------------------------------------------
  // 2. Nhận diện 10 Loại Intent
  // --------------------------------------------------------------------------
  console.log("\n--- [2] Phân loại 10 nhóm Intent ---");

  await suite.run("INT-01: am-thanh", () => {
    const intent = classifyIntent("Nhạc nền to quá đè hết cả tiếng giảng bài");
    if (intent !== "am-thanh")
      throw new Error(`Kỳ vọng am-thanh, nhận: ${intent}`);
  });

  await suite.run("INT-02: hinh-anh", () => {
    const intent = classifyIntent("Chữ trên slide ở đoạn này hơi bé khó đọc");
    if (intent !== "hinh-anh")
      throw new Error(`Kỳ vọng hinh-anh, nhận: ${intent}`);
  });

  await suite.run("INT-03: nhip-toc-do", () => {
    const intent = classifyIntent("Diễn giả nói nhanh nuốt chữ nghe không kịp");
    if (intent !== "nhip-toc-do")
      throw new Error(`Kỳ vọng nhip-toc-do, nhận: ${intent}`);
  });

  await suite.run("INT-04: nhip-khoang-dung", () => {
    const intent = classifyIntent(
      "Khoảng dừng ngắt câu giữa chừng đột ngột quá",
    );
    if (intent !== "nhip-khoang-dung")
      throw new Error(`Kỳ vọng nhip-khoang-dung, nhận: ${intent}`);
  });

  await suite.run("INT-05: giong-doc", () => {
    const intent = classifyIntent("Phát âm từ này bị sai ngữ điệu nghe gượng");
    if (intent !== "giong-doc")
      throw new Error(`Kỳ vọng giong-doc, nhận: ${intent}`);
  });

  await suite.run("INT-06: noi-dung-sai", () => {
    const intent = classifyIntent(
      "Định nghĩa khái niệm ở câu 9 bị sai bản chất",
    );
    if (intent !== "noi-dung-sai")
      throw new Error(`Kỳ vọng noi-dung-sai, nhận: ${intent}`);
  });

  await suite.run("INT-07: kho-hieu", () => {
    const intent = classifyIntent(
      "Giải thích phần này trừu tượng và khó hiểu quá",
    );
    if (intent !== "kho-hieu")
      throw new Error(`Kỳ vọng kho-hieu, nhận: ${intent}`);
  });

  await suite.run("INT-08: phu-de", () => {
    const intent = classifyIntent("Phụ đề chạy chậm hơn so với lời nói");
    if (intent !== "phu-de") throw new Error(`Kỳ vọng phu-de, nhận: ${intent}`);
  });

  await suite.run("INT-09: de-nghi-chung", () => {
    const intent = classifyIntent(
      "Đề nghị có thêm slide tóm tắt ở cuối bài học",
    );
    if (intent !== "de-nghi-chung")
      throw new Error(`Kỳ vọng de-nghi-chung, nhận: ${intent}`);
  });

  await suite.run("INT-10: khen-giu", () => {
    const intent = classifyIntent(
      "Bài giảng rất hay và trực quan, cảm ơn tác giả",
    );
    if (intent !== "khen-giu")
      throw new Error(`Kỳ vọng khen-giu, nhận: ${intent}`);
  });

  // --------------------------------------------------------------------------
  // 3. Phân tách Góp ý phức hợp (Compound Feedback)
  // --------------------------------------------------------------------------
  console.log("\n--- [3] Phân tách Góp ý phức hợp thành nhiều Claim ---");

  await suite.run("SPLIT-01: Tách phản hồi có 2 vấn đề khác nhau", () => {
    const item: FeedbackItem = {
      id: "fb-compound-1",
      channel: "binh-luan",
      sender: "hv-012",
      sanitizedText: "Nhạc nền to ở phút 1:10 và chữ trên slide hơi nhỏ ở 2:15",
      time: new Date().toISOString(),
      label: "gop-y",
      moderationBy: "luat",
      isQuarantined: false,
    };

    const claims = splitFeedbackToClaims(item);
    if (claims.length !== 2) {
      throw new Error(`Kỳ vọng 2 claims, nhận: ${claims.length}`);
    }

    const c1 = claims[0];
    const c2 = claims[1];

    if (c1.intent !== "am-thanh")
      throw new Error(`Claim 1 sai intent: ${c1.intent}`);
    if (c2.intent !== "hinh-anh")
      throw new Error(`Claim 2 sai intent: ${c2.intent}`);
    if (c1.role !== "hv") throw new Error(`Sai role học viên: ${c1.role}`);

    console.log(
      `    Claim 1: [${c1.intent}] "${c1.trich}" (mốc: ${c1.goiYViTri})`,
    );
    console.log(
      `    Claim 2: [${c2.intent}] "${c2.trich}" (mốc: ${c2.goiYViTri})`,
    );
  });

  await suite.run("SPLIT-02: Phản hồi đơn lẻ chỉ tạo đúng 1 Claim", () => {
    const item: FeedbackItem = {
      id: "fb-single-1",
      channel: "khao-sat",
      sender: "gv-001",
      sanitizedText: "Giọng đọc câu 15 hơi nhanh cần điều chỉnh lại nhịp",
      time: new Date().toISOString(),
      label: "gop-y",
      moderationBy: "luat",
      isQuarantined: false,
    };

    const claims = splitFeedbackToClaims(item);
    if (claims.length !== 1) {
      throw new Error(`Kỳ vọng đúng 1 claim, nhận: ${claims.length}`);
    }
    if (claims[0].role !== "gv") {
      throw new Error(`Kỳ vọng role gv, nhận: ${claims[0].role}`);
    }
  });

  // --------------------------------------------------------------------------
  // 4. Kiểm thử Chấp nhận F2 (D1 feedbacks & chỉ dẫn)
  // --------------------------------------------------------------------------
  console.log("\n--- [4] Kiểm thử Tiêu chí Chấp nhận F2 (D1 & Chỉ dẫn) ---");

  await suite.run(
    "F2-01: gy-015 có intent kho-hieu (không nhầm am-thanh hay hinh-anh)",
    () => {
      const text =
        "Giải thích mô hình ngôn ngữ lớn ở đoạn đầu nghe ba lần mới hiểu";
      const intent = classifyIntent(text);
      if (intent !== "kho-hieu") {
        throw new Error(`Kỳ vọng kho-hieu, nhận: ${intent}`);
      }
    },
  );

  await suite.run("F2-02: gy-005 có intent nhip-khoang-dung", () => {
    const text = "Năm giây suy nghĩ ngắn quá, chưa kịp nghĩ đã hiện đáp án rồi";
    const intent = classifyIntent(text);
    if (intent !== "nhip-khoang-dung") {
      throw new Error(`Kỳ vọng nhip-khoang-dung, nhận: ${intent}`);
    }
  });

  await suite.run(
    "F2-03: gy-013 có intent de-nghi-chung hoặc noi-dung-sai (không phải am-thanh)",
    () => {
      const text = "Nên cho thêm ví dụ về tiếng Việt";
      const intent = classifyIntent(text);
      if (intent === "am-thanh") {
        throw new Error(
          `Không được là am-thanh khi nói về tiếng Việt! Nhận: ${intent}`,
        );
      }
      if (intent !== "de-nghi-chung" && intent !== "noi-dung-sai") {
        throw new Error(
          `Kỳ vọng de-nghi-chung hoặc noi-dung-sai, nhận: ${intent}`,
        );
      }
    },
  );

  await suite.run("F2-04: gy-004 tách được ít nhất một ý khen-giu", () => {
    const item: FeedbackItem = {
      id: "gy-004",
      channel: "binh-luan",
      sender: "hv-004",
      sanitizedText: "Slide đẹp, ví dụ rõ ràng, đoạn sau giải thích hay",
      time: new Date().toISOString(),
      label: "gop-y",
      moderationBy: "luat",
      isQuarantined: false,
    };
    const claims = splitFeedbackToClaims(item);
    const hasKhenGiu = claims.some(
      (c) =>
        c.intent === "khen-giu" || c.chiDan === "khen" || c.chiDan === "giu",
    );
    if (!hasKhenGiu) {
      throw new Error(
        `Kỳ vọng ít nhất 1 ý khen-giu, nhận: ${JSON.stringify(claims.map((c) => ({ intent: c.intent, chiDan: c.chiDan })))}`,
      );
    }
  });

  await suite.run("F2-05: Kiểm tra trường chiDan (sua, giu, khen, hoi)", () => {
    const itemKhen: FeedbackItem = {
      id: "fb-khen",
      channel: "binh-luan",
      sender: "hv-001",
      sanitizedText: "Đoạn giải thích rất hay và trực quan",
      time: new Date().toISOString(),
      label: "gop-y",
      moderationBy: "luat",
      isQuarantined: false,
    };
    const claimsKhen = splitFeedbackToClaims(itemKhen);
    if (claimsKhen[0].chiDan !== "khen") {
      throw new Error(`Kỳ vọng chiDan 'khen', nhận: ${claimsKhen[0].chiDan}`);
    }

    const itemGiu: FeedbackItem = {
      id: "fb-giu",
      channel: "binh-luan",
      sender: "gv-002",
      sanitizedText: "Cần giữ nguyên slide tóm tắt ở câu 10",
      time: new Date().toISOString(),
      label: "gop-y",
      moderationBy: "luat",
      isQuarantined: false,
    };
    const claimsGiu = splitFeedbackToClaims(itemGiu);
    if (claimsGiu[0].chiDan !== "giu") {
      throw new Error(`Kỳ vọng chiDan 'giu', nhận: ${claimsGiu[0].chiDan}`);
    }

    const itemHoi: FeedbackItem = {
      id: "fb-hoi",
      channel: "binh-luan",
      sender: "hv-003",
      sanitizedText: "Rốt cuộc khái niệm này có phải là học có giám sát không?",
      time: new Date().toISOString(),
      label: "gop-y",
      moderationBy: "luat",
      isQuarantined: false,
    };
    const claimsHoi = splitFeedbackToClaims(itemHoi);
    if (claimsHoi[0].chiDan !== "hoi") {
      throw new Error(`Kỳ vọng chiDan 'hoi', nhận: ${claimsHoi[0].chiDan}`);
    }

    const itemSua: FeedbackItem = {
      id: "fb-sua",
      channel: "binh-luan",
      sender: "hv-005",
      sanitizedText: "Cần chỉnh lại âm lượng nhạc nền ở phút 1:20",
      time: new Date().toISOString(),
      label: "gop-y",
      moderationBy: "luat",
      isQuarantined: false,
    };
    const claimsSua = splitFeedbackToClaims(itemSua);
    if (claimsSua[0].chiDan !== "sua") {
      throw new Error(`Kỳ vọng chiDan 'sua', nhận: ${claimsSua[0].chiDan}`);
    }
  });

  const passed = suite.summary();
  if (!passed) {
    process.exit(1);
  }
}

runClaimsTests().catch((err) => {
  console.error("Lỗi khi chạy test claims:", err);
  process.exit(1);
});
