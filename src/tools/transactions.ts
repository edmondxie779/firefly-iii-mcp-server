import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FireflyClient } from "../client.js";
import {
  formatTransaction,
  formatTransactionList,
  jsonToolError,
  jsonToolSuccess,
} from "../formatters.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_OR_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

const transactionTypeFilterSchema = z.enum([
  "all",
  "withdrawal",
  "withdrawals",
  "expense",
  "deposit",
  "deposits",
  "income",
  "transfer",
  "transfers",
]);

const createSplitSchema = z.object({
  type: z
    .enum(["withdrawal", "deposit", "transfer"])
    .describe(
      "'withdrawal' = expense (money leaves an asset/liability account to an expense merchant); 'deposit' = income (money enters an asset account from a revenue source); 'transfer' = move money between two of your own asset/liability accounts.",
    ),
  date: z
    .string()
    .regex(
      ISO_DATE_OR_DATETIME_REGEX,
      "Expected YYYY-MM-DD or ISO 8601 datetime (e.g. 2026-11-18T12:30:00+08:00)",
    )
    .describe("Transaction date (YYYY-MM-DD or full ISO 8601 timestamp)."),
  amount: z
    .union([z.string().min(1), z.number().positive()])
    .transform((val) => String(val))
    .describe("Positive transaction amount (e.g. '45.50')."),
  description: z.string().min(1).describe("Description of the transaction."),
  source_id: z
    .string()
    .optional()
    .describe(
      "Source account ID. For 'withdrawal' or 'transfer', provide your asset account's source_id (or source_name).",
    ),
  source_name: z
    .string()
    .optional()
    .describe(
      "Source account name. For 'deposit', if the revenue account doesn't exist yet, Firefly III creates it automatically.",
    ),
  destination_id: z
    .string()
    .optional()
    .describe(
      "Destination account ID. For 'deposit' or 'transfer', provide your target asset account's destination_id (or destination_name).",
    ),
  destination_name: z
    .string()
    .optional()
    .describe(
      "Destination account name. For 'withdrawal', pass the merchant/payee name (Firefly III creates the expense account automatically if new).",
    ),
  currency_code: z
    .string()
    .optional()
    .describe("ISO 4217 currency code (defaults to the account's currency)."),
  foreign_amount: z
    .union([z.string(), z.number().positive()])
    .transform((val) => String(val))
    .optional()
    .describe("Foreign currency amount if this was a multi-currency transaction."),
  foreign_currency_code: z
    .string()
    .optional()
    .describe("ISO 4217 code for foreign_amount (required if foreign_amount is set)."),
  category_id: z.string().optional().describe("Category ID."),
  category_name: z
    .string()
    .optional()
    .describe("Category name (created automatically by Firefly III if it does not exist)."),
  budget_id: z.string().optional().describe("Budget ID (only valid for withdrawals)."),
  budget_name: z.string().optional().describe("Budget name (only valid for withdrawals)."),
  bill_id: z.string().optional().describe("Linked bill/subscription ID."),
  bill_name: z.string().optional().describe("Linked bill/subscription name."),
  piggy_bank_id: z
    .number()
    .int()
    .optional()
    .describe("Optional piggy bank ID to link to a transfer."),
  piggy_bank_name: z
    .string()
    .optional()
    .describe("Optional piggy bank name to link to a transfer."),
  tags: z.array(z.string()).optional().describe("List of tags to attach."),
  notes: z.string().optional().describe("Optional notes for this split."),
  reconciled: z.boolean().optional().describe("Whether this split is reconciled."),
  external_id: z.string().optional().describe("Optional external reference ID."),
  external_url: z.string().url().optional().describe("Optional external URL."),
});

