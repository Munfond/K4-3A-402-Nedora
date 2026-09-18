import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export function findRepoRoot(startDir: string = process.cwd()): string {
  let curr = resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(curr, "pnpm-workspace.yaml"))) {
      return curr;
    }
    const parent = resolve(curr, "..");
    if (parent === curr) break;
    curr = parent;
  }
  return resolve(startDir);
}

export function getStudioPackDir(): string | null {
  const root = findRepoRoot();
  const packPath = join(root, "data/studio-pack/c5-feedbackradar");
  if (
    existsSync(packPath) &&
    existsSync(join(packPath, "video-mau/kich-ban-d1.json"))
  ) {
    return packPath;
  }
  return null;
}
