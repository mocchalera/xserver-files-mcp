# xserver-files-mcp

Local stdio MCP server and CLI for safe XServer file operations over SFTP.

Supports single or multiple XServer accounts with per-domain path isolation, default backups, and dry-run previews.

## What It Does

- Connects to XServer with SFTP over SSH port `10022`
- Restricts all file operations to configured domain roots
- Reads, lists, writes, backs up, and replaces UTF-8 text files
- Adds a marked `.htaccess` 301 redirect block with backup by default
- Exposes the same operations through both MCP and CLI

## Setup

Install dependencies:

```bash
npm install
```

Create an SSH key for XServer:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/xserver_sv12345 -C xserver-sv12345
```

Register the public key in XServer Server Panel, then test SFTP/SSH:

```bash
ssh -p 10022 -i ~/.ssh/xserver_sv12345 sv12345@sv12345.xsrv.jp 'pwd'
```

Create the local config:

```bash
mkdir -p ~/.config/xserver-files-mcp
cp config/example.config.json ~/.config/xserver-files-mcp/config.json
```

Edit `~/.config/xserver-files-mcp/config.json` if the remote document roots differ.

By default, local site workspaces live outside this repository:

```json
{
  "localWorkspaceRoot": "~/Dev/xserver-sites"
}
```

The expected shape is:

```text
~/Dev/xserver-sites/
  sv12345/
    old-site.example.com/
    new-site.example.com/
  sv67890/
    blog.example.com/
```

Keep this repository for the MCP/CLI source code only. Do not clone remote site files into this repository.

## CLI Usage

List configured servers without connecting:

```bash
npm run cli -- servers
```

List a domain root:

```bash
npm run cli -- ls old-site.example.com .
```

Read `.htaccess`:

```bash
npm run cli -- read old-site.example.com .htaccess
```

Create the local workspace for one domain:

```bash
npm run cli -- workspace old-site.example.com
```

Pull one remote file into the local site workspace:

```bash
npm run cli -- pull old-site.example.com .htaccess
```

The file is written to:

```text
~/Dev/xserver-sites/sv12345/old-site.example.com/.htaccess
```

Push the matching local workspace file back to the server with remote backup by default:

```bash
npm run cli -- push old-site.example.com .htaccess --dry-run
npm run cli -- push old-site.example.com .htaccess
```

The workspace pull/push flow refuses `wp-config.php`, uploads, logs, backups, database dumps, and archives by default. Use `--allow-sensitive` only after reviewing the risk.

Dry-run the redirect change:

```bash
npm run cli -- redirect old-site.example.com https://new-site.example.com --dry-run
```

Apply the redirect:

```bash
npm run cli -- redirect old-site.example.com https://new-site.example.com
```

The redirect command inserts or updates this marked block:

```apache
# BEGIN xserver-files-mcp redirect old-site.example.com
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTP_HOST} ^(www\.)?old-site\.example\.com$ [NC]
RewriteRule ^(.*)$ https://new-site.example.com/$1 [R=301,L]
</IfModule>
# END xserver-files-mcp redirect old-site.example.com
```

## MCP Registration

Use the package directory as the command working directory and run:

```bash
node src/server.js
```

Example MCP config shape:

```json
{
  "mcpServers": {
    "xserver-files": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/xserver-files-mcp/src/server.js"],
      "env": {
        "XSERVER_FILES_CONFIG": "/Users/YOU/.config/xserver-files-mcp/config.json"
      }
    }
  }
}
```

## Tools

- `list_servers`: list configured server profiles
- `list_roots`: list domain roots for a profile
- `init_site_workspace`: create the local workspace directory for one domain
- `list_files`: list remote files
- `read_file`: read a UTF-8 text file
- `pull_file_to_workspace`: pull one remote text file into the local site workspace
- `push_file_from_workspace`: push one local workspace text file to the matching remote path
- `backup_file`: create a timestamped backup next to a remote file
- `write_file`: write a UTF-8 file, backing up existing files by default
- `replace_in_file`: exact text replacement with backup by default
- `set_domain_redirect`: insert or update a marked `.htaccess` 301 redirect block

## Agent Context

- Repository-level operating rules live in `AGENTS.md`.
- The project-local skill for this custom SFTP MCP/CLI lives at `.skills/xserver-files-operator/SKILL.md`.
- The project-local skill for the XServer-provided MCP server-panel tools lives at `.skills/xserver-mcp-operator/SKILL.md`.
- Keep `.skills/` as the authored source for reusable agent workflow guidance.

## Multiple Servers

Add more entries under `servers` and pass `server_id` in MCP calls, or `--server` in CLI calls:

```bash
npm run cli -- --server sv67890 roots
```

If omitted, `defaultServer` is used.

## Safety Notes

- The code never accepts absolute remote file paths from tool input.
- All paths are resolved under the configured `roots[domain]`.
- `..` traversal above the domain root is rejected.
- Write operations back up existing files by default.
- Local site workspaces are outside this repository by default, under `~/Dev/xserver-sites`.
- Workspace pull/push excludes high-risk site paths by default: `wp-config.php`, uploads, logs, backups, SQL/database dumps, and archives.
- Keep private keys outside this project directory.
- `replaceInFile` and `set_domain_redirect` read, transform, and write in separate SFTP operations. Concurrent edits to the same file by another process may be overwritten. Coordinate edits when multiple operators share a server.
- Always use `--dry-run` before write operations to preview changes. Follow with `read` to verify the result after applying.
