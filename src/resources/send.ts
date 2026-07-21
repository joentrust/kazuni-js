import { type RequestConfig, request } from "../request";
import type {
  RequestOptions,
  SendEmailParams,
  SendEmailResponse,
  SendMessageResponse,
  SendSmsParams,
} from "../types";

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

  /**
   * Sends a single SMS.
   *
   * This makes a `POST /v1/messages/send` request with `channel: "sms"`. SMS must be enabled
   * for your organization, and your API key must carry the `sendSms` permission - either
   * missing and the call rejects with a {@link KazuniError} `status: 403` whose `code`
   * distinguishes the two (`channel_not_enabled` vs `permission_required`).
   *
   * As with {@link Send.email}, a resolved promise means the send was **accepted**, not
   * delivered - see {@link SendMessageResponse.status}. Because an SMS send is not idempotent,
   * the SDK never auto-retries it unless you pass an `idempotencyKey`.
   *
   * @param params The SMS to send - sender ID, recipient, and text. See {@link SendSmsParams}.
   * @param options Per-request options; pass `idempotencyKey` to make a retry safe. See
   *   {@link RequestOptions.idempotencyKey}.
   * @returns The queued send's id, channel, and status - plus an optional `warning` when the
   *   send was accepted with a caveat (e.g. an unconfirmed sender ID).
   * @throws {KazuniError} On any non-2xx response (channel not enabled, missing permission,
   *   invalid recipient, unverified sender ID, rate limiting, server error) or a network failure.
   *
   * @example
   * ```ts
   * const result = await kazuni.send.sms({
   *   from: "Kazuni",
   *   to: "+265991234567",
   *   text: "Your code is 4821.",
   * });
   * console.log(result.id, result.channel, result.status); // "msg_...", "sms", "queued"
   * ```
   */
  sms(params: SendSmsParams, options?: RequestOptions): Promise<SendMessageResponse> {
    return request<SendMessageResponse>(
      this.#config,
      "POST",
      "/v1/messages/send",
      { channel: "sms", ...params },
      options,
    );
  }
}
