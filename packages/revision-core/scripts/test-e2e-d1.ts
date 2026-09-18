import assert from "node:assert";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsRevisionStore } from "../src/store";
import { runRevisionV3 } from "../src/pipeline/run-v3";
import { loadD1RawFeedback } from "../src/load";

console.log("======================================================");
console.log("TEST SUITE: KIỂM THỬ PIPELINE TRỌN VẸN TRÊN D1 (F0 & E2E)");
console.log("======================================================");

// --- [Test 1] Store thiếu gop-y-mau.json trả lỗi INPUT_MISSING ---
{
  const tmpBase = mkdtempSync(join(tmpdir(), "fbr-missing-"));
  const emptyPack = join(tmpBase, "empty-pack");
  mkdirSync(emptyPack, { recursive: true });

  const store = new FsRevisionStore({
    packDir: emptyPack,
    runsDir: join(tmpBase, "runs"),
    studioDir: join(tmpBase, "studio"),
    cacheDir: join(tmpBase, "cache"),
  });

  let threw = false;
  try {
    loadD1RawFeedback(store);
  } catch (err: any) {
    threw = true;
    assert.strictEqual(
      err.message.includes("INPUT_MISSING"),
      true,
      `Thông báo lỗi phải chứa INPUT_MISSING: ${err.message}`,
    );
  }
  assert.strictEqual(threw, true, "Phải ném lỗi khi thiếu gop-y-mau.json");
  console.log(
    "  ✓ ĐẠT: F0-01: loadD1RawFeedback ném INPUT_MISSING khi thiếu gop-y-mau.json",
  );
}

// --- [Test 2] Run với 0 góp ý trả về status: "loi" và mã NO_FEEDBACK ---
{
  const tmpBase = mkdtempSync(join(tmpdir(), "fbr-nofb-"));
  const store = new FsRevisionStore({
    runsDir: join(tmpBase, "runs"),
    studioDir: join(tmpBase, "studio"),
    cacheDir: join(tmpBase, "cache"),
  });

  const res = await runRevisionV3(
    {
      videoId: "d1",
      versionId: "v1",
      includeD1Feedback: false,
      newFeedback: [],
    },
    { store },
  );

  assert.strictEqual(res.status, "loi", "Status phải là loi");
  assert.strictEqual(
    res.brief?.canhBao?.some((c) => c.includes("Không có góp ý nào")),
    true,
    "Phải có cảnh báo không có góp ý nào",
  );
  console.log(
    "  ✓ ĐẠT: F0-02: runRevisionV3 trả về status: 'loi' khi tổng số góp ý = 0 (NO_FEEDBACK)",
  );
}

// --- [Test 3] Nạp bình thường trên D1 nạp đủ 22 góp ý mà không cần biến môi trường ---
{
  const tmpBase = mkdtempSync(join(tmpdir(), "fbr-normal-"));
  const store = new FsRevisionStore({
    runsDir: join(tmpBase, "runs"),
    studioDir: join(tmpBase, "studio"),
    cacheDir: join(tmpBase, "cache"),
  });

  const res = await runRevisionV3(
    { videoId: "d1", versionId: "v1", includeD1Feedback: true },
    { store },
  );

  assert.strictEqual(res.brief.pheu.gopY, 22, "Phải nạp đủ 22 góp ý D1");
  console.log(
    "  ✓ ĐẠT: F0-03: runRevisionV3 nạp đủ 22 góp ý D1 mà không cần biến môi trường",
  );
}

console.log("\nToàn bộ kiểm thử F0 hoàn tất thành công!\n");
