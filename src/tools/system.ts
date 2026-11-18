import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FireflyClient } from "../client.js";
import { jsonToolError, jsonToolSuccess } from "../formatters.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function registerSystemTools(server: McpServer, client: FireflyClient): void {
  server.registerTool(
    "get_system_info",
    {
      title: "Get Firefly III System & User Info",
      description:
        "Verify connectivity to Firefly III and retrieve instance version, API version, and authenticated user profile.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const [aboutRes, userRes] = await Promise.all([
          client.getAbout(),
          client.getCurrentUser(),
        ]);

        return jsonToolSuccess({
          system: aboutRes.data,
          user: {
            id: userRes.data.id,
            ...userRes.data.attributes,
          },
        });
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "get_financial_summary",
    {
      title: "Get Financial Summary",
      description:
        "Retrieve Firefly III's basic financial summary (net worth, balance, earned, spent, bills, left to spend) for a given date range.",
      inputSchema: {
        start: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .describe("Start date (YYYY-MM-DD), e.g. 2026-11-01"),
        end: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .describe("End date (YYYY-MM-DD), e.g. 2026-11-30"),
        currency_code: z
          .string()
          .optional()
          .describe("Optional ISO 4217 currency code filter (e.g. CNY, USD, EUR)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ start, end, currency_code }) => {
      try {
        const raw = await client.getBasicSummary({ start, end, currency_code });
        const entries = Array.isArray(raw) ? raw : Object.values(raw);
        const summary = entries.map((item) => ({
          key: item.key,
          title: item.title,
          value: item.monetary_value,
          formatted: item.value_parsed,
          currency_code: item.currency_code,
          sub_title: item.sub_title || undefined,
        }));

        return jsonToolSuccess({
          period: { start, end },
          summary,
        });
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );
}
