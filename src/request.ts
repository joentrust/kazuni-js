import { KazuniError } from "./errors";
import type { RequestOptions } from "./types";

/** Default value of {@link KazuniOptions.baseUrl} when none is given. */
export const DEFAULT_BASE_URL = "https://api.kazuni.io";
/** Default value of {@link KazuniOptions.timeout} in milliseconds, when none is given. */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** Default value of {@link KazuniOptions.maxRetries} when none is given. */
export const DEFAULT_MAX_RETRIES = 2;

const BASE_BACKOFF_MS = 250;

/**
 * Resolved, internal request configuration for a {@link Kazuni} client - the fully-defaulted
 * form of {@link KazuniOptions}. Not part of the public API; shared internally between
 * {@link Kazuni} and its resource namespaces (e.g. {@link Send}).
 */
export interface RequestConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const base = BASE_BACKOFF_MS * 2 ** attempt;
  return base + Math.random() * base;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;

  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());

  return undefined;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const requestId = response.headers.get("x-request-id") ?? undefined;

  let payload: unknown;
  const text = await response.text();
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch (cause) {
      if (!response.ok) {
        throw new KazuniError(`Request failed with status ${response.status}`, {
          status: response.status,
          requestId,
          cause,
        });
      }
      throw new KazuniError("Failed to parse API response as JSON", {
        status: response.status,
        requestId,
        cause,
      });
    }
  }

  if (!response.ok) {
    const errorPayload = payload as { error?: string; code?: string } | undefined;
    throw new KazuniError(errorPayload?.error ?? `Request failed with status ${response.status}`, {
      status: response.status,
      code: errorPayload?.code,
      requestId,
    });
  }

  return payload as T;
}

/**
 * Internal transport used by every resource method to call the Kazuni API: builds the request,
 * applies the retry/backoff policy, and maps the response to `T` or throws a
 * {@link KazuniError}. Not part of the public API.
 */
export async function request<T>(
  config: RequestConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const retryable = method === "GET" || Boolean(options?.idempotencyKey);

  let attempt = 0;

  for (;;) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    };
    if (options?.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timer);
      if (retryable && attempt < config.maxRetries) {
        await delay(backoffMs(attempt));
        attempt += 1;
        continue;
      }
      const message =
        cause instanceof Error && cause.name === "AbortError"
          ? "Request timed out"
          : "Network request failed";
      throw new KazuniError(message, { cause });
    }
    clearTimeout(timer);

    if (
      (response.status === 429 || response.status >= 500) &&
      retryable &&
      attempt < config.maxRetries
    ) {
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      await delay(retryAfter ?? backoffMs(attempt));
      attempt += 1;
      continue;
    }

    return parseResponse<T>(response);
  }
}
