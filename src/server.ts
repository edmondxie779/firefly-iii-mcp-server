import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FireflyClient } from "./client.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerSystemTools } from "./tools/system.js";
import { registerTransactionTools } from "./tools/transactions.js";

export const SERVER_NAME = "firefly-iii-mcp";
export const SERVER_VERSION = "0.1.0";

export function createFireflyMcpServer(client: FireflyClient): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerSystemTools(server, client);
  registerAccountTools(server, client);
  registerTransactionTools(server, client);

  return server;
}
