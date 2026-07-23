import {
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  type RequestConfig,
  request,
} from "./request";
import { Contacts } from "./resources/contacts";
import { Messages } from "./resources/messages";
import { Send } from "./resources/send";
import type { KazuniConstructorArg, MeResponse } from "./types";

/**
 * The Kazuni API client. Construct one instance per API key and reuse it across requests.
 *
 * @example
 * ```ts
 * import { Kazuni } from "@kazuni/sdk";
 *
 * const kazuni = new Kazuni(process.env.KAZUNI_API_KEY!);
 *
 * const result = await kazuni.send.email({
 *   from: "Acme <hello@acme.example>",
 *   to: "customer@example.com",
 *   subject: "Welcome to Acme",
 *   html: "<p>Thanks for signing up.</p>",
 * });
 *
 * console.log(result.id, result.status); // "email_...", "queued"
 * ```
 */
export class Kazuni {
  /** Email-sending methods. See {@link Send.email}. */
  readonly send: Send;

  /** Message status lookups. See {@link Messages.get}. */
  readonly messages: Messages;

  /** Contact management - create, look up, update, and manage identifiers/subscriptions. See {@link Contacts}. */
  readonly contacts: Contacts;

  #config: RequestConfig;

  /**
   * Creates a Kazuni client.
   *
   * @param arg Either a bare API key string (shorthand for `{ apiKey: arg }`), or a full
   *   {@link KazuniOptions} object for setting `baseUrl`, `timeout`, or `maxRetries` alongside
   *   the API key.
   * @throws {Error} If no non-empty `apiKey` is provided.
   *
   * @example String form
   * ```ts
   * const kazuni = new Kazuni(process.env.KAZUNI_API_KEY!);
   * ```
   *
   * @example Options form
   * ```ts
   * const kazuni = new Kazuni({
   *   apiKey: process.env.KAZUNI_API_KEY!,
   *   baseUrl: "http://localhost:8000", // point at a local dev API
   *   timeout: 10_000,
   *   maxRetries: 3,
   * });
   * ```
   */
  constructor(arg: KazuniConstructorArg) {
    const options = typeof arg === "string" ? { apiKey: arg } : arg;

    if (!options.apiKey) {
      throw new Error("Kazuni: apiKey is required");
    }

    this.#config = {
      apiKey: options.apiKey,
      baseUrl: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    };

    this.send = new Send(this.#config);
    this.messages = new Messages(this.#config);
    this.contacts = new Contacts(this.#config);
  }

  /**
   * Retrieves the organization and permissions attached to the API key in use.
   *
   * This makes a `GET /v1/me` request. Useful for confirming which organization and mode
   * (`live`/`test`) a key belongs to, and which permissions it carries, without hardcoding that
   * knowledge alongside the key itself.
   *
   * This is a `GET` request, so it is retry-eligible by default - no `idempotencyKey` is needed
   * or accepted, unlike {@link Send.email}. Reading key metadata has no side effects, so
   * retrying it on a transient failure is always safe.
   *
   * @returns The organization id, mode, and permissions for the API key in use. See
   *   {@link MeResponse}.
   * @throws {KazuniError} On any non-2xx response (invalid API key, rate limiting, server error)
   *   or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const me = await kazuni.me();
   * console.log(me.organizationId, me.mode, me.permissions.send);
   * ```
   */
  me(): Promise<MeResponse> {
    return request<MeResponse>(this.#config, "GET", "/v1/me");
  }
}
