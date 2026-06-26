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

describe("config validation rejects", () => {
  const createValidConfig = () => ({
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
  });

  it("rejects missing defaultServer", () => {
    const config = createValidConfig();
    delete config.defaultServer;

    assert.throws(() => validateConfig(config), /requires defaultServer/);
  });

  it("rejects missing servers", () => {
    const config = createValidConfig();
    delete config.servers;

    assert.throws(() => validateConfig(config), /requires servers/);
  });

  it("rejects defaultServer not present in servers", () => {
    const config = createValidConfig();
    config.defaultServer = "missing";

    assert.throws(() => validateConfig(config), /not present in servers/);
  });

  it("rejects server missing required host", () => {
    const config = createValidConfig();
    delete config.servers.willforward.host;

    assert.throws(() => validateConfig(config), /requires host/);
  });

  it("rejects server port that is not a positive integer", () => {
    const config = createValidConfig();
    config.servers.willforward.port = "abc";

    assert.throws(() => validateConfig(config), /port must be a positive integer/);
  });

  it("rejects server root that is not an absolute remote path", () => {
    const config = createValidConfig();
    config.servers.willforward.roots["willforwardcreate.jp"] = "relative/path";

    assert.throws(() => validateConfig(config), /absolute remote path/);
  });

  it("rejects localWorkspaceRoot that is not a string", () => {
    const config = createValidConfig();
    config.localWorkspaceRoot = 123;

    assert.throws(() => validateConfig(config), /must be a string/);
  });
});
