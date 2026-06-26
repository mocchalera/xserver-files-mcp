# AGENTS.md

## Scope
- Maintain the local stdio MCP server and CLI for XServer SFTP file operations in this repository.
- Keep repository guidance concise; detailed operating workflows belong in `skills/xserver-files-operator/SKILL.md` and `skills/xserver-mcp-operator/SKILL.md`.

## Required Commands
- Setup: `npm install`
- Test: `npm test`
- CLI smoke check: `XSERVER_FILES_CONFIG=config/example.config.json node src/cli.js servers`

## Hard Constraints
- Do not commit private keys, passphrases, server passwords, or real local config files.
- Do not hard-code live XServer credentials in source code or tests.
- Keep file operations constrained to configured `roots[domain]`; never add absolute remote-path inputs to tools.
- Preserve write safety: existing remote files must be backed up by default.

## Task Workflow
- Prefer shared operation code in `src/operations.js`; keep `src/server.js` and `src/cli.js` as thin adapters.
- Use `skills/` as the authored project-skill source; `.claude/skills/`, `.agents/skills/`, `.gemini/skills/`, `.cursor/skills/`, `.grok/skills/`, and `.antigravity/skills/` are compatibility views.
- Keep XServer-provided MCP guidance separate from the custom SFTP MCP/CLI guidance.
- Run `npm run validate:agent-support` after changing skills or agent-facing entrypoints.
- Before changing remote-write behavior, update or add tests that exercise dry-run, backup, and path-safety behavior.

## Definition of Done
- `npm test` passes.
- `npm run validate:agent-support` passes when skills or agent-facing entrypoints change.
- MCP stdio smoke coverage still lists and calls at least one read-only tool.
- README and project skills stay aligned with any command, config, or XServer MCP workflow changes.
