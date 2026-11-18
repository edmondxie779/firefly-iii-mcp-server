import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { FireflyClient } from "../src/client.js";
import { loadConfigFromEnv, normalizeFireflyUrl } from "../src/config.js";
import { createFireflyMcpServer } from "../src/server.js";

function createMockFetch(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    return handler(new URL(urlStr), init);
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/vnd.api+json" },
  });
}

async function setupTestMcpPair(fetchImpl: typeof fetch) {
  const fireflyClient = new FireflyClient(
    {
      baseUrl: "https://firefly.example.com",
      apiBaseUrl: "https://firefly.example.com/api/v1",
      pat: "test-pat-token",
      timeoutMs: 5000,
    },
    fetchImpl,
  );

  const server = createFireflyMcpServer(fireflyClient);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}

describe("config helpers", () => {
  it("normalizes Firefly III base URLs and strips /api/v1 suffixes", () => {
    expect(normalizeFireflyUrl("https://firefly.example.com/")).toEqual({
      baseUrl: "https://firefly.example.com",
      apiBaseUrl: "https://firefly.example.com/api/v1",
    });
    expect(normalizeFireflyUrl("https://firefly.example.com/subpath/api/v1/")).toEqual({
      baseUrl: "https://firefly.example.com/subpath",
      apiBaseUrl: "https://firefly.example.com/subpath/api/v1",
    });
  });

  it("loads config from primary or fallback env variables", () => {
    const cfg = loadConfigFromEnv({
      FIREFLY_BASE_URL: "http://localhost:8080/",
      FIREFLY_III_TOKEN: "secret_token",
      FIREFLY_III_TIMEOUT_MS: "15000",
    });
    expect(cfg).toEqual({
      baseUrl: "http://localhost:8080",
      apiBaseUrl: "http://localhost:8080/api/v1",
      pat: "secret_token",
      timeoutMs: 15000,
    });
  });

  it("throws descriptive errors when required env vars are missing", () => {
    expect(() => loadConfigFromEnv({})).toThrow(/FIREFLY_III_URL/);
    expect(() =>
      loadConfigFromEnv({ FIREFLY_III_URL: "http://localhost:8080" }),
    ).toThrow(/FIREFLY_III_PAT/);
  });
});

