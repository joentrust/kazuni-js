import {
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  type RequestConfig,
} from "./request";
import { Send } from "./resources/send";
import type { KazuniConstructorArg } from "./types";

/**
 * The Kazuni API client. Construct one instance per API key and reuse it across requests.
 *
 * @example
 * ```ts
 * import { Kazuni } from "kazuni";
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
  }
}
