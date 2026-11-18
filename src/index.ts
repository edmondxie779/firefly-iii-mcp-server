#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FireflyClient } from "./client.js";
import { loadConfigFromEnv } from "./config.js";
import { createFireflyMcpServer } from "./server.js";

function createLazyFireflyClient(): FireflyClient {
  let cached: FireflyClient | undefined;

  try {
    cached = new FireflyClient(loadConfigFromEnv());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[firefly-iii-mcp] Configuration notice: ${msg}`);
  }

  return new Proxy({} as FireflyClient, {
    get(_target, prop) {
      if (!cached) {
        cached = new FireflyClient(loadConfigFromEnv());
      }
      const value = Reflect.get(cached, prop, cached);
      return typeof value === "function" ? value.bind(cached) : value;
    },
  });
}

export async function runStdioServer(): Promise<void> {
  const client = createLazyFireflyClient();
  const server = createFireflyMcpServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("[firefly-iii-mcp] MCP server running on stdio");
}

function isExecutedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  runStdioServer().catch((error) => {
    console.error("[firefly-iii-mcp] Fatal error:", error);
    process.exit(1);
  });
}

export { FireflyClient, FireflyApiError } from "./client.js";
export {
  loadConfigFromEnv,
  normalizeFireflyUrl,
  type FireflyConfig,
} from "./config.js";
export {
  createFireflyMcpServer,
  SERVER_NAME,
  SERVER_VERSION,
} from "./server.js";
export type * from "./types.js";
