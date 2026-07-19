import { type RequestConfig, request } from "../request";
import type { RequestOptions, SendEmailParams, SendEmailResponse } from "../types";

/**
 * The `send` namespace on a {@link Kazuni} client, exposed as `kazuni.send`. Groups together
 * every "send a notification" method the API offers - today that's email, with SMS and
 * WhatsApp planned as the underlying API adds support for them.
 */
export class Send {
  #config: RequestConfig;

  /** @internal Constructed by {@link Kazuni} - not meant to be called directly. */
  constructor(config: RequestConfig) {
    this.#config = config;
  }

  /**
   * Sends a single transactional email.
   *
   * This makes a `POST /v1/emails/send` request. `from` must be on a domain you've verified
   * with Kazuni, and `to` accepts exactly one recipient per call.
   *
   * A resolved promise means the request was **accepted for delivery**, not that the email has
   * been delivered - see {@link SendEmailResponse.status}. Delivery outcomes (sent, bounced,
   * complained) arrive later via webhooks or status polling, not through this call.
   *
   * @param params The email to send - sender, recipient, subject, and body. See
   *   {@link SendEmailParams}.
   * @param options Per-request options. Pass `idempotencyKey` to make this call safe to retry
   *   on transient failures - see {@link RequestOptions.idempotencyKey} for exactly what that
   *   does and does not guarantee today. Without it, a failed send is never automatically
   *   retried, so it can never be silently sent twice by the SDK.
   * @returns The queued send's id and status.
   * @throws {KazuniError} On any non-2xx response (invalid API key, unverified domain,
   *   validation failure, rate limiting, server error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const result = await kazuni.send.email({
   *   from: "Acme <hello@acme.example>",
   *   to: "customer@example.com",
   *   subject: "Welcome to Acme",
   *   html: "<p>Thanks for signing up.</p>",
   *   text: "Thanks for signing up.",
   * });
   *
   * console.log(result.id, result.status); // "email_...", "queued"
   * ```
   *
   * @example With an idempotency key, so a retry on a transient failure is safe to attempt
   * ```ts
   * await kazuni.send.email(
   *   { from: "hello@acme.example", to: "customer@example.com", subject: "Hi", html: "<p>Hi</p>" },
   *   { idempotencyKey: `welcome-email-${userId}` },
   * );
   * ```
   */
  email(params: SendEmailParams, options?: RequestOptions): Promise<SendEmailResponse> {
    return request<SendEmailResponse>(this.#config, "POST", "/v1/emails/send", params, options);
  }
}
