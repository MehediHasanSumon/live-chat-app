import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, ".next");
const standaloneDir = path.join(nextDir, "standalone");
const standaloneNextDir = path.join(standaloneDir, ".next");
const staticSourceDir = path.join(nextDir, "static");
const staticTargetDir = path.join(standaloneNextDir, "static");
const publicSourceDir = path.join(projectRoot, "public");
const publicTargetDir = path.join(standaloneDir, "public");

if (!existsSync(standaloneDir)) {
  throw new Error("Missing .next/standalone. Run `next build` before preparing the deployment bundle.");
}

await mkdir(standaloneNextDir, { recursive: true });

if (existsSync(staticSourceDir)) {
  await rm(staticTargetDir, { recursive: true, force: true });
  await cp(staticSourceDir, staticTargetDir, { recursive: true });
}

if (existsSync(publicSourceDir)) {
  await rm(publicTargetDir, { recursive: true, force: true });
  await cp(publicSourceDir, publicTargetDir, { recursive: true });
}

console.log("Standalone bundle prepared at .next/standalone");
