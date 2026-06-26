# xserver-files-mcp

Local stdio MCP server and CLI for safe XServer file operations over SFTP.

**Prerequisites:** Node.js 20+, an XServer account with SSH access enabled, and an ed25519 SSH key registered in the XServer Server Panel.

## Quick Start

```bash
git clone https://github.com/mocchalera/xserver-files-mcp.git
cd xserver-files-mcp
npm install
```

Verify the installation works (no server connection needed):

```bash
XSERVER_FILES_CONFIG=config/example.config.json node src/cli.js servers
```

Run diagnostics against your real config to check SSH keys and SFTP connectivity:

```bash
node src/cli.js doctor
```

## Configuration

Copy the example config and edit it with your XServer account details:

```bash
mkdir -p ~/.config/xserver-files-mcp
cp config/example.config.json ~/.config/xserver-files-mcp/config.json
```

### Config Reference

| Field | Example | Description |
|---|---|---|
| `defaultServer` | `"sv12345"` | Key from `servers` to use when `--server` is omitted |
| `localWorkspaceRoot` | `"~/Dev/xserver-sites"` | Local directory for pulled site files (outside this repo) |
| `servers.<id>.host` | `"sv12345.xsrv.jp"` | XServer hostname (`<server_id>.xsrv.jp`) |
| `servers.<id>.port` | `10022` | SSH port (always `10022` for XServer) |
| `servers.<id>.username` | `"sv12345"` | SSH username (same as your server ID) |
| `servers.<id>.privateKeyPath` | `"~/.ssh/xserver_sv12345"` | Path to your ed25519 private key |
| `servers.<id>.passphraseEnv` | `"XSERVER_SV12345_KEY_PASSPHRASE"` | Env var holding the key passphrase (optional) |
| `servers.<id>.roots.<domain>` | `"/home/sv12345/example.com/public_html"` | Absolute remote document root per domain |

### SSH Key Setup

```bash
ssh-keygen -t ed25519 -f ~/.ssh/xserver_sv12345 -C xserver-sv12345
```

Register the public key in XServer Server Panel, then test:

```bash
ssh -p 10022 -i ~/.ssh/xserver_sv12345 sv12345@sv12345.xsrv.jp 'pwd'
```

### Workspace Layout

Local site workspaces live outside this repository. The expected shape is:

```text
~/Dev/xserver-sites/
  sv12345/
    example.com/
    blog.example.com/
  sv67890/
    shop.example.com/
```

Keep this repository for the MCP/CLI source code only.

## CLI Usage

```bash
node src/cli.js <command> [options]
```

### Diagnostics

| Command | Description |
|---|---|
| `doctor` | Check config, SSH keys, and SFTP connectivity |
| `servers` | List configured server profiles (no connection) |
| `roots` | List configured domain roots |
| `--version` | Print version |

### File Operations

| Command | Description |
|---|---|
| `ls <domain> [path]` | List remote files |
| `read <domain> <path>` | Read a remote UTF-8 text file |
| `write <domain> <path> --from <file>` | Write a remote file (backs up existing by default) |
| `replace <domain> <path> --find <text> --replace <text>` | Exact text replacement (backs up by default) |
| `backup <domain> <path>` | Create a timestamped remote backup |
| `backups <domain> <path>` | List timestamped remote backups for a file |
| `cleanup-backups <domain> <path> [--keep N]` | Delete old backups, keeping the newest N (default 5) |

### Workspace Operations

| Command | Description |
|---|---|
| `workspace <domain>` | Create the local workspace directory for a domain |
| `pull <domain> <path>` | Pull a remote file into the local workspace |
| `push <domain> <path>` | Push a local workspace file to the server (backs up by default) |

The workspace pull/push flow refuses `wp-config.php`, uploads, logs, backups, database dumps, and archives by default. Use `--allow-sensitive` only after reviewing the risk.

### Redirect

```bash
node src/cli.js redirect old-site.example.com https://new-site.example.com --dry-run
node src/cli.js redirect old-site.example.com https://new-site.example.com
```

This inserts or updates a marked `.htaccess` 301 redirect block:

```apache
# BEGIN xserver-files-mcp redirect old-site.example.com
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTP_HOST} ^(www\.)?old-site\.example\.com$ [NC]
RewriteRule ^(.*)$ https://new-site.example.com/$1 [R=301,L]
</IfModule>
# END xserver-files-mcp redirect old-site.example.com
```

### Common Options

All write commands support `--dry-run` to preview changes without writing. Use `--no-backup` to skip the automatic backup. Use `--server <id>` to target a non-default server.

## MCP Registration

Add this to your MCP client config (Claude Desktop, VS Code, etc.):

```json
{
  "mcpServers": {
    "xserver-files": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/xserver-files-mcp/src/server.js"],
      "env": {
        "XSERVER_FILES_CONFIG": "/HOME/YOU/.config/xserver-files-mcp/config.json"
      }
    }
  }
}
```

Replace the paths with absolute paths on your machine.

### MCP Tools

| Tool | Description |
|---|---|
| `list_servers` | List configured server profiles |
| `list_roots` | List domain roots for a profile |
| `init_site_workspace` | Create the local workspace directory for one domain |
| `list_files` | List remote files |
| `read_file` | Read a UTF-8 text file |
| `pull_file_to_workspace` | Pull one remote text file into the local workspace |
| `push_file_from_workspace` | Push one local workspace text file to the remote |
| `backup_file` | Create a timestamped backup next to a remote file |
| `write_file` | Write a UTF-8 file (backs up existing files by default) |
| `replace_in_file` | Exact text replacement with backup by default |
| `set_domain_redirect` | Insert or update a marked `.htaccess` 301 redirect block |

## Multiple Servers

Add entries under `servers` in your config. Pass `server_id` in MCP calls or `--server` in CLI:

```bash
node src/cli.js --server sv67890 roots
```

If omitted, `defaultServer` is used.

## Safety Notes

- All paths are resolved under the configured `roots[domain]`. Absolute paths and `..` traversal are rejected.
- Write operations back up existing files by default.
- Workspace pull/push excludes high-risk paths by default: `wp-config.php`, uploads, logs, backups, SQL dumps, and archives.
- `replaceInFile` and `set_domain_redirect` read, transform, and write in separate SFTP operations. Concurrent edits to the same file by another process may be overwritten.
- Always use `--dry-run` before write operations to preview changes.
- Keep private keys outside this project directory.

## Agent Context

- Repository operating rules: `AGENTS.md`
- SFTP file operations skill: `.skills/xserver-files-operator/SKILL.md`
- XServer panel API skill: `.skills/xserver-mcp-operator/SKILL.md`
