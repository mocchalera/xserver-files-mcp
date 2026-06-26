import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listServerSummaries, validateConfig } from "../src/config.js";

describe("config", () => {
  const config = {
    defaultServer: "willforward",
    localWorkspaceRoot: "~/Dev/xserver-sites",
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

  it("validates a server config", () => {
    assert.doesNotThrow(() => validateConfig(config));
  });

  it("summarizes without exposing private key paths", () => {
    assert.deepEqual(listServerSummaries(config), [
      {
        server_id: "willforward",
        host: "willforward.xsrv.jp",
        port: 10022,
        username: "willforward",
        domains: ["willforwardcreate.jp"],
        is_default: true
      }
    ]);
  });
});
