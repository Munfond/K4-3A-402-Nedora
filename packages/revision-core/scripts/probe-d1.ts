import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsRevisionStore } from "../src/store";
import { runRevisionV3 } from "../src/pipeline/run-v3";

async function main() {
  const tmpBase = mkdtempSync(join(tmpdir(), "fbr-probe-"));
  const store = new FsRevisionStore({
    runsDir: join(tmpBase, "runs"),
    studioDir: join(tmpBase, "studio"),
    cacheDir: join(tmpBase, "cache"),
  });

  console.log("=== BẮT ĐẦU PROBE D1 ===");
  console.log("Temp dir:", tmpBase);
  console.log("Store pack dir:", store.getPackDir());

  const result = await runRevisionV3(
    { videoId: "d1", versionId: "v1", includeD1Feedback: true },
    { store },
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
    }
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
