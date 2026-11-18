import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FireflyClient } from "../client.js";
import {
  formatAccount,
  formatAccountList,
  formatTransactionList,
  jsonToolError,
  jsonToolSuccess,
} from "../formatters.js";
import type { StoreAccountPayload, UpdateAccountPayload } from "../types.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const accountTypeFilterSchema = z.enum([
  "all",
  "asset",
  "cash",
  "expense",
  "revenue",
  "special",
  "hidden",
  "liability",
  "liabilities",
]);

const accountRoleSchema = z.enum([
  "defaultAsset",
  "sharedAsset",
  "savingAsset",
  "ccAsset",
  "cashWalletAsset",
]);

const liabilityTypeSchema = z.enum(["loan", "debt", "mortgage"]);
const liabilityDirectionSchema = z.enum(["credit", "debit"]);

export function registerAccountTools(server: McpServer, client: FireflyClient): void {
  server.registerTool(
    "list_accounts",
    {
      title: "List Accounts",
      description:
        "List Firefly III accounts and their balances. Filter by account type (e.g. 'asset' for bank/checking/savings/credit cards, 'expense' for merchants, 'revenue' for income sources, 'liability' for loans/debts).",
      inputSchema: {
        type: accountTypeFilterSchema
          .optional()
          .default("asset")
          .describe(
            "Account type filter. Defaults to 'asset' (your own bank/cash/card accounts). Use 'all' to return every account type.",
          ),
        date: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe(
            "Optional date (YYYY-MM-DD) on which to compute account balances. Defaults to today.",
          ),
        page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Page number for pagination (starts at 1)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum number of accounts per page."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ type, date, page, limit }) => {
      try {
        const res = await client.listAccounts({ type, date, page, limit });
        return jsonToolSuccess(formatAccountList(res));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "get_account",
    {
      title: "Get Account Details",
      description:
        "Get detailed attributes and current balance for a single Firefly III account by its ID.",
      inputSchema: {
        id: z.string().min(1).describe("The Firefly III account ID."),
        date: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe(
            "Optional date (YYYY-MM-DD) on which to compute the account balance.",
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, date }) => {
      try {
        const res = await client.getAccount(id, { date });
        return jsonToolSuccess(formatAccount(res.data));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "search_accounts",
    {
      title: "Search Accounts",
      description:
        "Search Firefly III accounts by name, account number, IBAN, or ID.",
      inputSchema: {
        query: z.string().min(1).describe("Search keyword or value."),
        field: z
          .enum(["all", "name", "iban", "number", "id"])
          .optional()
          .default("name")
          .describe("Which account field to match against (defaults to 'name')."),
        type: accountTypeFilterSchema
          .optional()
          .describe("Optional account type filter (e.g. 'asset', 'expense', 'revenue', 'liability')."),
        page: z.number().int().positive().optional().describe("Page number."),
        limit: z.number().int().min(1).max(200).optional().describe("Items per page."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, field, type, page, limit }) => {
      try {
        const res = await client.searchAccounts({
          query,
          field,
          type,
          page,
          limit,
        });
        return jsonToolSuccess(formatAccountList(res));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "create_account",
    {
      title: "Create Account",
      description:
        "Create a new account in Firefly III. For 'asset' accounts, 'account_role' defaults to 'defaultAsset' (if 'ccAsset', also pass 'credit_card_type' and 'monthly_payment_date'). For 'liability' accounts, 'liability_type' ('loan', 'debt', or 'mortgage') is required.",
      inputSchema: {
        name: z.string().min(1).describe("Account name (must be unique per account type)."),
        type: z
          .enum(["asset", "expense", "revenue", "liability", "cash"])
          .describe("Type of account to create."),
        currency_code: z
          .string()
          .optional()
          .describe("ISO 4217 currency code (e.g. CNY, USD, EUR). Defaults to Firefly III's primary currency."),
        account_role: accountRoleSchema
          .optional()
          .describe(
            "Role for 'asset' accounts only: 'defaultAsset', 'sharedAsset', 'savingAsset', 'ccAsset' (credit card), or 'cashWalletAsset'. Defaults to 'defaultAsset' when type='asset'.",
          ),
        opening_balance: z
          .string()
          .optional()
          .describe(
            "Initial opening balance as a decimal string (e.g. '1000.00'). Requires 'opening_balance_date' when set.",
          ),
        opening_balance_date: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe("Date of the opening balance (YYYY-MM-DD). Required if 'opening_balance' is provided."),
        virtual_balance: z
          .string()
          .optional()
          .describe("Virtual balance buffer as a decimal string (e.g. '0.00')."),
        iban: z.string().optional().describe("IBAN if applicable."),
        bic: z.string().optional().describe("BIC/SWIFT code if applicable."),
        account_number: z.string().optional().describe("Bank or card account number."),
        active: z.boolean().optional().default(true).describe("Whether the account is active."),
        include_net_worth: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to include this account in net worth calculations."),
        credit_card_type: z
          .enum(["monthlyFull"])
          .optional()
          .describe("Required when account_role='ccAsset'. Currently Firefly III supports 'monthlyFull'."),
        monthly_payment_date: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe("Required when account_role='ccAsset' (YYYY-MM-DD)."),
        liability_type: liabilityTypeSchema
          .optional()
          .describe("Required when type='liability': 'loan', 'debt', or 'mortgage'."),
        liability_direction: liabilityDirectionSchema
          .optional()
          .describe("Direction when type='liability': 'debit' (you owe money) or 'credit' (you are owed money)."),
        interest: z
          .string()
          .optional()
          .describe("Interest rate percentage for liabilities (e.g. '4.25')."),
        interest_period: z
          .enum(["weekly", "monthly", "quarterly", "half-year", "yearly"])
          .optional()
          .describe("Interest period for liabilities."),
        notes: z.string().optional().describe("Optional Markdown notes for the account."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        if (input.opening_balance !== undefined && !input.opening_balance_date) {
          throw new Error(
            "'opening_balance_date' (YYYY-MM-DD) is required when 'opening_balance' is specified.",
          );
        }

        if (input.type === "liability" && !input.liability_type) {
          throw new Error(
            "'liability_type' ('loan', 'debt', or 'mortgage') is required when creating a 'liability' account.",
          );
        }

        const effectiveRole =
          input.type === "asset" ? (input.account_role ?? "defaultAsset") : undefined;

        if (effectiveRole === "ccAsset") {
          if (!input.credit_card_type || !input.monthly_payment_date) {
            throw new Error(
              "When 'account_role' is 'ccAsset', both 'credit_card_type' ('monthlyFull') and 'monthly_payment_date' (YYYY-MM-DD) are required.",
            );
          }
        }

        const payload: StoreAccountPayload = {
          name: input.name,
          type: input.type,
          currency_code: input.currency_code,
          iban: input.iban,
          bic: input.bic,
          account_number: input.account_number,
          opening_balance: input.opening_balance,
          opening_balance_date: input.opening_balance_date,
          virtual_balance: input.virtual_balance,
          active: input.active,
          include_net_worth: input.include_net_worth,
          notes: input.notes,
          ...(input.type === "asset"
            ? {
                account_role: effectiveRole,
                credit_card_type: input.credit_card_type,
                monthly_payment_date: input.monthly_payment_date,
              }
            : {}),
          ...(input.type === "liability"
            ? {
                liability_type: input.liability_type,
                liability_direction: input.liability_direction ?? "debit",
                interest: input.interest ?? "0",
                interest_period: input.interest_period ?? "monthly",
              }
            : {}),
        };

        const res = await client.createAccount(payload);
        return jsonToolSuccess(formatAccount(res.data));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "update_account",
    {
      title: "Update Account",
      description:
        "Update an existing Firefly III account by ID. Only fields you pass will be modified (if 'name' is omitted, the existing account name is preserved automatically).",
      inputSchema: {
        id: z.string().min(1).describe("The Firefly III account ID to update."),
        name: z.string().min(1).optional().describe("New account name."),
        currency_code: z.string().optional().describe("ISO 4217 currency code."),
        account_role: accountRoleSchema.optional().describe("Account role (for asset accounts)."),
        opening_balance: z.string().optional().describe("Updated opening balance."),
        opening_balance_date: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe("Updated opening balance date (YYYY-MM-DD)."),
        virtual_balance: z.string().optional().describe("Updated virtual balance."),
        iban: z.string().nullable().optional().describe("Updated IBAN (or null to clear)."),
        bic: z.string().nullable().optional().describe("Updated BIC (or null to clear)."),
        account_number: z
          .string()
          .nullable()
          .optional()
          .describe("Updated account number (or null to clear)."),
        active: z.boolean().optional().describe("Whether the account is active."),
        include_net_worth: z
          .boolean()
          .optional()
          .describe("Whether to include in net worth."),
        credit_card_type: z.enum(["monthlyFull"]).nullable().optional(),
        monthly_payment_date: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .nullable()
          .optional(),
        liability_type: liabilityTypeSchema.nullable().optional(),
        interest: z.string().nullable().optional(),
        interest_period: z
          .enum(["weekly", "monthly", "quarterly", "half-year", "yearly"])
          .nullable()
          .optional(),
        notes: z.string().nullable().optional().describe("Updated notes (or null to clear)."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, name, ...rest }) => {
      try {
        let effectiveName = name;
        if (!effectiveName) {
          const existing = await client.getAccount(id);
          effectiveName = existing.data.attributes.name;
        }

        const payload: UpdateAccountPayload = {
          name: effectiveName,
          ...rest,
        };

        const res = await client.updateAccount(id, payload);
        return jsonToolSuccess(formatAccount(res.data));
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "delete_account",
    {
      title: "Delete Account",
      description:
        "Permanently delete a Firefly III account by ID. Warning: deleting an account may also affect or delete transactions exclusively linked to it.",
      inputSchema: {
        id: z.string().min(1).describe("The Firefly III account ID to delete."),
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
        await client.deleteAccount(id);
        return jsonToolSuccess({
          deleted: true,
          account_id: id,
        });
      } catch (error) {
        return jsonToolError(error);
      }
    },
  );

  server.registerTool(
    "list_account_transactions",
    {
      title: "List Account Transactions",
      description:
        "List transactions associated with a specific Firefly III account ID, optionally filtered by date range and transaction type.",
      inputSchema: {
        account_id: z.string().min(1).describe("The Firefly III account ID."),
        start: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe("Start date (YYYY-MM-DD)."),
        end: z
          .string()
          .regex(DATE_REGEX, "Expected YYYY-MM-DD")
          .optional()
          .describe("End date (YYYY-MM-DD)."),
        type: z
          .enum([
            "all",
            "withdrawal",
            "withdrawals",
            "expense",
            "deposit",
            "deposits",
            "income",
            "transfer",
            "transfers",
          ])
          .optional()
          .describe("Optional transaction type filter."),
        page: z.number().int().positive().optional().describe("Page number."),
        limit: z.number().int().min(1).max(200).optional().describe("Items per page."),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ account_id, start, end, type, page, limit }) => {
      try {
        const res = await client.listAccountTransactions(account_id, {
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
}
