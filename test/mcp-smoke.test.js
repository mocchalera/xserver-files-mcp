import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let transport;
let client;

describe("mcp server", () => {
  afterEach(async () => {
    if (transport) await transport.close();
    transport = null;
    client = null;
  });

  it("starts over stdio, lists tools, and calls list_servers", async () => {
    client = new Client({ name: "xserver-files-test", version: "0.1.0" }, { capabilities: {} });
    transport = new StdioClientTransport({
      command: process.execPath,
      args: ["src/server.js"],
      cwd: path.resolve(import.meta.dirname, ".."),
      stderr: "pipe",
      env: {
        ...process.env,
        XSERVER_FILES_CONFIG: "config/example.config.json"
      }
    });

    await client.connect(transport);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    assert.ok(toolNames.includes("list_servers"));
    assert.ok(toolNames.includes("init_site_workspace"));
    assert.ok(toolNames.includes("pull_file_to_workspace"));
    assert.ok(toolNames.includes("push_file_from_workspace"));
    assert.ok(toolNames.includes("set_domain_redirect"));

    const result = await client.callTool({
      name: "list_servers",
      arguments: {}
    });
    const text = result.content.find((item) => item.type === "text")?.text;
    assert.ok(text);
    const parsed = JSON.parse(text);
    assert.equal(parsed.defaultServer, "sv12345");
  });
});