const updateSplitSchema = z.object({
  transaction_journal_id: z
    .string()
    .optional()
    .describe(
      "Required only when updating a multi-split transaction to identify which existing split to modify.",
    ),
  type: z.enum(["withdrawal", "deposit", "transfer"]).optional(),
  date: z
    .string()
    .regex(
      ISO_DATE_OR_DATETIME_REGEX,
      "Expected YYYY-MM-DD or ISO 8601 datetime",
    )
    .optional(),
  amount: z
    .union([z.string().min(1), z.number().positive()])
    .transform((val) => String(val))
    .optional(),
  description: z.string().min(1).optional(),
  source_id: z.string().nullable().optional(),
  source_name: z.string().nullable().optional(),
  destination_id: z.string().nullable().optional(),
  destination_name: z.string().nullable().optional(),
  currency_code: z.string().optional(),
  foreign_amount: z
    .union([z.string(), z.number().positive()])
    .transform((val) => String(val))
    .nullable()
    .optional(),
  foreign_currency_code: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  category_name: z.string().nullable().optional(),
  budget_id: z.string().nullable().optional(),
  budget_name: z.string().nullable().optional(),
  bill_id: z.string().nullable().optional(),
  bill_name: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
  reconciled: z.boolean().optional(),
  external_id: z.string().nullable().optional(),
  external_url: z.string().url().nullable().optional(),
});