describe("Firefly III MCP Server", () => {
  it("registers all 15 expected MCP tools", async () => {
    const mockFetch = createMockFetch(() => jsonResponse({}));
    const { client } = await setupTestMcpPair(mockFetch);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual([
      "create_account",
      "create_transaction",
      "delete_account",
      "delete_transaction",
      "get_account",
      "get_financial_summary",
      "get_system_info",
      "get_transaction",
      "list_account_transactions",
      "list_accounts",
      "list_transactions",
      "search_accounts",
      "search_transactions",
      "update_account",
      "update_transaction",
    ]);
  });

  it("lists accounts with default type='asset' and formats balances concisely", async () => {
    const mockFetch = createMockFetch((url, init) => {
      expect(url.pathname).toBe("/api/v1/accounts");
      expect(url.searchParams.get("type")).toBe("asset");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-pat-token",
        Accept: "application/vnd.api+json",
      });

      return jsonResponse({
        data: [
          {
            type: "accounts",
            id: "1",
            attributes: {
              name: "招商银行储蓄卡",
              type: "asset",
              account_role: "defaultAsset",
              active: true,
              currency_code: "CNY",
              currency_symbol: "¥",
              current_balance: "12580.50",
              virtual_balance: "0.00",
              iban: null,
            },
          },
        ],
        meta: {
          pagination: {
            total: 1,
            count: 1,
            per_page: 50,
            current_page: 1,
            total_pages: 1,
          },
        },
      });
    });

    const { client } = await setupTestMcpPair(mockFetch);
    const result = await client.callTool({ name: "list_accounts", arguments: {} });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.accounts).toEqual([
      {
        id: "1",
        name: "招商银行储蓄卡",
        type: "asset",
        account_role: "defaultAsset",
        active: true,
        currency_code: "CNY",
        currency_symbol: "¥",
        current_balance: "12580.50",
      },
    ]);
    expect(parsed.pagination.total).toBe(1);
  });

  it("applies defaultAsset role when creating an asset account and validates liability accounts", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const mockFetch = createMockFetch((url, init) => {
      expect(url.pathname).toBe("/api/v1/accounts");
      expect(init?.method).toBe("POST");
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse({
        data: {
          type: "accounts",
          id: "42",
          attributes: {
            name: String(capturedBody?.name),
            type: "asset",
            account_role: String(capturedBody?.account_role),
            active: true,
            currency_code: "CNY",
            current_balance: "0.00",
          },
        },
      });
    });

    const { client } = await setupTestMcpPair(mockFetch);

    const okResult = await client.callTool({
      name: "create_account",
      arguments: {
        name: "日常钱包",
        type: "asset",
        currency_code: "CNY",
      },
    });
    expect(okResult.isError).toBeFalsy();
    expect(capturedBody?.account_role).toBe("defaultAsset");

    const badLiability = await client.callTool({
      name: "create_account",
      arguments: {
        name: "房贷",
        type: "liability",
      },
    });
    expect(badLiability.isError).toBe(true);
    expect((badLiability.content[0] as { text: string }).text).toContain(
      "liability_type",
    );
  });

  it("preserves existing account name when update_account omits name", async () => {
    let putBody: Record<string, unknown> | undefined;
    const mockFetch = createMockFetch((url, init) => {
      if (init?.method === "GET" && url.pathname === "/api/v1/accounts/7") {
        return jsonResponse({
          data: {
            type: "accounts",
            id: "7",
            attributes: {
              name: "工商银行",
              type: "asset",
              active: true,
            },
          },
        });
      }
      if (init?.method === "PUT" && url.pathname === "/api/v1/accounts/7") {
        putBody = JSON.parse(String(init.body));
        return jsonResponse({
          data: {
            type: "accounts",
            id: "7",
            attributes: {
              name: String(putBody?.name),
              type: "asset",
              active: true,
              notes: String(putBody?.notes),
            },
          },
        });
      }
      throw new Error(`Unexpected call: ${init?.method} ${url.pathname}`);
    });

    const { client } = await setupTestMcpPair(mockFetch);
    const res = await client.callTool({
      name: "update_account",
      arguments: { id: "7", notes: "工资卡" },
    });

    expect(res.isError).toBeFalsy();
    expect(putBody).toMatchObject({ name: "工商银行", notes: "工资卡" });
  });

  it("creates withdrawal transactions and converts numeric amounts to strings", async () => {
    let postedTx: Record<string, unknown> | undefined;
    const mockFetch = createMockFetch((url, init) => {
      expect(url.pathname).toBe("/api/v1/transactions");
      expect(init?.method).toBe("POST");
      postedTx = JSON.parse(String(init?.body));
      return jsonResponse({
        data: {
          type: "transactions",
          id: "108",
          attributes: {
            created_at: "2026-11-18T14:00:00+08:00",
            transactions: [
              {
                transaction_journal_id: "201",
                type: "withdrawal",
                date: "2026-11-18",
                amount: "38.5",
                currency_code: "CNY",
                description: "瑞幸咖啡",
                source_name: "招商银行储蓄卡",
                destination_name: "瑞幸咖啡",
                category_name: "餐饮",
                tags: ["咖啡"],
              },
            ],
          },
        },
      });
    });

    const { client } = await setupTestMcpPair(mockFetch);
    const res = await client.callTool({
      name: "create_transaction",
      arguments: {
        transactions: [
          {
            type: "withdrawal",
            date: "2026-11-18",
            amount: 38.5,
            description: "瑞幸咖啡",
            source_name: "招商银行储蓄卡",
            destination_name: "瑞幸咖啡",
            category_name: "餐饮",
            tags: ["咖啡"],
          },
        ],
      },
    });

    expect(res.isError).toBeFalsy();
    const splits = postedTx?.transactions as Array<Record<string, unknown>>;
    expect(splits[0]?.amount).toBe("38.5");

    const output = JSON.parse((res.content[0] as { text: string }).text);
    expect(output.id).toBe("108");
    expect(output.splits[0].category_name).toBe("餐饮");
  });

  it("surfaces Firefly III 422 field validation errors cleanly", async () => {
    const mockFetch = createMockFetch(() =>
      jsonResponse(
        {
          message: "The given data was invalid.",
          errors: {
            "transactions.0.source_id": ["Source account ID does not exist."],
          },
        },
        422,
      ),
    );

    const { client } = await setupTestMcpPair(mockFetch);
    const res = await client.callTool({
      name: "create_transaction",
      arguments: {
        transactions: [
          {
            type: "withdrawal",
            date: "2026-11-18",
            amount: "50.00",
            description: "Test",
            source_id: "999999",
          },
        ],
      },
    });

    expect(res.isError).toBe(true);
    const errorText = (res.content[0] as { text: string }).text;
    expect(errorText).toContain("422");
    expect(errorText).toContain("transactions.0.source_id");
    expect(errorText).toContain("Source account ID does not exist.");
  });

  it("handles 204 No Content on delete_transaction", async () => {
    const mockFetch = createMockFetch((url, init) => {
      expect(url.pathname).toBe("/api/v1/transactions/108");
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 204 });
    });

    const { client } = await setupTestMcpPair(mockFetch);
    const res = await client.callTool({
      name: "delete_transaction",
      arguments: { id: "108" },
    });

    expect(res.isError).toBeFalsy();
    expect(JSON.parse((res.content[0] as { text: string }).text)).toEqual({
      deleted: true,
      transaction_id: "108",
    });
  });
});
