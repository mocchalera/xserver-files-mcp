import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_CONFIG_PATH = "~/.config/xserver-files-mcp/config.json";

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

export function expandHome(input) {
  if (!input || typeof input !== "string") return input;
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function getConfigPath() {
  return expandHome(process.env.XSERVER_FILES_CONFIG || DEFAULT_CONFIG_PATH);
}

export function loadConfig(configPath = getConfigPath()) {
  if (!fs.existsSync(configPath)) {
    throw new ConfigError(
      `Config file not found: ${configPath}. Set XSERVER_FILES_CONFIG or create ~/.config/xserver-files-mcp/config.json.`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new ConfigError(`Failed to parse config JSON at ${configPath}: ${error.message}`);
  }

  validateConfig(parsed);
  return parsed;
}

export function validateConfig(config) {
  if (!config || typeof config !== "object") {
    throw new ConfigError("Config must be a JSON object.");
  }
  if (!config.defaultServer || typeof config.defaultServer !== "string") {
    throw new ConfigError("Config requires defaultServer.");
  }
  if (!config.servers || typeof config.servers !== "object") {
    throw new ConfigError("Config requires servers.");
  }
  if (config.localWorkspaceRoot !== undefined && typeof config.localWorkspaceRoot !== "string") {
    throw new ConfigError("localWorkspaceRoot must be a string when present.");
  }
  if (!config.servers[config.defaultServer]) {
    throw new ConfigError(`defaultServer "${config.defaultServer}" is not present in servers.`);
  }

  for (const [serverId, server] of Object.entries(config.servers)) {
    if (!server || typeof server !== "object") {
      throw new ConfigError(`Server "${serverId}" must be an object.`);
    }
    for (const key of ["host", "port", "username", "privateKeyPath", "roots"]) {
      if (server[key] === undefined || server[key] === null || server[key] === "") {
        throw new ConfigError(`Server "${serverId}" requires ${key}.`);
      }
    }
    if (!Number.isInteger(server.port) || server.port <= 0) {
      throw new ConfigError(`Server "${serverId}" port must be a positive integer.`);
    }
    if (typeof server.roots !== "object" || Array.isArray(server.roots)) {
      throw new ConfigError(`Server "${serverId}" roots must be an object.`);
    }
    for (const [domain, root] of Object.entries(server.roots)) {
      if (!domain || typeof domain !== "string") {
        throw new ConfigError(`Server "${serverId}" has an invalid domain key.`);
      }
      if (!root || typeof root !== "string" || !root.startsWith("/")) {
        throw new ConfigError(`Root for ${serverId}/${domain} must be an absolute remote path.`);
      }
    }
  }
}

export function getServer(config, serverId) {
  const resolvedServerId = serverId || config.defaultServer;
  const server = config.servers[resolvedServerId];
  if (!server) {
    throw new ConfigError(`Unknown server_id "${resolvedServerId}".`);
  }
  return { serverId: resolvedServerId, server };
}

export function listServerSummaries(config) {
  return Object.entries(config.servers).map(([serverId, server]) => ({
    server_id: serverId,
    host: server.host,
    port: server.port,
    username: server.username,
    domains: Object.keys(server.roots),
    is_default: serverId === config.defaultServer
  }));
}
