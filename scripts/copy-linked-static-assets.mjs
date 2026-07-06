import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const folders = ["docs", "catalog", "company"];

function copyDirectory(source, target) {
  mkdirSync(target, { recursive: true });

  for (const entry of readdirSync(source)) {
    const sourcePath = join(source, entry);
    const targetPath = join(target, entry);

    if (statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

for (const folder of folders) {
  const source = join(root, "assets", folder);
  const target = join(root, "dist", "assets", folder);

  if (existsSync(source)) {
    mkdirSync(join(root, "dist", "assets"), { recursive: true });
    rmSync(target, { recursive: true, force: true });
    copyDirectory(source, target);
    console.log(`copied assets/${folder}`);
  }
}
