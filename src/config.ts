export interface FireflyConfig {
  /** Base URL of the Firefly III instance without trailing slash (e.g. https://firefly.example.com) */
  baseUrl: string;
  /** Full API v1 base URL (e.g. https://firefly.example.com/api/v1) */
  apiBaseUrl: string;
  /** Personal Access Token (OAuth2 Bearer token) */
  pat: string;
  /** HTTP request timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Normalize a user-supplied Firefly III URL into `{ baseUrl, apiBaseUrl }`.
 * Handles trailing slashes as well as URLs that already end with `/api/v1` or `/api`.
 */
export function normalizeFireflyUrl(rawUrl: string): { baseUrl: string; apiBaseUrl: string } {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("FIREFLY_III_URL cannot be empty.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid FIREFLY_III_URL "${rawUrl}". Expected a full http:// or https:// URL (e.g. https://firefly.example.com).`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Unsupported protocol "${parsed.protocol}" in FIREFLY_III_URL. Expected http: or https:.`,
    );
  }

  let baseUrl = trimmed;
  if (baseUrl.endsWith("/api/v1")) {
    baseUrl = baseUrl.slice(0, -"/api/v1".length);
  } else if (baseUrl.endsWith("/api")) {
    baseUrl = baseUrl.slice(0, -"/api".length);
  }

  return {
    baseUrl,
    apiBaseUrl: `${baseUrl}/api/v1`,
  };
}

/**
 * Load Firefly III configuration from environment variables.
 */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): FireflyConfig {
  const rawUrl = env.FIREFLY_III_URL ?? env.FIREFLY_BASE_URL ?? "";
  const pat = (env.FIREFLY_III_PAT ?? env.FIREFLY_III_TOKEN ?? "").trim();

  if (!rawUrl.trim()) {
    throw new Error(
      "Missing environment variable FIREFLY_III_URL. Set it to your Firefly III instance URL (e.g. https://firefly.example.com).",
    );
  }

  if (!pat) {
    throw new Error(
      "Missing environment variable FIREFLY_III_PAT. Generate a Personal Access Token in Firefly III under Options -> Profile -> OAuth -> Personal Access Tokens.",
    );
  }

  const { baseUrl, apiBaseUrl } = normalizeFireflyUrl(rawUrl);

  const rawTimeout = env.FIREFLY_III_TIMEOUT_MS;
  let timeoutMs = 30_000;
  if (rawTimeout !== undefined && rawTimeout.trim() !== "") {
    const parsedTimeout = Number(rawTimeout);
    if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
      throw new Error(
        `Invalid FIREFLY_III_TIMEOUT_MS "${rawTimeout}". Expected a positive number of milliseconds.`,
      );
    }
    timeoutMs = parsedTimeout;
  }

  return {
    baseUrl,
    apiBaseUrl,
    pat,
    timeoutMs,
  };
}
