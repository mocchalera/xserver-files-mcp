---
name: xserver-mcp-operator
description: Use the host-provided XServer MCP tools safely. Use for XServer server-panel operations such as server info, domain/subdomain, SSL, DNS, WordPress, mail, FTP, MySQL, PHP version, cron, SSH, or log checks on namespaces like mcp__xserver_sv12345 and mcp__xserver_sv67890.
---

# XServer MCP Operator

## Purpose

Use this skill for the XServer-provided MCP server, not the custom SFTP file MCP in this repo. XServer MCP is for server-panel operations such as domain inventory, SSL, DNS, WordPress, mail, FTP, MySQL, PHP versions, and logs.

Use `.claude/skills/xserver-files-operator/SKILL.md` instead when the task requires reading or editing remote files such as `.htaccess`.

## First Step

Discover the current tool surface before acting:

```text
tool_search: mcp__xserver <intent keywords>
```

Prefer exact namespace selection:

- `mcp__xserver_sv12345` for the `sv12345` server.
- `mcp__xserver_sv67890` for the `sv67890` server.

If the target server is ambiguous, ask before using any write or delete tool.

## Safety Rules

- Always run a relevant `list` or `get` tool before any `add`, `update`, `install`, or `delete` tool.
- Treat all `delete_*` tools as destructive. Get explicit user confirmation with the exact target id/name before calling them.
- For DNS deletion, first call `xserver_list_server_dns`, copy the exact `dns_id`, then delete only that record.
- For PHP changes, first call `xserver_get_server_info` to confirm available versions, then update the specific domain only.
- For SSL, first confirm the domain exists and note current SSL state if exposed. If install returns an already-configured conflict, report that state instead of retrying.
- Do not claim XServer MCP can edit files unless a file/FTP content tool is currently visible. Use the custom SFTP MCP/CLI for `.htaccess` edits and redirects.

## Common Read Workflows

Server inventory:

1. `xserver_get_server_info`
2. `xserver_list_server_domain`
3. Optional targeted lists: `xserver_list_server_subdomain`, `xserver_list_server_dns`, `xserver_list_server_wordpress`, `xserver_list_server_mail`, `xserver_list_server_ftp`, `xserver_list_server_db`

Domain investigation:

1. `xserver_list_server_domain`
2. `xserver_list_server_subdomain` with parent domain if relevant
3. `xserver_list_server_dns` with domain if DNS state matters
4. `xserver_list_server_wordpress` with domain if WordPress may own the document root

Troubleshooting:

1. Confirm domain and DNS state with list tools.
2. Use `xserver_get_server_error_log` if exposed for the target namespace.
3. Use external `curl -I` checks only after MCP state is understood.

## Common Write Workflows

Add domain:

1. `xserver_list_server_domain`
2. `xserver_add_server_domain` with `ssl: true` unless the user wants SSL off
3. `xserver_list_server_domain` again

Add subdomain:

1. `xserver_list_server_domain`
2. `xserver_list_server_subdomain` for the parent domain
3. `xserver_add_server_subdomain`
4. `xserver_list_server_subdomain` again

Install SSL:

1. `xserver_list_server_domain`
2. `xserver_install_server_ssl` with the exact common name
3. Re-check domain/HTTPS state

Change PHP version:

1. `xserver_get_server_info`
2. `xserver_list_server_domain`
3. `xserver_update_server_php_version` with an available version
4. Re-check application behavior

MySQL:

1. `xserver_list_server_db`
2. Create with `xserver_add_server_db` only when the suffix and memo are clear.
3. For user/grant operations, first search for the exact currently exposed DB user/grant tools.

## Redirect Boundary

The XServer MCP currently visible in this environment manages server settings but does not expose direct `.htaccess` editing or a dedicated redirect tool. For `old-site.example.com -> https://new-site.example.com` style redirects, use:

```bash
node src/cli.js redirect old-site.example.com https://new-site.example.com --dry-run
node src/cli.js redirect old-site.example.com https://new-site.example.com
```

Use XServer MCP around that workflow to inspect domain, SSL, DNS, and WordPress state.
