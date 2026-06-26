import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listServerSummaries, validateConfig } from "../src/config.js";

describe("config", () => {
  const config = {
    defaultServer: "sv12345",
    localWorkspaceRoot: "~/Dev/xserver-sites",
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

  it("validates a server config", () => {
    assert.doesNotThrow(() => validateConfig(config));
  });

  it("summarizes without exposing private key paths", () => {
    assert.deepEqual(listServerSummaries(config), [
      {
        server_id: "sv12345",
        host: "sv12345.xsrv.jp",
        port: 10022,
        username: "sv12345",
        domains: ["old-site.example.com"],
        is_default: true
      }
    ]);
  });
});

describe("config validation rejects", () => {
  const createValidConfig = () => ({
    defaultServer: "sv12345",
    localWorkspaceRoot: "~/Dev/xserver-sites",
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
    delete config.servers.sv12345.host;

    assert.throws(() => validateConfig(config), /requires host/);
  });

  it("rejects server port that is not a positive integer", () => {
    const config = createValidConfig();
    config.servers.sv12345.port = "abc";

    assert.throws(() => validateConfig(config), /port must be a positive integer/);
  });

  it("rejects server root that is not an absolute remote path", () => {
    const config = createValidConfig();
    config.servers.sv12345.roots["old-site.example.com"] = "relative/path";

    assert.throws(() => validateConfig(config), /absolute remote path/);
  });

  it("rejects localWorkspaceRoot that is not a string", () => {
    const config = createValidConfig();
    config.localWorkspaceRoot = 123;

    assert.throws(() => validateConfig(config), /must be a string/);
  });
});
