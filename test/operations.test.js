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
  defaultServer: "willforward",
  servers: {
    willforward: {
      host: "willforward.xsrv.jp",
      port: 10022,
      username: "willforward",
      privateKeyPath: "~/.ssh/xserver_willforward",
      roots: {
        "willforwardcreate.jp": "/home/willforward/willforwardcreate.jp/public_html"
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
    const backupPath = makeBackupPath("/home/willforward/site/public_html/.htaccess", "redirect");
    assert.match(backupPath, /^\/home\/willforward\/site\/public_html\/\.htaccess\.redirect\..+\.bak$/);
  });

  it("resolves local site workspace paths outside the tool repository", () => {
    const workspaceRoot = path.join(os.tmpdir(), "xserver-sites-test");
    const workspace = resolveSiteWorkspace(config, {
      domain: "willforwardcreate.jp",
      workspace_root: workspaceRoot
    });

    assert.equal(workspace.siteWorkspacePath, path.join(workspaceRoot, "willforward", "willforwardcreate.jp"));
    assert.equal(
      resolveWorkspaceFilePath(workspace.siteWorkspacePath, "css/style.css"),
      path.join(workspaceRoot, "willforward", "willforwardcreate.jp", "css", "style.css")
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
      domain: "willforwardcreate.jp",
      workspace_root: workspaceRoot
    });

    assert.equal(result.local_path, path.join(workspaceRoot, "willforward", "willforwardcreate.jp"));
    const gitignore = fs.readFileSync(path.join(result.local_path, ".gitignore"), "utf8");
    assert.match(gitignore, /wp-config\.php/);
    assert.match(gitignore, /wp-content\/uploads\//);
  });
});
