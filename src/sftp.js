import fs from "node:fs";
import SftpClient from "ssh2-sftp-client";
import { expandHome } from "./config.js";

export async function withSftp(server, callback) {
  const client = new SftpClient();
  const privateKeyPath = expandHome(server.privateKeyPath);
  const connectConfig = {
    host: server.host,
    port: server.port,
    username: server.username,
    privateKey: fs.readFileSync(privateKeyPath)
  };

  if (server.passphraseEnv && process.env[server.passphraseEnv]) {
    connectConfig.passphrase = process.env[server.passphraseEnv];
  }

  try {
    await client.connect(connectConfig);
    return await callback(client);
  } finally {
    await client.end().catch(() => {});
  }
}
