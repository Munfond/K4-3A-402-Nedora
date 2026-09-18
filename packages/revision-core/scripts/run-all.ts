import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("======================================================");
  console.log("BỘ CHẠY KIỂM THỬ REVISION-CORE (TEST RUNNER)");
  console.log("======================================================");

  const testFiles = existsSync(__dirname)
    ? readdirSync(__dirname).filter(
        (f) =>
          f.startsWith("test-") && (f.endsWith(".ts") || f.endsWith(".js")),
      )
    : [];

  if (testFiles.length === 0) {
    console.log(
      "Chưa có file test nào (test-*.ts). Khung kiểm thử đã sẵn sàng.",
    );
    process.exit(0);
  }

  let allPassed = true;
  for (const file of testFiles) {
    const filePath = join(__dirname, file);
    console.log(`\n>>> Đang chạy: ${file}`);
    const res = spawnSync(process.execPath, ["--import", "tsx", filePath], {
      stdio: "inherit",
      env: process.env,
    });
    if (res.status !== 0) {
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error("\nCó ít nhất một bộ test thất bại!");
    process.exit(1);
  } else {
    console.log("\nToàn bộ các bài kiểm thử đều ĐẠT!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Lỗi runner:", err);
  process.exit(1);
});
