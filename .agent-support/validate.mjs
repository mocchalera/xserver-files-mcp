#!/usr/bin/env node
import fs from "node:fs";
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

const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "GROK.md",
  "ANTIGRAVITY.md",
  ".cursor/rules/xserver-files.mdc",
  ".agent-support/README.md",
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function listSkills() {
  if (!fs.existsSync(skillsRoot)) {
    fail("Missing canonical skills/ directory.");
    return [];
  }
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function readSkillName(skillDir) {
  const skillPath = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillPath)) return null;
  const text = fs.readFileSync(skillPath, "utf8");
  const match = text.match(/^---\n[\s\S]*?^name:\s*([^\n]+)\n[\s\S]*?^---/m);
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

function listFiles(root) {
  const out = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.push(rel);
      }
    }
  }
  walk(root);
  return out.sort();
}

function sameTree(a, b) {
  const aFiles = listFiles(a);
  const bFiles = listFiles(b);
  if (aFiles.join("\n") !== bFiles.join("\n")) return false;
  return aFiles.every((rel) => {
    const aContent = fs.readFileSync(path.join(a, rel));
    const bContent = fs.readFileSync(path.join(b, rel));
    return Buffer.compare(aContent, bContent) === 0;
  });
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(repoRoot, file))) {
    fail(`Missing required agent support file: ${file}`);
  }
}

const packageJsonPath = path.join(repoRoot, "package.json");
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const files = packageJson.files ?? [];
  for (const required of [
    "skills/",
    ".agent-support/",
    ".cursor/rules/",
  ]) {
    if (!files.includes(required)) {
      fail(`package.json files[] must include ${required}`);
    }
  }
  for (const script of ["agent:install", "validate:agent-support"]) {
    if (!packageJson.scripts?.[script]) {
      fail(`package.json scripts.${script} is missing.`);
    }
  }
}

const skills = listSkills();
if (skills.length === 0) {
  fail("No canonical skills found.");
}

for (const skill of skills) {
  const canonical = path.join(skillsRoot, skill);
  const skillName = readSkillName(canonical);
  if (skillName !== skill) {
    fail(`${skill}/SKILL.md frontmatter name must be ${skill}; found ${skillName ?? "none"}.`);
  }

  for (const view of projectViews) {
    const viewPath = path.join(repoRoot, view, skill);
    const stat = fs.lstatSync(viewPath, { throwIfNoEntry: false });
    if (!stat) {
      fail(`Missing ${view}/${skill}.`);
      continue;
    }
    if (stat.isSymbolicLink()) {
      const realView = fs.realpathSync(viewPath);
      const realCanonical = fs.realpathSync(canonical);
      if (realView !== realCanonical) {
        fail(`${view}/${skill} points to ${realView}, expected ${realCanonical}.`);
      }
    } else if (stat.isDirectory()) {
      if (!sameTree(canonical, viewPath)) {
        fail(`${view}/${skill} is a copy but differs from skills/${skill}.`);
      }
    } else {
      fail(`${view}/${skill} must be a symlink or directory copy.`);
    }
  }
}

if (failures.length > 0) {
  console.error("Agent support validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Agent support OK: ${skills.length} canonical skill(s), ${projectViews.length} project view root(s).`);
