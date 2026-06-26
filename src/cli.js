#!/usr/bin/env node
import fs from "node:fs";
import { Command } from "commander";
import { ConfigError, expandHome, loadConfig } from "./config.js";
import {
  backupFile,
  cleanupBackups,
  initSiteWorkspace,
  listBackups,
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
import { withSftp } from "./sftp.js";

const program = new Command();

program
  .name("xserver-files")
  .description("Safe XServer file operations over SFTP")
  .option("-c, --config <path>", "Config path. Defaults to XSERVER_FILES_CONFIG or ~/.config/xserver-files-mcp/config.json")
  .option("-s, --server <server_id>", "Server profile id. Defaults to config.defaultServer.");

function config() {
  return loadConfig(program.opts().config);
}

function baseInput(domain, path) {
  return {
    server_id: program.opts().server,
    domain,
    path
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printCheck(passed, message) {
  process.stdout.write(`[${passed ? "PASS" : "FAIL"}] ${message}\n`);
}

function displayConfigPath() {
  return program.opts().config || process.env.XSERVER_FILES_CONFIG || "~/.config/xserver-files-mcp/config.json";
}

program
  .command("servers")
  .description("List configured server profiles")
  .action(() => printJson(listServers(config())));

program
  .command("doctor")
  .description("Check config, SSH key files, and SFTP connectivity")
  .action(async () => {
    const configPath = displayConfigPath();
    let loadedConfig;
    let hasFailures = false;

    try {
      loadedConfig = config();
      printCheck(true, `Config loaded: ${configPath}`);
    } catch (error) {
      if (error instanceof ConfigError) {
        printCheck(false, `Config loaded: ${configPath} — ${error.message}`);
        process.exitCode = 1;
        return;
      }
      throw error;
    }

    for (const [serverId, server] of Object.entries(loadedConfig.servers)) {
      const keyPath = server.privateKeyPath;
      const keyExists = fs.existsSync(expandHome(keyPath));
      hasFailures = hasFailures || !keyExists;
      printCheck(keyExists, `SSH key exists: ${serverId} (${keyPath})`);
    }

    for (const [serverId, server] of Object.entries(loadedConfig.servers)) {
      try {
        await withSftp(server, async (client) => {
          await client.list("/");
          return true;
        });
        printCheck(true, `SFTP connection: ${serverId}`);
      } catch (error) {
        hasFailures = true;
        printCheck(false, `SFTP connection: ${serverId} — ${error.message}`);
      }
    }

    process.exitCode = hasFailures ? 1 : 0;
  });

program
  .command("roots")
  .description("List configured domain roots")
  .action(() => printJson(listRoots(config(), program.opts().server)));

program
  .command("workspace")
  .description("Create or report the local workspace for a configured domain")
  .argument("<domain>", "Configured domain")
  .option("--workspace-root <path>", "Local workspace root. Defaults to config.localWorkspaceRoot or ~/Dev/xserver-sites.")
  .option("--dry-run", "Return paths without creating directories")
  .action(async (domain, options) =>
    printJson(
      await initSiteWorkspace(config(), {
        server_id: program.opts().server,
        domain,
        workspace_root: options.workspaceRoot,
        dry_run: options.dryRun
      })
    )
  );

program
  .command("ls")
  .description("List remote files")
  .argument("<domain>", "Configured domain")
  .argument("[path]", "Path relative to the domain root", ".")
  .action(async (domain, path) => printJson(await listFiles(config(), baseInput(domain, path))));

program
  .command("read")
  .description("Read a remote UTF-8 text file")
  .argument("<domain>", "Configured domain")
  .argument("<path>", "File path relative to the domain root")
  .action(async (domain, path) => {
    const result = await readFile(config(), baseInput(domain, path));
    process.stdout.write(result.content);
  });

program
  .command("pull")
  .description("Pull one remote UTF-8 file into the local site workspace")
  .argument("<domain>", "Configured domain")
  .argument("<path>", "File path relative to the domain root")
  .option("--workspace-root <path>", "Local workspace root. Defaults to config.localWorkspaceRoot or ~/Dev/xserver-sites.")
  .option("--allow-sensitive", "Allow default-excluded paths such as wp-config.php, uploads, logs, backups, and dumps")
  .option("--no-local-backup", "Do not back up an existing local file before overwriting it")
  .option("--dry-run", "Return what would happen without reading or writing")
  .action(async (domain, path, options) =>
    printJson(
      await pullFileToWorkspace(config(), {
        ...baseInput(domain, path),
        workspace_root: options.workspaceRoot,
        allow_sensitive: options.allowSensitive,
        local_backup: options.localBackup,
        dry_run: options.dryRun
      })
    )
  );

program
  .command("push")
  .description("Push one local workspace file to the matching remote path, with remote backup by default")
  .argument("<domain>", "Configured domain")
  .argument("<path>", "File path relative to the domain root")
  .option("--workspace-root <path>", "Local workspace root. Defaults to config.localWorkspaceRoot or ~/Dev/xserver-sites.")
  .option("--allow-sensitive", "Allow default-excluded paths such as wp-config.php, uploads, logs, backups, and dumps")
  .option("--no-backup", "Do not back up existing remote file")
  .option("--dry-run", "Return what would happen without writing")
  .action(async (domain, path, options) =>
    printJson(
      await pushFileFromWorkspace(config(), {
        ...baseInput(domain, path),
        workspace_root: options.workspaceRoot,
        allow_sensitive: options.allowSensitive,
        backup: options.backup,
        dry_run: options.dryRun
      })
    )
  );

program
  .command("backup")
  .description("Create a timestamped remote backup next to a file")
  .argument("<domain>", "Configured domain")
  .argument("<path>", "File path relative to the domain root")
  .option("--label <label>", "Backup label")
  .action(async (domain, path, options) =>
    printJson(await backupFile(config(), { ...baseInput(domain, path), label: options.label }))
  );

program
  .command("backups")
  .description("List timestamped remote backups for a file")
  .argument("<domain>", "Configured domain")
  .argument("<path>", "File path relative to the domain root")
  .action(async (domain, path) => printJson(await listBackups(config(), baseInput(domain, path))));

program
  .command("cleanup-backups")
  .description("Delete old timestamped remote backups for a file")
  .argument("<domain>", "Configured domain")
  .argument("<path>", "File path relative to the domain root")
  .option("--keep <number>", "Number of newest backups to keep. Defaults to 5.")
  .option("--dry-run", "Return what would be deleted without deleting")
  .action(async (domain, path, options) =>
    printJson(
      await cleanupBackups(config(), {
        ...baseInput(domain, path),
        keep: options.keep,
        dry_run: options.dryRun
      })
    )
  );

program
  .command("write")
  .description("Write a remote UTF-8 text file, with backup by default")
  .argument("<domain>", "Configured domain")
  .argument("<path>", "File path relative to the domain root")
  .option("--from <local_file>", "Read content from a local file")
  .option("--stdin", "Read content from stdin")
  .option("--no-backup", "Do not back up existing remote file")
  .option("--dry-run", "Return what would happen without writing")
  .action(async (domain, path, options) => {
    const content = readContentInput(options);
    printJson(
      await writeFile(config(), {
        ...baseInput(domain, path),
        content,
        backup: options.backup,
        dry_run: options.dryRun
      })
    );
  });

program
  .command("replace")
  .description("Replace exact text in a remote file")
  .argument("<domain>", "Configured domain")
  .argument("<path>", "File path relative to the domain root")
  .requiredOption("--find <text>", "Exact text to replace")
  .requiredOption("--replace <text>", "Replacement text")
  .option("--no-backup", "Do not back up existing remote file")
  .option("--dry-run", "Return preview without writing")
  .action(async (domain, path, options) =>
    printJson(
      await replaceInFile(config(), {
        ...baseInput(domain, path),
        find: options.find,
        replace: options.replace,
        backup: options.backup,
        dry_run: options.dryRun
      })
    )
  );

program
  .command("redirect")
  .description("Set a marked .htaccess 301 redirect block")
  .argument("<from_domain>", "Configured source domain")
  .argument("<to_url>", "Destination URL")
  .option("--path <path>", "Relative .htaccess path", ".htaccess")
  .option("--no-preserve-path", "Do not append original request path")
  .option("--no-backup", "Do not back up existing .htaccess")
  .option("--dry-run", "Return resulting .htaccess content without writing")
  .action(async (domain, toUrl, options) =>
    printJson(
      await setDomainRedirect(config(), {
        server_id: program.opts().server,
        domain,
        to_url: toUrl,
        path: options.path,
        preserve_path: options.preservePath,
        backup: options.backup,
        create: true,
        dry_run: options.dryRun
      })
    )
  );

program.parseAsync().catch((error) => {
  process.stderr.write(`${error.name || "Error"}: ${error.message}\n`);
  process.exitCode = 1;
});

function readContentInput(options) {
  if (options.from && options.stdin) {
    throw new Error("Use either --from or --stdin, not both.");
  }
  if (options.from) return fs.readFileSync(options.from, "utf8");
  if (options.stdin) return fs.readFileSync(0, "utf8");
  throw new Error("write requires --from <local_file> or --stdin.");
}