export function registerTransactionTools(
  server: McpServer,
  client: FireflyClient,
): void {
  server.registerTool(
    "list_transactions",
    {
      title: "List Transactions",
      description:
        "List Firefly III transactions with optional date range ('start', 'end' in YYYY-MM-DD) and transaction type filter ('withdrawal', 'deposit', 'transfer', or 'all').",
      inputSchema: {
        start: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe("Start date inclusive (YYYY-MM-DD)."),
        end: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe("End date inclusive (YYYY-MM-DD)."),
        type: transactionTypeFilterSchema
          .optional()
          .default("all")
          .describe("Transaction type filter (defaults to 'all')."),
        page: z.number().int().positive().optional().describe("Page number (starts at 1)."),
        limit: z.number().int().min(1).max(200).optional().describe("Transactions per page."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ start, end, type, page, limit }) => {
      try {
        const res = await client.listTransactions({
          start,
          end,
          type,
          page,
          limit,
        });
        return jsonToolSuccess(formatTransactionList(res));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "get_transaction",
    {
      title: "Get Transaction Details",
      description:
        "Retrieve a single Firefly III transaction group and all of its journal splits by transaction ID.",
      inputSchema: {
        id: z.string().min(1).describe("The Firefly III transaction group ID."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id }) => {
      try {
        const res = await client.getTransaction(id);
        return jsonToolSuccess(formatTransaction(res.data));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "search_transactions",
    {
      title: "Search Transactions",
      description: [
        "Search Firefly III transactions using Firefly III's search query syntax.",
        "Multiple terms are combined with AND. Wrap multi-word values in quotes.",
        "Useful operators: type:withdrawal|deposit|transfer, date_after:YYYY-MM-DD, date_before:YYYY-MM-DD, date_is:YYYY-MM-DD,",
        "amount_is:N, amount_more:N, amount_less:N, source_is:\"Checking\", destination_is:\"Amazon\",",
        "category_is:\"Food\", budget_is:\"Groceries\", tag_is:\"trip\", description_contains:\"coffee\",",
        "notes_contain:\"reimburse\", has_any_category:false, reconciled:true. Prefix any filter with '-' to negate.",
      ].join(" "),
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Firefly III search query string, e.g. 'type:withdrawal category_is:\"Dining\" date_after:2026-11-01'.",
          ),
        page: z.number().int().positive().optional().describe("Page number."),
        limit: z.number().int().min(1).max(200).optional().describe("Results per page."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, page, limit }) => {
      try {
        const res = await client.searchTransactions({ query, page, limit });
        return jsonToolSuccess(formatTransactionList(res));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "create_transaction",
    {
      title: "Create Transaction",
      description: [
        "Record a new transaction (or multi-split transaction group) in Firefly III.",
        "- For an expense ('withdrawal'): specify your asset account via 'source_id' or 'source_name', and the merchant via 'destination_name' (or 'destination_id').",
        "- For income ('deposit'): specify the payer/revenue source via 'source_name' (or 'source_id'), and your asset account via 'destination_id' or 'destination_name'.",
        "- For a transfer ('transfer'): specify both 'source_id'/'source_name' and 'destination_id'/'destination_name' pointing to two of your own asset/liability accounts.",
      ].join("\n"),
      inputSchema: {
        transactions: z
          .array(createSplitSchema)
          .min(1)
          .describe(
            "One split for a standard transaction, or multiple splits (all sharing the same 'type') for a split transaction.",
          ),
        group_title: z
          .string()
          .optional()
          .describe(
            "Title for the transaction group (recommended when creating a multi-split transaction).",
          ),
        apply_rules: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether Firefly III automation rules should run on this transaction."),
        fire_webhooks: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether Firefly III webhooks should fire for this transaction."),
        error_if_duplicate_hash: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Set true to reject the transaction if an identical transaction hash already exists.",
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      transactions,
      group_title,
      apply_rules,
      fire_webhooks,
      error_if_duplicate_hash,
    }) => {
      try {
        for (const [idx, split] of transactions.entries()) {
          if (
            (split.type === "withdrawal" || split.type === "transfer") &&
            !split.source_id &&
            !split.source_name
          ) {
            throw new Error(
              `Split #${idx + 1} (${split.type}): either 'source_id' or 'source_name' is required.`,
            );
          }
          if (
            (split.type === "deposit" || split.type === "transfer") &&
            !split.destination_id &&
            !split.destination_name
          ) {
            throw new Error(
              `Split #${idx + 1} (${split.type}): either 'destination_id' or 'destination_name' is required.`,
            );
          }
          if (split.foreign_amount && !split.foreign_currency_code) {
            throw new Error(
              `Split #${idx + 1}: 'foreign_currency_code' is required when 'foreign_amount' is provided.`,
            );
          }
        }

        if (transactions.length > 1 && !group_title) {
          group_title = transactions[0]?.description ?? "Split transaction";
        }

        const res = await client.createTransaction({
          group_title,
          apply_rules,
          fire_webhooks,
          error_if_duplicate_hash,
          transactions,
        });
        return jsonToolSuccess(formatTransaction(res.data));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "update_transaction",
    {
      title: "Update Transaction",
      description:
        "Update an existing Firefly III transaction group by ID. When updating a multi-split transaction, pass 'transaction_journal_id' inside each split (retrieve them first with 'get_transaction').",
      inputSchema: {
        id: z.string().min(1).describe("The Firefly III transaction group ID to update."),
        group_title: z
          .string()
          .nullable()
          .optional()
          .describe("Updated group title (or null to clear)."),
        apply_rules: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to re-apply Firefly III rules."),
        fire_webhooks: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to trigger webhooks."),
        transactions: z
          .array(updateSplitSchema)
          .min(1)
          .optional()
          .describe("Updated split fields."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, group_title, apply_rules, fire_webhooks, transactions }) => {
      try {
        if (group_title === undefined && !transactions) {
          throw new Error(
            "Provide at least 'group_title' or 'transactions' to update.",
          );
        }

        const res = await client.updateTransaction(id, {
          group_title,
          apply_rules,
          fire_webhooks,
          transactions,
        });
        return jsonToolSuccess(formatTransaction(res.data));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "delete_transaction",
    {
      title: "Delete Transaction",
      description:
        "Permanently delete a Firefly III transaction group (and all of its splits) by transaction ID.",
      inputSchema: {
        id: z.string().min(1).describe("The Firefly III transaction group ID to delete."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id }) => {
      try {
        await client.deleteTransaction(id);
        return jsonToolSuccess({
          deleted: true,
          transaction_id: id,
        });
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );
}
