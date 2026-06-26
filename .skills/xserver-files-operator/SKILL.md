---
name: xserver-files-operator
description: Operate the xserver-files-mcp repository safely. Use when working on this repo's local stdio MCP server, CLI, XServer SFTP configuration, remote file reads/writes, .htaccess backups, or domain redirect workflows such as willforwardcreate.jp to willforward.co.jp.
---

# XServer Files Operator

## Overview

Use this skill to work with the local MCP/CLI in this repository without bypassing its safety model. The MCP connects to XServer over SFTP on port `10022`, restricts paths to configured domain roots, and backs up existing files before writes by default.

## Safety Contract

- Treat `~/.config/xserver-files-mcp/config.json` as the operator-owned config; keep only `config/example.config.json` in the repo.
- Keep private keys under `~/.ssh/`, not in this repository.
- Use `server_id` for multi-server work; omit it only when the default server is intended.
- Use configured domains such as `willforwardcreate.jp`; do not pass absolute remote paths to tools or CLI commands.
- Run dry-run first for redirect and write workflows unless the user explicitly asks for an immediate write.
- Keep backups enabled unless the user explicitly accepts the risk.
- Keep local site workspaces outside this repository, normally under `~/Dev/xserver-sites`.
- Use workspace pull/push for edited site files; do not clone WordPress/site trees into this tool repository.
- Treat `wp-config.php`, uploads, logs, backups, SQL/database dumps, and archives as default-excluded workspace paths unless the user explicitly accepts the risk.

## Local Checks

Install and test:

```bash
npm install
npm test
```

Check config parsing without connecting to XServer:

```bash
XSERVER_FILES_CONFIG=config/example.config.json node src/cli.js servers
```

Create a domain workspace outside the repository:

```bash
node src/cli.js workspace willforwardcreate.jp
```

Pull one file for local editing:

```bash
node src/cli.js pull willforwardcreate.jp .htaccess
```

Push the matching workspace file back with a dry-run first:

```bash
node src/cli.js push willforwardcreate.jp .htaccess --dry-run
node src/cli.js push willforwardcreate.jp .htaccess
```

## Setup Workflow

1. Copy `config/example.config.json` to `~/.config/xserver-files-mcp/config.json`.
2. Create/register the SSH key outside the repo, for example `~/.ssh/xserver_willforward`.
3. Verify XServer SSH/SFTP access on port `10022` before using remote file tools:

```bash
ssh -p 10022 -i ~/.ssh/xserver_willforward willforward@willforward.xsrv.jp 'pwd'
```

4. Confirm the configured document roots before writes:

```bash
node src/cli.js roots
node src/cli.js ls willforwardcreate.jp .
node src/cli.js workspace willforwardcreate.jp
```

## Redirect Workflow

For `willforwardcreate.jp` to `https://willforward.co.jp`, dry-run first:

```bash
node src/cli.js redirect willforwardcreate.jp https://willforward.co.jp --dry-run
```

Then apply:

```bash
node src/cli.js redirect willforwardcreate.jp https://willforward.co.jp
```

After applying, verify both HTTP hosts:

```bash
curl -I http://willforwardcreate.jp/
curl -I http://www.willforwardcreate.jp/
```

HTTPS verification depends on certificate state:

```bash
curl -I https://willforwardcreate.jp/
curl -I https://www.willforwardcreate.jp/
```

## MCP Registration

Register `src/server.js` as a local stdio MCP command. Use an absolute path and pass the real config path through `XSERVER_FILES_CONFIG`:

```json
{
  "mcpServers": {
    "xserver-files": {
      "command": "node",
      "args": ["/Users/mocchalera/Dev/xserver-files-mcp/src/server.js"],
      "env": {
        "XSERVER_FILES_CONFIG": "/Users/mocchalera/.config/xserver-files-mcp/config.json"
      }
    }
  }
}
```

## Implementation Rules

- Put SFTP and path-safety logic in `src/operations.js`, `src/sftp.js`, or `src/path-utils.js`.
- Keep MCP tool schemas in `src/server.js`; keep CLI commands in `src/cli.js`.
- Add tests for safety-sensitive behavior before changing write, replace, backup, redirect, or path resolution code.
- Run `npm test` before finishing.
