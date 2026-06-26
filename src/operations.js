import path from "node:path";
import fs from "node:fs/promises";
import { expandHome } from "./config.js";
import { getServer, listServerSummaries } from "./config.js";
import { ensureRelativeFilePath, joinRemote, normalizeRemotePath } from "./path-utils.js";
import { withSftp } from "./sftp.js";

const TEXT_ENCODING = "utf8";
const DEFAULT_LOCAL_WORKSPACE_ROOT = "~/Dev/xserver-sites";
const WORKSPACE_GITIGNORE = [
  "# Local XServer working tree",
  "# Keep server secrets, generated assets, and backups out of git by default.",
  ".DS_Store",
  "wp-config.php",
  "**/wp-config.php",
  "wp-content/uploads/",
  "uploads/",
  "logs/",
  "log/",
  "*.log",
  "*.bak",
  "*.backup",
  "*.sql",
  "*.sqlite",
  "*.db",
  "*.zip",
  "*.tar",
  "*.tar.gz",
  "*.tgz",
  ""
].join("\n");

export function listServers(config) {
  return {
    defaultServer: config.defaultServer,
    servers: listServerSummaries(config)
  };
}

export function listRoots(config, serverId) {
  const { serverId: resolvedServerId, server } = getServer(config, serverId);
  return {
    server_id: resolvedServerId,
    roots: Object.entries(server.roots).map(([domain, root]) => ({ domain, root }))
  };
}

export function resolveDomainRoot(config, serverId, domain) {
  if (!domain || typeof domain !== "string") {
    throw new Error("domain is required.");
  }
  const { serverId: resolvedServerId, server } = getServer(config, serverId);
  const root = server.roots[domain];
  if (!root) {
    throw new Error(`Domain "${domain}" is not configured for server "${resolvedServerId}".`);
  }
  return { serverId: resolvedServerId, server, domain, root };
}

export async function listFiles(config, input) {
  const { serverId, server, domain, root } = resolveDomainRoot(config, input.server_id, input.domain);
  const remotePath = joinRemote(root, input.path || ".");

  return withSftp(server, async (client) => {
    const items = await client.list(remotePath);
    return {
      server_id: serverId,
      domain,
      path: normalizeRemotePath(input.path || ".") || ".",
      remote_path: remotePath,
      entries: items.map((item) => ({
        name: item.name,
        type: item.type,
        size: item.size,
        modify_time: item.modifyTime ? new Date(item.modifyTime).toISOString() : null,
        access_time: item.accessTime ? new Date(item.accessTime).toISOString() : null
      }))
    };
  });
}

export async function readFile(config, input) {
  const { serverId, server, domain, root } = resolveDomainRoot(config, input.server_id, input.domain);
  const relativePath = ensureRelativeFilePath(input.path);
  const remotePath = joinRemote(root, relativePath);

  return withSftp(server, async (client) => {
    const buffer = await client.get(remotePath);
    return {
      server_id: serverId,
      domain,
      path: relativePath,
      remote_path: remotePath,
      content: Buffer.isBuffer(buffer) ? buffer.toString(TEXT_ENCODING) : String(buffer)
    };
  });
}

export async function backupFile(config, input) {
  const { serverId, server, domain, root } = resolveDomainRoot(config, input.server_id, input.domain);
  const relativePath = ensureRelativeFilePath(input.path);
  const remotePath = joinRemote(root, relativePath);
  const backupRemotePath = makeBackupPath(remotePath, input.label);

  return withSftp(server, async (client) => {
    const existing = await client.get(remotePath);
    await client.put(Buffer.from(existing), backupRemotePath);
    return {
      server_id: serverId,
      domain,
      path: relativePath,
      remote_path: remotePath,
      backup_remote_path: backupRemotePath
    };
  });
}

