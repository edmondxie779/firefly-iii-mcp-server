import type {
  AccountRead,
  FireflyListResponse,
  MetaPagination,
  TransactionRead,
  TransactionSplit,
} from "./types.js";

/**
 * Strip keys whose value is undefined, null, or empty string/array to keep MCP tool output compact.
 */
function compactObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    result[key] = value;
  }
  return result as Partial<T>;
}

export function formatAccount(account: AccountRead): Record<string, unknown> {
  const a = account.attributes;
  return compactObject({
    id: account.id,
    name: a.name,
    type: a.type,
    account_role: a.account_role,
    active: a.active,
    currency_code: a.currency_code,
    currency_symbol: a.currency_symbol,
    current_balance: a.current_balance,
    current_balance_date: a.current_balance_date,
    current_debt: a.current_debt,
    virtual_balance:
      a.virtual_balance && Number(a.virtual_balance) !== 0
        ? a.virtual_balance
        : undefined,
    include_net_worth: a.include_net_worth,
    iban: a.iban,
    account_number: a.account_number,
    liability_type: a.liability_type,
    liability_direction: a.liability_direction,
    credit_card_type: a.credit_card_type,
    monthly_payment_date: a.monthly_payment_date,
    notes: a.notes,
  });
}

export function formatAccountList(
  response: FireflyListResponse<AccountRead>,
): {
  accounts: Record<string, unknown>[];
  pagination?: MetaPagination;
} {
  return {
    accounts: response.data.map(formatAccount),
    ...(response.meta?.pagination ? { pagination: response.meta.pagination } : {}),
  };
}

function formatSplit(split: TransactionSplit): Record<string, unknown> {
  return compactObject({
    transaction_journal_id: split.transaction_journal_id,
    type: split.type,
    date: split.date,
    description: split.description,
    amount: split.amount,
    currency_code: split.currency_code,
    currency_symbol: split.currency_symbol,
    foreign_amount: split.foreign_amount,
    foreign_currency_code: split.foreign_currency_code,
    source_id: split.source_id,
    source_name: split.source_name,
    source_type: split.source_type,
    destination_id: split.destination_id,
    destination_name: split.destination_name,
    destination_type: split.destination_type,
    category_id: split.category_id,
    category_name: split.category_name,
    budget_id: split.budget_id,
    budget_name: split.budget_name,
    bill_id: split.bill_id,
    bill_name: split.bill_name,
    tags: split.tags,
    notes: split.notes,
    reconciled: split.reconciled ? true : undefined,
    external_id: split.external_id,
  });
}

export function formatTransaction(tx: TransactionRead): Record<string, unknown> {
  const attr = tx.attributes;
  return compactObject({
    id: tx.id,
    group_title: attr.group_title,
    created_at: attr.created_at,
    updated_at: attr.updated_at,
    splits: attr.transactions.map(formatSplit),
  });
}

export function formatTransactionList(
  response: FireflyListResponse<TransactionRead>,
): {
  transactions: Record<string, unknown>[];
  pagination?: MetaPagination;
} {
  return {
    transactions: response.data.map(formatTransaction),
    ...(response.meta?.pagination ? { pagination: response.meta.pagination } : {}),
  };
}

export function jsonToolSuccess(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function jsonToolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
  };
}
