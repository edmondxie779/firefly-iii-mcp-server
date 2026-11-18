import type { FireflyConfig } from "./config.js";
import type {
  AccountRead,
  AccountTypeFilter,
  FireflyListResponse,
  FireflySingleResponse,
  StoreAccountPayload,
  StoreTransactionPayload,
  SummaryBasicEntry,
  SystemAboutAttributes,
  TransactionRead,
  TransactionTypeFilter,
  UpdateAccountPayload,
  UpdateTransactionPayload,
  UserAttributes,
} from "./types.js";

export class FireflyApiError extends Error {
  public readonly status: number;
  public readonly apiMessage: string;
  public readonly validationErrors?: Record<string, string[]>;

  constructor(
    status: number,
    apiMessage: string,
    validationErrors?: Record<string, string[]>,
  ) {
    const details = validationErrors
      ? Object.entries(validationErrors)
          .map(([field, msgs]) => `${field}: ${msgs.join("; ")}`)
          .join(" | ")
      : "";
    const fullMessage = details
      ? `Firefly III API error (${status}): ${apiMessage} [${details}]`
      : `Firefly III API error (${status}): ${apiMessage}`;
    super(fullMessage);
    this.name = "FireflyApiError";
    this.status = status;
    this.apiMessage = apiMessage;
    this.validationErrors = validationErrors;
  }
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

export class FireflyClient {
  private readonly config: FireflyConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: FireflyConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.config.apiBaseUrl}${normalizedPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: {
      query?: QueryParams;
      body?: unknown;
    },
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const headers: Record<string, string> = {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${this.config.pat}`,
    };

    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to connect to Firefly III at ${this.config.baseUrl}: ${reason}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const rawText = await response.text();
    let parsed: unknown = undefined;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = undefined;
      }
    }

    if (!response.ok) {
      const errObj =
        parsed && typeof parsed === "object"
          ? (parsed as { message?: unknown; exception?: unknown; errors?: unknown })
          : undefined;
      const apiMessage =
        typeof errObj?.message === "string" && errObj.message.trim()
          ? errObj.message
          : response.statusText || `HTTP ${response.status}`;
      const validationErrors =
        errObj?.errors && typeof errObj.errors === "object" && !Array.isArray(errObj.errors)
          ? (errObj.errors as Record<string, string[]>)
          : undefined;

      throw new FireflyApiError(response.status, apiMessage, validationErrors);
    }

    return parsed as T;
  }

  // ==================== System & Summary ====================

  async getAbout(): Promise<FireflySingleResponse<SystemAboutAttributes>> {
    return this.request("GET", "/about");
  }

  async getCurrentUser(): Promise<
    FireflySingleResponse<{ type: string; id: string; attributes: UserAttributes }>
  > {
    return this.request("GET", "/about/user");
  }

  async getBasicSummary(params: {
    start: string;
    end: string;
    currency_code?: string;
  }): Promise<Record<string, SummaryBasicEntry> | SummaryBasicEntry[]> {
    return this.request("GET", "/summary/basic", { query: params });
  }

  // ==================== Accounts ====================

  async listAccounts(params?: {
    type?: AccountTypeFilter;
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<FireflyListResponse<AccountRead>> {
    return this.request("GET", "/accounts", { query: params });
  }

  async getAccount(
    id: string,
    params?: { date?: string },
  ): Promise<FireflySingleResponse<AccountRead>> {
    return this.request("GET", `/accounts/${encodeURIComponent(id)}`, {
      query: params,
    });
  }

  async searchAccounts(params: {
    query: string;
    field: "all" | "iban" | "name" | "number" | "id";
    type?: AccountTypeFilter;
    page?: number;
    limit?: number;
  }): Promise<FireflyListResponse<AccountRead>> {
    return this.request("GET", "/search/accounts", { query: params });
  }

  async createAccount(
    payload: StoreAccountPayload,
  ): Promise<FireflySingleResponse<AccountRead>> {
    return this.request("POST", "/accounts", { body: payload });
  }

  async updateAccount(
    id: string,
    payload: UpdateAccountPayload,
  ): Promise<FireflySingleResponse<AccountRead>> {
    return this.request("PUT", `/accounts/${encodeURIComponent(id)}`, {
      body: payload,
    });
  }

  async deleteAccount(id: string): Promise<void> {
    await this.request("DELETE", `/accounts/${encodeURIComponent(id)}`);
  }

  async listAccountTransactions(
    id: string,
    params?: {
      start?: string;
      end?: string;
      type?: TransactionTypeFilter;
      page?: number;
      limit?: number;
    },
  ): Promise<FireflyListResponse<TransactionRead>> {
    return this.request(
      "GET",
      `/accounts/${encodeURIComponent(id)}/transactions`,
      { query: params },
    );
  }

  // ==================== Transactions ====================

  async listTransactions(params?: {
    start?: string;
    end?: string;
    type?: TransactionTypeFilter;
    page?: number;
    limit?: number;
  }): Promise<FireflyListResponse<TransactionRead>> {
    return this.request("GET", "/transactions", { query: params });
  }

  async getTransaction(id: string): Promise<FireflySingleResponse<TransactionRead>> {
    return this.request("GET", `/transactions/${encodeURIComponent(id)}`);
  }

  async searchTransactions(params: {
    query: string;
    page?: number;
    limit?: number;
  }): Promise<FireflyListResponse<TransactionRead>> {
    return this.request("GET", "/search/transactions", { query: params });
  }

  async createTransaction(
    payload: StoreTransactionPayload,
  ): Promise<FireflySingleResponse<TransactionRead>> {
    return this.request("POST", "/transactions", { body: payload });
  }

  async updateTransaction(
    id: string,
    payload: UpdateTransactionPayload,
  ): Promise<FireflySingleResponse<TransactionRead>> {
    return this.request("PUT", `/transactions/${encodeURIComponent(id)}`, {
      body: payload,
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.request("DELETE", `/transactions/${encodeURIComponent(id)}`);
  }
}