export async function writeFile(config, input) {
  const { serverId, server, domain, root } = resolveDomainRoot(config, input.server_id, input.domain);
  const relativePath = ensureRelativeFilePath(input.path);
  const remotePath = joinRemote(root, relativePath);
  const backup = input.backup !== false;
  const dryRun = input.dry_run === true;
  const content = input.content || "";
  const writtenBytes = Buffer.byteLength(content, TEXT_ENCODING);

  return withSftp(server, async (client) => {
    let backupRemotePath = null;
    let existed = false;
    try {
      await client.stat(remotePath);
      existed = true;
    } catch {
      existed = false;
    }

    if (dryRun) {
      return {
        server_id: serverId,
        domain,
        path: relativePath,
        remote_path: remotePath,
        dry_run: true,
        would_backup: backup && existed,
        would_write_bytes: writtenBytes
      };
    }

    if (backup && existed) {
      backupRemotePath = makeBackupPath(remotePath, input.backup_label);
      const existing = await client.get(remotePath);
      await client.put(Buffer.from(existing), backupRemotePath);
    }

    await client.put(Buffer.from(content, TEXT_ENCODING), remotePath);
    const writtenStat = await client.stat(remotePath);
    if (writtenStat.size !== writtenBytes) {
      const backupMessage = backupRemotePath
        ? ` The backup at ${backupRemotePath} is intact.`
        : " No backup was created.";
      throw new Error(
        `Write verification failed: expected ${writtenBytes} bytes but remote file is ${writtenStat.size} bytes.${backupMessage}`
      );
    }

    return {
      server_id: serverId,
      domain,
      path: relativePath,
      remote_path: remotePath,
      backup_remote_path: backupRemotePath,
      written_bytes: writtenBytes,
      verified: true
    };
  });
}

export async function replaceInFile(config, input) {
  if (!input.find) {
    throw new Error("find is required.");
  }
  const current = await readFile(config, input);
  const occurrences = countOccurrences(current.content, input.find);
  if (occurrences === 0) {
    return {
      ...withoutContent(current),
      changed: false,
      occurrences: 0
    };
  }

  const nextContent = current.content.split(input.find).join(input.replace ?? "");
  if (input.dry_run) {
    return {
      ...withoutContent(current),
      changed: true,
      dry_run: true,
      occurrences,
      preview: nextContent
    };
  }

  const written = await writeFile(config, {
    server_id: input.server_id,
    domain: input.domain,
    path: input.path,
    content: nextContent,
    backup: input.backup !== false,
    backup_label: input.backup_label
  });

  return {
    ...written,
    changed: true,
    occurrences
  };
}

export async function setDomainRedirect(config, input) {
  if (!input.to_url || typeof input.to_url !== "string") {
    throw new Error("to_url is required.");
  }
  if (!/^https?:\/\//.test(input.to_url)) {
    throw new Error("to_url must start with http:// or https://.");
  }

  const htaccessPath = input.path || ".htaccess";
  const fromDomain = input.domain;
  const escapedDomain = escapeRegex(fromDomain);
  const target = input.preserve_path === false ? input.to_url : trimTrailingSlash(input.to_url) + "/$1";
  const markerStart = `# BEGIN xserver-files-mcp redirect ${fromDomain}`;
  const markerEnd = `# END xserver-files-mcp redirect ${fromDomain}`;
  const block = [
    markerStart,
    "<IfModule mod_rewrite.c>",
    "RewriteEngine On",
    `RewriteCond %{HTTP_HOST} ^(www\\.)?${escapedDomain}$ [NC]`,
    `RewriteRule ^(.*)$ ${target} [R=301,L]`,
    "</IfModule>",
    markerEnd
  ].join("\n");

  let currentContent = "";
  let existed = true;
  try {
    currentContent = (await readFile(config, { ...input, path: htaccessPath })).content;
  } catch (error) {
    if (input.create !== true || !isRemoteNotFoundError(error)) {
      throw error;
    }
    existed = false;
  }

  const nextContent = upsertMarkedBlock(currentContent, markerStart, markerEnd, block);
  if (input.dry_run) {
    return {
      server_id: input.server_id || config.defaultServer,
      domain: fromDomain,
      path: htaccessPath,
      dry_run: true,
      existed,
      content: nextContent
    };
  }

  const written = await writeFile(config, {
    server_id: input.server_id,
    domain: fromDomain,
    path: htaccessPath,
    content: nextContent,
    backup: input.backup !== false,
    backup_label: "redirect"
  });

  return {
    ...written,
    existed,
    redirect_to: input.to_url,
    preserve_path: input.preserve_path !== false
  };
}

