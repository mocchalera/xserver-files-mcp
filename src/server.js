#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import {
  backupFile,
  initSiteWorkspace,
  listFiles,
  listRoots,
  listServers,
  pullFileToWorkspace,
  pushFileFromWorkspace,
  readFile,
  replaceInFile,
  setDomainRedirect,
  writeFile
} from "./operations.js";

const server = new McpServer({
  name: "xserver-files-mcp",
  version: "0.1.0"
});

function jsonResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: value
      }
    ]
  };
}

function config() {
  return loadConfig();
}

const serverId = z.string().optional().describe("Server profile id. Defaults to config.defaultServer.");
const domain = z.string().describe("Configured domain root to operate under.");
const remotePath = z.string().default(".").describe("Path relative to the configured domain root.");
const filePath = z.string().describe("File path relative to the configured domain root.");
const workspaceRoot = z
  .string()
  .optional()
  .describe("Local workspace root. Defaults to config.localWorkspaceRoot or ~/Dev/xserver-sites.");
const allowSensitive = z
  .boolean()
  .default(false)
  .describe("Allow default-excluded paths such as wp-config.php, uploads, logs, backups, and dumps.");

server.registerTool(
  "list_servers",
  {
    title: "List configured XServer profiles",
    description: "List configured XServer connection profiles and domain roots without connecting to SFTP.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  async () => jsonResult(listServers(config()))
);

server.registerTool(
  "list_roots",
  {
    title: "List domain roots",
    description: "List configured domain roots for a server profile.",
    inputSchema: {
      server_id: serverId
    },
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  async (input) => jsonResult(listRoots(config(), input.server_id))
);

server.registerTool(
  "init_site_workspace",
  {
    title: "Initialize local site workspace",
    description:
      "Create the local workspace directory for a configured domain outside this repository and add a protective .gitignore.",
    inputSchema: {
      server_id: serverId,
      domain,
      workspace_root: workspaceRoot,
      dry_run: z.boolean().default(false).describe("Return paths without creating directories.")
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  async (input) => jsonResult(await initSiteWorkspace(config(), input))
);

server.registerTool(
  "list_files",
  {
    title: "List remote files",
    description: "List files under a configured domain root over SFTP.",
    inputSchema: {
      server_id: serverId,
      domain,
      path: remotePath
    },
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  async (input) => jsonResult(await listFiles(config(), input))
);

server.registerTool(
  "read_file",
  {
    title: "Read remote file",
    description: "Read a UTF-8 text file under a configured domain root over SFTP.",
    inputSchema: {
      server_id: serverId,
      domain,
      path: filePath
    },
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  async (input) => {
    const result = await readFile(config(), input);
    return textResult(result.content);
  }
);

server.registerTool(
  "pull_file_to_workspace",
  {
    title: "Pull remote file to local workspace",
    description:
      "Read one remote UTF-8 file and write it under the matching local site workspace path. Existing local files are backed up by default.",
    inputSchema: {
      server_id: serverId,
      domain,
      path: filePath,
      workspace_root: workspaceRoot,
      allow_sensitive: allowSensitive,
      local_backup: z.boolean().default(true).describe("Back up an existing local file before overwriting it."),
      dry_run: z.boolean().default(false).describe("Return what would happen without reading or writing.")
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  async (input) => jsonResult(await pullFileToWorkspace(config(), input))
);

server.registerTool(
  "push_file_from_workspace",
  {
    title: "Push local workspace file",
    description:
      "Read one local workspace file and write it to the matching remote path. Existing remote files are backed up by default.",
    inputSchema: {
      server_id: serverId,
      domain,
      path: filePath,
      workspace_root: workspaceRoot,
      allow_sensitive: allowSensitive,
      backup: z.boolean().default(true).describe("Back up existing remote file before writing."),
      backup_label: z.string().optional().describe("Backup label used in the generated filename."),
      dry_run: z.boolean().default(false).describe("Return what would happen without writing.")
    },
    annotations: { readOnlyHint: false, destructiveHint: true }
  },
  async (input) => jsonResult(await pushFileFromWorkspace(config(), input))
);

server.registerTool(
  "backup_file",
  {
    title: "Backup remote file",
    description: "Create a timestamped dotfile backup next to a remote file.",
    inputSchema: {
      server_id: serverId,
      domain,
      path: filePath,
      label: z.string().optional().describe("Backup label used in the generated filename.")
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  async (input) => jsonResult(await backupFile(config(), input))
);

server.registerTool(
  "write_file",
  {
    title: "Write remote file",
    description: "Write a UTF-8 text file under a configured domain root. Existing files are backed up by default.",
    inputSchema: {
      server_id: serverId,
      domain,
      path: filePath,
      content: z.string().describe("UTF-8 text content to write."),
      backup: z.boolean().default(true).describe("Back up existing file before writing."),
      backup_label: z.string().optional().describe("Backup label used in the generated filename."),
      dry_run: z.boolean().default(false).describe("Return what would happen without writing.")
    },
    annotations: { readOnlyHint: false, destructiveHint: true }
  },
  async (input) => jsonResult(await writeFile(config(), input))
);

server.registerTool(
  "replace_in_file",
  {
    title: "Replace text in remote file",
    description: "Read a file, replace all exact text matches, and write it back with backup by default.",
    inputSchema: {
      server_id: serverId,
      domain,
      path: filePath,
      find: z.string().describe("Exact text to replace."),
      replace: z.string().default("").describe("Replacement text."),
      backup: z.boolean().default(true).describe("Back up existing file before writing."),
      backup_label: z.string().optional().describe("Backup label used in the generated filename."),
      dry_run: z.boolean().default(false).describe("Return preview without writing.")
    },
    annotations: { readOnlyHint: false, destructiveHint: true }
  },
  async (input) => jsonResult(await replaceInFile(config(), input))
);

server.registerTool(
  "set_domain_redirect",
  {
    title: "Set domain redirect",
    description:
      "Insert or update a marked .htaccess 301 redirect block for a configured source domain. Creates a backup by default.",
    inputSchema: {
      server_id: serverId,
      domain: z.string().describe("Source domain to redirect, such as willforwardcreate.jp."),
      to_url: z.string().describe("Destination URL, such as https://willforward.co.jp."),
      path: z.string().default(".htaccess").describe("Relative .htaccess path under the source domain root."),
      preserve_path: z.boolean().default(true).describe("Append the original request path to the destination."),
      backup: z.boolean().default(true).describe("Back up existing .htaccess before writing."),
      create: z.boolean().default(true).describe("Create .htaccess if it does not exist."),
      dry_run: z.boolean().default(false).describe("Return resulting content without writing.")
    },
    annotations: { readOnlyHint: false, destructiveHint: true }
  },
  async (input) => jsonResult(await setDomainRedirect(config(), input))
);

const transport = new StdioServerTransport();
await server.connect(transport);
