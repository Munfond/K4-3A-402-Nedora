import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

function findProjectRoot(): string {
  let cur = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (
      existsSync(join(cur, "package.json")) &&
      existsSync(join(cur, "pnpm-workspace.yaml"))
    ) {
      return cur;
    }
    const parent = resolve(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

function syncPackAssets() {
  const root = findProjectRoot();
  const packVideoMauDir = join(
    root,
    "data",
    "studio-pack",
    "c5-feedbackradar",
    "video-mau",
  );
  const slideAnhSrcDir = join(packVideoMauDir, "slide-anh");
  const slideD1SrcFile = join(packVideoMauDir, "slide-d1.json");

  const wwwPublicSlideAnh = join(root, "apps", "www", "public", "slide-anh");
  const wwwSrcDataDir = join(root, "apps", "www", "src", "data");
  const wwwSlideD1DstFile = join(wwwSrcDataDir, "slide-d1.json");

  if (!existsSync(packVideoMauDir)) {
    console.warn(
      `[sync-pack-assets] CẢNH BÁO: Không tìm thấy gói dữ liệu ban tổ chức tại: ${packVideoMauDir}\n` +
        `Ảnh slide trong kịch bản chi tiết sẽ không hiển thị. Nếu có gói dữ liệu, vui lòng đặt vào data/studio-pack/c5-feedbackradar/`,
    );
    return;
  }

  try {
    // 1. Sao chép ảnh slide nếu có
    if (existsSync(slideAnhSrcDir)) {
      mkdirSync(wwwPublicSlideAnh, { recursive: true });
      const files = readdirSync(slideAnhSrcDir);
      let copiedCount = 0;
      for (const file of files) {
        if (
          file.endsWith(".jpg") ||
          file.endsWith(".png") ||
          file.endsWith(".webp")
        ) {
          copyFileSync(
            join(slideAnhSrcDir, file),
            join(wwwPublicSlideAnh, file),
          );
          copiedCount++;
        }
      }
      console.log(
        `[sync-pack-assets] Đã đồng bộ ${copiedCount} ảnh slide vào ${wwwPublicSlideAnh}`,
      );
    }

    // 2. Sao chép slide-d1.json nếu có
    if (existsSync(slideD1SrcFile)) {
      mkdirSync(wwwSrcDataDir, { recursive: true });
      copyFileSync(slideD1SrcFile, wwwSlideD1DstFile);
      console.log(
        `[sync-pack-assets] Đã đồng bộ slide-d1.json vào ${wwwSlideD1DstFile}`,
      );
    }
  } catch (err: any) {
    console.warn(
      `[sync-pack-assets] Không thể đồng bộ tài nguyên gói:`,
      err?.message || err,
    );
  }
}

syncPackAssets();