export async function initSiteWorkspace(config, input = {}) {
  const { serverId, domain, siteWorkspacePath } = resolveSiteWorkspace(config, input);
  const gitignorePath = path.join(siteWorkspacePath, ".gitignore");

  if (input.dry_run) {
    return {
      server_id: serverId,
      domain,
      local_path: siteWorkspacePath,
      gitignore_path: gitignorePath,
      dry_run: true
    };
  }

  await fs.mkdir(siteWorkspacePath, { recursive: true });
  await writeIfMissing(gitignorePath, WORKSPACE_GITIGNORE);

  return {
    server_id: serverId,
    domain,
    local_path: siteWorkspacePath,
    gitignore_path: gitignorePath
  };
}

export async function pullFileToWorkspace(config, input) {
  const relativePath = ensureSafeSiteFilePath(input.path, input.allow_sensitive);
  const workspace = resolveSiteWorkspace(config, input);
  const localPath = resolveWorkspaceFilePath(workspace.siteWorkspacePath, relativePath);
  const localBackup = input.local_backup !== false;

  if (input.dry_run) {
    return {
      server_id: workspace.serverId,
      domain: workspace.domain,
      path: relativePath,
      local_path: localPath,
      dry_run: true,
      would_read_remote: true,
      would_backup_local: localBackup && (await exists(localPath)),
      would_write_local: true
    };
  }

  const remote = await readFile(config, input);
  await fs.mkdir(path.dirname(localPath), { recursive: true });

  let local_backup_path = null;
  if (localBackup && (await exists(localPath))) {
    local_backup_path = makeLocalBackupPath(localPath, "pull");
    await fs.copyFile(localPath, local_backup_path);
  }

  await fs.writeFile(localPath, remote.content, TEXT_ENCODING);
  return {
    ...withoutContent(remote),
    local_path: localPath,
    local_backup_path,
    written_bytes: Buffer.byteLength(remote.content, TEXT_ENCODING)
  };
}

export async function pushFileFromWorkspace(config, input) {
  const relativePath = ensureSafeSiteFilePath(input.path, input.allow_sensitive);
  const workspace = resolveSiteWorkspace(config, input);
  const localPath = resolveWorkspaceFilePath(workspace.siteWorkspacePath, relativePath);

  if (!(await exists(localPath))) {
    throw new Error(`Local workspace file not found: ${localPath}`);
  }

  const content = await fs.readFile(localPath, TEXT_ENCODING);
  if (input.dry_run) {
    return {
      server_id: workspace.serverId,
      domain: workspace.domain,
      path: relativePath,
      local_path: localPath,
      dry_run: true,
      would_read_local_bytes: Buffer.byteLength(content, TEXT_ENCODING),
      remote_write: await writeFile(config, {
        server_id: input.server_id,
        domain: input.domain,
        path: relativePath,
        content,
        backup: input.backup !== false,
        backup_label: input.backup_label || "workspace-push",
        dry_run: true
      })
    };
  }

  const written = await writeFile(config, {
    server_id: input.server_id,
    domain: input.domain,
    path: relativePath,
    content,
    backup: input.backup !== false,
    backup_label: input.backup_label || "workspace-push"
  });

  return {
    ...written,
    local_path: localPath
  };
}

export function resolveSiteWorkspace(config, input = {}) {
  if (!input.domain || typeof input.domain !== "string") {
    throw new Error("domain is required.");
  }
  const { serverId, server } = getServer(config, input.server_id);
  if (!server.roots[input.domain]) {
    throw new Error(`Domain "${input.domain}" is not configured for server "${serverId}".`);
  }

  const workspaceRoot = resolveWorkspaceRoot(config, input.workspace_root);
  const siteWorkspacePath = path.join(workspaceRoot, serverId, input.domain);
  assertInsideLocalRoot(workspaceRoot, siteWorkspacePath);

  return {
    serverId,
    domain: input.domain,
    workspaceRoot,
    siteWorkspacePath
  };
}

