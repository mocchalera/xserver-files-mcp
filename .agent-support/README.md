# Agent Support

This repository keeps reusable agent workflows in `skills/` as the canonical source.
Tool-specific directories are thin views of the same skill bodies.

## Canonical Skills

- `skills/xserver-files-operator`
- `skills/xserver-files-setup`
- `skills/xserver-mcp-operator`

## Project Views

The following directories should point at the canonical skills:

- `.claude/skills`
- `.agents/skills`
- `.gemini/skills`
- `.cursor/skills`
- `.grok/skills`
- `.antigravity/skills`

Cursor also gets `.cursor/rules/xserver-files.mdc` as a thin project rule that points agents back to `AGENTS.md` and `skills/`.

Git checkouts include these project views as symlinks. npm tarballs ship the canonical `skills/` tree and this support directory; run the installer to generate local views after unpacking when needed.

## Commands

Validate the current repository layout:

```bash
npm run validate:agent-support
```

Repair or regenerate project-local skill views:

```bash
npm run agent:install
```

If symlinks are unavailable on the local filesystem, copy the views instead:

```bash
npm run agent:install -- --copy --force
```

Optional global install examples:

```bash
npm run agent:install -- --global-codex
npm run agent:install -- --global-claude
```

Global installs never overwrite an existing different skill unless `--force` is passed.
