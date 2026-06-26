import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ensureSafeSiteFilePath,
  initSiteWorkspace,
  isDefaultExcludedSitePath,
  MAX_READ_SIZE,
  makeBackupPath,
  resolveSiteWorkspace,
  resolveWorkspaceFilePath,
  upsertMarkedBlock
} from "../src/operations.js";

const config = {
  defaultServer: "sv12345",
  servers: {
    sv12345: {
      host: "sv12345.xsrv.jp",
      port: 10022,
      username: "sv12345",
      privateKeyPath: "~/.ssh/xserver_sv12345",
      roots: {
        "old-site.example.com": "/home/sv12345/old-site.example.com/public_html"
      }
    }
  }
};

describe("operations helpers", () => {
  it("exports the maximum read size safety limit", () => {
    assert.equal(MAX_READ_SIZE, 10485760);
  });

  it("inserts a marked block before existing content", () => {
    const result = upsertMarkedBlock("WordPress\n", "# BEGIN test", "# END test", "# BEGIN test\nrule\n# END test");
    assert.equal(result, "# BEGIN test\nrule\n# END test\n\nWordPress\n");
  });

  it("replaces an existing marked block", () => {
    const result = upsertMarkedBlock(
      "# BEGIN test\nold\n# END test\n\nrest",
      "# BEGIN test",
      "# END test",
      "# BEGIN test\nnew\n# END test"
    );
    assert.equal(result, "# BEGIN test\nnew\n# END test\n\nrest");
  });

  it("generates dotfile backup paths next to the target", () => {
    const backupPath = makeBackupPath("/home/sv12345/site/public_html/.htaccess", "redirect");
    assert.match(backupPath, /^\/home\/sv12345\/site\/public_html\/\.htaccess\.redirect\..+\.bak$/);
  });

  it("generates unique backup timestamps", async () => {
    const first = makeBackupPath("/path/file.txt", "backup");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = makeBackupPath("/path/file.txt", "backup");

    assert.notEqual(first, second);
  });

  it("handles dotfile backup paths without double-dotting the basename", () => {
    const backupPath = makeBackupPath("/path/.htaccess", "redirect");

    assert.equal(backupPath.startsWith("/path/.htaccess."), true);
    assert.equal(backupPath.startsWith("/path/..htaccess."), false);
  });

  it("sanitizes backup labels", () => {
    const backupPath = makeBackupPath("/path/file.txt", "my label/bad");
    const backupBase = path.posix.basename(backupPath);

    assert.equal(backupBase.includes(" "), false);
    assert.equal(backupBase.includes("/"), false);
    assert.match(backupBase, /^\.file\.txt\.my-label-bad\..+\.bak$/);
  });

  it("returns only a marked block with trailing newline for empty content", () => {
    const block = "# BEGIN test\nrule\n# END test";
    const result = upsertMarkedBlock("", "# BEGIN test", "# END test", block);

    assert.equal(result, `${block}\n`);
  });

  it("preserves content after an existing marked block", () => {
    const result = upsertMarkedBlock(
      "# BEGIN test\nold\n# END test\nWordPress rules\nMore stuff",
      "# BEGIN test",
      "# END test",
      "# BEGIN test\nnew\n# END test"
    );

    assert.equal(result, "# BEGIN test\nnew\n# END test\nWordPress rules\nMore stuff");
  });

  it("resolves local site workspace paths outside the tool repository", () => {
    const workspaceRoot = path.join(os.tmpdir(), "xserver-sites-test");
    const workspace = resolveSiteWorkspace(config, {
      domain: "old-site.example.com",
      workspace_root: workspaceRoot
    });

    assert.equal(workspace.siteWorkspacePath, path.join(workspaceRoot, "sv12345", "old-site.example.com"));
    assert.equal(
      resolveWorkspaceFilePath(workspace.siteWorkspacePath, "css/style.css"),
      path.join(workspaceRoot, "sv12345", "old-site.example.com", "css", "style.css")
    );
  });

  it("blocks sensitive and generated site paths by default", () => {
    assert.equal(isDefaultExcludedSitePath("wp-config.php"), true);
    assert.equal(isDefaultExcludedSitePath("wp-content/uploads/2026/image.jpg"), true);
    assert.equal(isDefaultExcludedSitePath(".htaccess.backup.2026.bak"), true);
    assert.equal(isDefaultExcludedSitePath(".htaccess"), false);

    assert.throws(() => ensureSafeSiteFilePath("wp-config.php"), /Refusing default-excluded/);
    assert.equal(ensureSafeSiteFilePath("wp-config.php", true), "wp-config.php");
  });

  it("creates a protective gitignore for a local site workspace", async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xserver-sites-"));
    const result = await initSiteWorkspace(config, {
      domain: "old-site.example.com",
      workspace_root: workspaceRoot
    });

    assert.equal(result.local_path, path.join(workspaceRoot, "sv12345", "old-site.example.com"));
    const gitignore = fs.readFileSync(path.join(result.local_path, ".gitignore"), "utf8");
    assert.match(gitignore, /wp-config\.php/);
    assert.match(gitignore, /wp-content\/uploads\//);
  });
});
