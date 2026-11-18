export interface MetaPagination {
  total: number;
  count: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface FireflySingleResponse<T> {
  data: T;
}

export interface FireflyListResponse<T> {
  data: T[];
  meta?: {
    pagination?: MetaPagination;
  };
  links?: {
    self?: string;
    first?: string;
    next?: string | null;
    prev?: string | null;
    last?: string;
  };
}

export type AccountTypeFilter =
  | "all"
  | "asset"
  | "cash"
  | "expense"
  | "revenue"
  | "special"
  | "hidden"
  | "liability"
  | "liabilities";

export type ShortAccountType = "asset" | "expense" | "revenue" | "liability" | "cash";

export type AccountRole =
  | "defaultAsset"
  | "sharedAsset"
  | "savingAsset"
  | "ccAsset"
  | "cashWalletAsset";

export type CreditCardType = "monthlyFull";

export type LiabilityType = "loan" | "debt" | "mortgage";

export type LiabilityDirection = "credit" | "debit";

export interface AccountAttributes {
  created_at?: string;
  updated_at?: string;
  active: boolean;
  order?: number | null;
  name: string;
  type: string;
  account_role?: string | null;
  currency_id?: string;
  currency_code?: string;
  currency_symbol?: string;
  currency_decimal_places?: number;
  current_balance?: string;
  current_balance_date?: string;
  current_debt?: string | null;
  iban?: string | null;
  bic?: string | null;
  account_number?: string | null;
  opening_balance?: string;
  opening_balance_date?: string | null;
  virtual_balance?: string;
  include_net_worth?: boolean;
  credit_card_type?: string | null;
  monthly_payment_date?: string | null;
  liability_type?: string | null;
  liability_direction?: string | null;
  interest?: string | null;
  interest_period?: string | null;
  notes?: string | null;
}

export interface AccountRead {
  type: string;
  id: string;
  attributes: AccountAttributes;
}

export interface StoreAccountPayload {
  name: string;
  type: ShortAccountType;
  iban?: string | null;
  bic?: string | null;
  account_number?: string | null;
  opening_balance?: string;
  opening_balance_date?: string | null;
  virtual_balance?: string;
  currency_id?: string;
  currency_code?: string;
  active?: boolean;
  order?: number;
  include_net_worth?: boolean;
  account_role?: AccountRole | null;
  credit_card_type?: CreditCardType | null;
  monthly_payment_date?: string | null;
  liability_type?: LiabilityType | null;
  liability_direction?: LiabilityDirection | null;
  interest?: string | null;
  interest_period?: "weekly" | "monthly" | "quarterly" | "half-year" | "yearly" | null;
  notes?: string | null;
}

export interface UpdateAccountPayload {
  name: string;
  iban?: string | null;
  bic?: string | null;
  account_number?: string | null;
  opening_balance?: string;
  opening_balance_date?: string | null;
  virtual_balance?: string;
  currency_id?: string;
  currency_code?: string;
  active?: boolean;
  order?: number;
  include_net_worth?: boolean;
  account_role?: AccountRole | null;
  credit_card_type?: CreditCardType | null;
  monthly_payment_date?: string | null;
  liability_type?: LiabilityType | null;
  interest?: string | null;
  interest_period?: "weekly" | "monthly" | "quarterly" | "half-year" | "yearly" | null;
  notes?: string | null;
}

export type TransactionTypeFilter =
  | "all"
  | "withdrawal"
  | "withdrawals"
  | "expense"
  | "deposit"
  | "deposits"
  | "income"
  | "transfer"
  | "transfers";

export type TransactionSplitType = "withdrawal" | "deposit" | "transfer";

export interface TransactionSplit {
  user?: string;
  transaction_journal_id?: string;
  type: string;
  date: string;
  order?: number | null;
  currency_id?: string;
  currency_code?: string;
  currency_symbol?: string;
  currency_name?: string;
  currency_decimal_places?: number;
  foreign_currency_id?: string | null;
  foreign_currency_code?: string | null;
  foreign_currency_symbol?: string | null;
  foreign_currency_decimal_places?: number | null;
  amount: string;
  foreign_amount?: string | null;
  description: string;
  source_id?: string | null;
  source_name?: string | null;
  source_iban?: string | null;
  source_type?: string | null;
  destination_id?: string | null;
  destination_name?: string | null;
  destination_iban?: string | null;
  destination_type?: string | null;
  budget_id?: string | null;
  budget_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  bill_id?: string | null;
  bill_name?: string | null;
  reconciled?: boolean;
  notes?: string | null;
  tags?: string[] | null;
  internal_reference?: string | null;
  external_id?: string | null;
  external_url?: string | null;
}

export interface TransactionGroupAttributes {
  created_at?: string;
  updated_at?: string;
  user?: string;
  group_title?: string | null;
  transactions: TransactionSplit[];
}

export interface TransactionRead {
  type: string;
  id: string;
  attributes: TransactionGroupAttributes;
}

export interface StoreTransactionSplitPayload {
  type: TransactionSplitType;
  date: string;
  amount: string;
  description: string;
  order?: number;
  currency_id?: string;
  currency_code?: string;
  foreign_amount?: string | null;
  foreign_currency_id?: string | null;
  foreign_currency_code?: string | null;
  budget_id?: string | null;
  budget_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  source_id?: string | null;
  source_name?: string | null;
  destination_id?: string | null;
  destination_name?: string | null;
  reconciled?: boolean;
  piggy_bank_id?: number | null;
  piggy_bank_name?: string | null;
  bill_id?: string | null;
  bill_name?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  internal_reference?: string | null;
  external_id?: string | null;
  external_url?: string | null;
}

export interface StoreTransactionPayload {
  error_if_duplicate_hash?: boolean;
  apply_rules?: boolean;
  fire_webhooks?: boolean;
  group_title?: string | null;
  transactions: StoreTransactionSplitPayload[];
}

export interface UpdateTransactionSplitPayload {
  transaction_journal_id?: string;
  type?: TransactionSplitType;
  date?: string;
  amount?: string;
  description?: string;
  order?: number;
  currency_id?: string;
  currency_code?: string;
  foreign_amount?: string | null;
  foreign_currency_id?: string | null;
  foreign_currency_code?: string | null;
  budget_id?: string | null;
  budget_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  source_id?: string | null;
  source_name?: string | null;
  destination_id?: string | null;
  destination_name?: string | null;
  reconciled?: boolean;
  bill_id?: string | null;
  bill_name?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  internal_reference?: string | null;
  external_id?: string | null;
  external_url?: string | null;
}

export interface UpdateTransactionPayload {
  apply_rules?: boolean;
  fire_webhooks?: boolean;
  group_title?: string | null;
  transactions?: UpdateTransactionSplitPayload[];
}

export interface SystemAboutAttributes {
  version: string;
  api_version: string;
  php_version?: string;
  os?: string;
  driver?: string;
}

export interface UserAttributes {
  created_at?: string;
  updated_at?: string;
  email: string;
  blocked?: boolean;
  role?: string | null;
}

export interface SummaryBasicEntry {
  key?: string;
  title?: string;
  monetary_value?: number | string;
  currency_id?: string;
  currency_code?: string;
  currency_symbol?: string;
  currency_decimal_places?: number;
  value_parsed?: string;
  local_icon?: string;
  sub_title?: string;
}