export function resolveWorkspaceFilePath(siteWorkspacePath, relativePath) {
  const safeRelativePath = ensureRelativeFilePath(relativePath);
  const localPath = path.join(siteWorkspacePath, ...safeRelativePath.split("/"));
  assertInsideLocalRoot(siteWorkspacePath, localPath);
  return localPath;
}

export function ensureSafeSiteFilePath(relativePath, allowSensitive = false) {
  const normalized = ensureRelativeFilePath(relativePath);
  if (!allowSensitive && isDefaultExcludedSitePath(normalized)) {
    throw new Error(`Refusing default-excluded site path "${normalized}". Pass allow_sensitive only after reviewing the risk.`);
  }
  return normalized;
}

export function isDefaultExcludedSitePath(relativePath) {
  const normalized = ensureRelativeFilePath(relativePath).toLowerCase();
  const parts = normalized.split("/");
  const basename = parts.at(-1);

  if (basename === "wp-config.php") return true;
  if (parts.includes("uploads") || parts.includes("logs") || parts.includes("log")) return true;
  if (normalized.includes("/wp-content/uploads/") || normalized.startsWith("wp-content/uploads/")) return true;

  return (
    basename.endsWith(".log") ||
    basename.endsWith(".bak") ||
    basename.endsWith(".backup") ||
    basename.endsWith(".sql") ||
    basename.endsWith(".sqlite") ||
    basename.endsWith(".db") ||
    basename.endsWith(".zip") ||
    basename.endsWith(".tar") ||
    basename.endsWith(".tar.gz") ||
    basename.endsWith(".tgz")
  );
}

export function upsertMarkedBlock(content, markerStart, markerEnd, block) {
  const normalizedContent = content || "";
  const startIndex = normalizedContent.indexOf(markerStart);
  const endIndex = normalizedContent.indexOf(markerEnd);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const afterEnd = endIndex + markerEnd.length;
    return `${normalizedContent.slice(0, startIndex)}${block}${normalizedContent.slice(afterEnd)}`;
  }

  const trimmed = normalizedContent.trimStart();
  if (!trimmed) return `${block}\n`;
  return `${block}\n\n${trimmed}`;
}

export function makeBackupPath(remotePath, label = "backup") {
  const dir = path.posix.dirname(remotePath);
  const base = path.posix.basename(remotePath);
  const backupBase = base.startsWith(".") ? base : `.${base}`;
  const safeLabel = String(label || "backup").replace(/[^a-zA-Z0-9_.-]/g, "-");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${dir}/${backupBase}.${safeLabel}.${stamp}.bak`;
}

export function makeLocalBackupPath(localPath, label = "backup") {
  const dir = path.dirname(localPath);
  const base = path.basename(localPath);
  const safeLabel = String(label || "backup").replace(/[^a-zA-Z0-9_.-]/g, "-");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(dir, `.${base}.${safeLabel}.${stamp}.bak`);
}

function resolveWorkspaceRoot(config, override) {
  return path.resolve(expandHome(override || config.localWorkspaceRoot || DEFAULT_LOCAL_WORKSPACE_ROOT));
}

function assertInsideLocalRoot(root, targetPath) {
  const relative = path.relative(path.resolve(root), path.resolve(targetPath));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return;
  throw new Error("local workspace path must stay inside the configured workspace root.");
}

async function exists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeIfMissing(targetPath, content) {
  try {
    await fs.writeFile(targetPath, content, { encoding: TEXT_ENCODING, flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function countOccurrences(content, needle) {
  return content.split(needle).length - 1;
}

function withoutContent(result) {
  const { content, ...rest } = result;
  return rest;
}

function isRemoteNotFoundError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === 2 ||
    error?.code === "ENOENT" ||
    /no such file/i.test(message) ||
    /not found/i.test(message)
  );
}
