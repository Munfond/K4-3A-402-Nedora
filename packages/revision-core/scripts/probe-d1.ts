import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsRevisionStore } from "../src/store";
import { runRevisionV3 } from "../src/pipeline/run-v3";
import {
  resolveRevisionModelId,
  resolveLanguageModelForRevision,
} from "@feedback/ai/agents/revision";

async function main() {
  // --real: chạy với model thật (OpenAI). Không có cờ này thì chạy giả lập.
  const dungModelThat = process.argv.includes("--real");
  const mode = process.argv.includes("--k1") ? "k1" : "k2";
  const tmpBase = mkdtempSync(join(tmpdir(), "fbr-probe-"));
  const store = new FsRevisionStore({
    runsDir: join(tmpBase, "runs"),
    studioDir: join(tmpBase, "studio"),
    cacheDir: join(tmpBase, "cache"),
  });

  console.log("=== BẮT ĐẦU PROBE D1 ===");
  console.log("Temp dir:", tmpBase);
  console.log("Store pack dir:", store.getPackDir());

  let model: unknown;
  let modelId: string | undefined;
  if (dungModelThat) {
    modelId = resolveRevisionModelId();
    model = resolveLanguageModelForRevision(modelId);
    if (!model) {
      console.error(
        "Không tạo được model. Cần OPENAI_API_KEY và OPENAI_MODELS trong apps/revision-service/.env",
      );
      process.exit(1);
    }
    console.log("Model:", modelId, "| Chế độ:", mode.toUpperCase());
  } else {
    console.log("Chế độ: GIẢ LẬP (thêm --real để chạy model thật)");
  }

  const batDau = Date.now();
  const result = await runRevisionV3(
    { videoId: "d1", versionId: "v1", includeD1Feedback: true, mode },
    {
      store,
      model,
      modelId,
      modelMode: dungModelThat ? "that" : "gia-lap",
    },
  );
  console.log(
    "Thời gian chạy:",
    ((Date.now() - batDau) / 1000).toFixed(1),
    "giây",
  );

  console.log("\n=== STATUS ===");
  console.log("Run ID:", result.runId);
  console.log("Status:", result.status);

  console.log("\n=== BRIEF.PHEU ===");
  console.log(JSON.stringify(result.brief?.pheu, null, 2));

  console.log("\n=== BRIEF.KEHOACH ===");
  if (result.brief?.keHoach) {
    const { thuLai, kyTuThuLai, deltaTong, viPham } = result.brief.keHoach;
    console.log({
      thuLai,
      kyTuThuLai,
      deltaTong,
      viPhamCount: viPham?.length ?? 0,
    });
  } else {
    console.log("Không có keHoach");
  }

  console.log("\n=== DANH SÁCH VIỆC (BRIEF.VIEC) ===");
  if (result.brief?.viec) {
    for (const v of result.brief.viec) {
      console.log(
        `- [${v.id}] ${v.nhom} | Câu: [${v.viTri?.ns?.join(",")}] | Góp ý: [${v.gopYIds?.join(",")}] | Ưu tiên: ${v.uuTien}`,
      );
      console.log(`  Lý do: ${v.lyDoUuTien}`);
      const dx = v.deXuat as
        | {
            kieu?: string;
            lyDo?: string;
            changes?: Array<Record<string, unknown>>;
            thayDoiChinh?: string;
            strategy?: string;
            moTa?: string;
          }
        | undefined;
      if (dx?.kieu === "can-nguoi-viet") {
        console.log(`  Đề xuất: [cần người viết] ${dx.lyDo}`);
      } else if (dx) {
        console.log(
          `  Đề xuất: ${dx.strategy || dx.thayDoiChinh || dx.moTa || "(không có mô tả)"}`,
        );
        for (const ch of dx.changes ?? []) {
          const after = typeof ch.after === "string" ? ch.after : "";
          console.log(
            `    · ${ch.kind} câu ${ch.n}: "${after.slice(0, 90)}${after.length > 90 ? "…" : ""}"`,
          );
        }
      }
      if (v.canhBao?.length) {
        console.log(`  Cảnh báo: ${v.canhBao.join(" | ")}`);
      }
    }
  }

  if (result.brief?.canhBao?.length) {
    console.log("\n=== CẢNH BÁO TOÀN RUN ===");
    for (const c of result.brief.canhBao) console.log(`- ${c}`);
  }

  console.log("\n=== CÂU HỎI CHO NGƯỜI DUYỆT ===");
  for (const q of result.brief?.cauHoi ?? []) {
    console.log(`- ${q.noiDung}`);
    console.log(`  Lựa chọn: ${q.luaChon?.join(" / ")}`);
  }

  console.log("\n=== GÓP Ý BỊ CÁCH LY ===");
  // Lấy từ store run data
  const runData = store.getRunById(result.runId);
  const quarantined = runData?.result?.quarantinedFeedback ?? [];
  console.log(`Tổng số bị cách ly: ${quarantined.length}`);
  for (const q of quarantined) {
    console.log(
      `- [${q.id}] (${q.label}) ${q.sender}: "${q.rawText?.slice(0, 70)}" | Lý do: ${q.quarantineReason}`,
    );
  }

  console.log("\n=== INTENT CỦA TỪNG CLAIM ===");
  const events = store.readEvents(result.runId);
  const claimEvents = events.filter(
    (e: any) => e.type === "partial" && e.kind === "claims.ready",
  );
  for (const ce of claimEvents) {
    const claims = (ce as any).payload ?? [];
    for (const cl of claims) {
      console.log(
        `- [${cl.id}] Intent: ${cl.intent} | Góp ý: ${cl.gopYId} | "${cl.trich?.slice(0, 60)}"`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Probe D1 gặp lỗi:", err);
  process.exit(1);
});
