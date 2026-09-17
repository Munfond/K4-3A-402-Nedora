// this script is run by the npm postinstall hook to copy the font
// files from the geist package to the fonts directory

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define the source paths for Geist fonts relative to node_modules
const fontPaths = [
  {
    src: "node_modules/geist/dist/fonts/geist-sans/Geist-Black.ttf",
    dest: "Geist-Black.ttf",
  },
  {
    src: "node_modules/geist/dist/fonts/geist-sans/Geist-Bold.ttf",
    dest: "Geist-Bold.ttf",
  },
  {
    src: "node_modules/geist/dist/fonts/geist-sans/Geist-Medium.ttf",
    dest: "Geist-Medium.ttf",
  },
  {
    src: "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
    dest: "Geist-Regular.ttf",
  },
  {
    src: "node_modules/geist/dist/fonts/geist-sans/Geist-Light.ttf",
    dest: "Geist-Light.ttf",
  },
  {
    src: "node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.ttf",
    dest: "Geist-Mono-Regular.ttf",
  },
];

// Ensure the destination directory exists
const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname, { recursive: true });
};

// Copy each font file
fontPaths.forEach(({ src, dest }) => {
  const destPath = path.join("fonts", dest);
  ensureDirectoryExistence(destPath);
  const exists = fs.existsSync(destPath);
  if (!exists && fs.existsSync(src)) {
    fs.copyFileSync(src, destPath);
    console.log(`Copied ${path.basename(src)} to ${destPath}`);
  }
});
