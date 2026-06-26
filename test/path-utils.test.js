import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { joinRemote, normalizeRemotePath } from "../src/path-utils.js";

describe("path utilities", () => {
  it("normalizes relative paths", () => {
    assert.equal(normalizeRemotePath("./wp-content//themes/../plugins"), "wp-content/plugins");
  });

  it("rejects traversal above root", () => {
    assert.throws(() => normalizeRemotePath("../.ssh/id_rsa"), /inside the configured domain root/);
  });

  it("joins paths under configured root", () => {
    assert.equal(joinRemote("/home/sv12345/site/public_html", ".htaccess"), "/home/sv12345/site/public_html/.htaccess");
  });
});
