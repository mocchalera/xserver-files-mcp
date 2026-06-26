#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, "skills");

const projectViews = [
  ".claude/skills",
  ".agents/skills",
  ".gemini/skills",
  ".cursor/skills",
  ".grok/skills",
  ".antigravity/skills",
];

const args = new Set(process.argv.slice(2));
const useCopy = args.has("--copy");
const force = args.has("--force");

const globalTargets = [
  ["--global-codex", path.join(os.homedir(), ".codex", "skills")],
  ["--global-claude", path.join(os.homedir(), ".claude", "skills")],
  ["--global-agents", path.join(os.homedir(), ".agents", "skills")],
].filter(([flag]) => args.has(flag));

function listSkills() {
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function rmExisting(dest) {
  const stat = fs.lstatSync(dest, { throwIfNoEntry: false });
  if (!stat) return;
  if (!stat.isSymbolicLink() && !force) {
    throw new Error(`${dest} already exists and is not a symlink. Re-run with --force to replace it.`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(srcPath), destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function linkOrCopySkill(skill, targetRoot, mode) {
  const src = path.join(skillsRoot, skill);
  const dest = path.join(targetRoot, skill);
  fs.mkdirSync(targetRoot, { recursive: true });
  rmExisting(dest);

  if (mode === "copy") {
    copyDir(src, dest);
    return;
  }

  const linkTarget = path.relative(path.dirname(dest), src);
  fs.symlinkSync(linkTarget, dest, "junction");
}

const skills = listSkills();
for (const view of projectViews) {
  const targetRoot = path.join(repoRoot, view);
  for (const skill of skills) {
    try {
      linkOrCopySkill(skill, targetRoot, useCopy ? "copy" : "symlink");
    } catch (error) {
      if (useCopy) throw error;
      console.warn(`Symlink failed for ${view}/${skill}; copying instead. ${error.message}`);
      linkOrCopySkill(skill, targetRoot, "copy");
    }
  }
}

for (const [, targetRoot] of globalTargets) {
  for (const skill of skills) {
    linkOrCopySkill(skill, targetRoot, useCopy ? "copy" : "symlink");
  }
}

console.log(`Installed ${skills.length} skill view(s) for ${projectViews.length} project agent root(s).`);
if (globalTargets.length > 0) {
  console.log(`Updated ${globalTargets.length} global agent root(s).`);
}
