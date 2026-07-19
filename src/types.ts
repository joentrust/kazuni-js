/**
 * Options accepted by `new Kazuni({ ... })`.
 *
 * All fields other than {@link KazuniOptions.apiKey} are optional and fall back to sensible
 * defaults - see the field-level docs below for the exact default values.
 */
export interface KazuniOptions {
  /**
   * Your Kazuni API key, obtained from the API Keys page of the Kazuni dashboard. Required.
   *
   * Sent as `Authorization: Bearer <apiKey>` on every request. Keys are prefixed by mode
   * (`cl_live_...` or `cl_test_...`) - use a `cl_test_...` key for local development against a
   * self-hosted API, and never commit a `cl_live_...` key to source control.
   */
  apiKey: string;

  /**
   * The base URL of the Kazuni API.
   *
   * Defaults to the production API (`https://api.kazuni.io`). Override this to point the SDK
   * at a local or self-hosted API server, e.g. `http://localhost:8000` when running the
   * Kazuni platform's dev stack. A trailing slash is stripped automatically.
   */
  baseUrl?: string;

  /**
   * Per-request timeout, in milliseconds. A request that has not completed within this window
   * is aborted and rejects with a {@link KazuniError} whose message is `"Request timed out"`.
   *
   * Defaults to `30_000` (30 seconds).
   */
  timeout?: number;

  /**
   * How many times to retry a failed request before giving up.
   *
   * Retries happen on network failures and on `429` (rate limited) or `5xx` (server error)
   * responses, using exponential backoff with jitter and honoring the `Retry-After` header
   * when the API sends one. `GET` requests are always retry-eligible. `POST` requests (such as
   * `send.email`) are retried only when the caller supplies an `idempotencyKey` in
   * {@link RequestOptions} - see {@link RequestOptions.idempotencyKey} for why.
   *
   * Defaults to `2`, meaning up to 3 total attempts (the initial attempt plus 2 retries).
   */
  maxRetries?: number;
}

/**
 * The argument accepted by the {@link Kazuni} constructor: either a bare API key string
 * (shorthand for `{ apiKey }`), or a full {@link KazuniOptions} object.
 */
export type KazuniConstructorArg = string | KazuniOptions;

/**
 * Per-request options, passed as the last argument to resource methods such as
 * `send.email`.
 */
export interface RequestOptions {
  /**
   * An opaque key that scopes retries for this specific request and, once the API supports it,
   * will let the server deduplicate repeated deliveries of the same logical request.
   *
   * Supplying this key is what makes a `POST` request retry-eligible at all: by default the
   * SDK never automatically retries a `POST`, precisely because retrying a write blindly could
   * send the same email twice. Only when you pass `idempotencyKey` does the SDK treat retries
   * on that request as safe to attempt - so an unattended `POST` never turns into a silent
   * double-send.
   *
   * Forward-looking: the SDK does send this value today as an `Idempotency-Key` header, but
   * the Kazuni API does not yet use it to deduplicate requests server-side. In practice this
   * means retries today are safe for the common failure modes that indicate the original
   * request was not processed (rate limiting, timeouts before a response was received), but
   * true request-level dedup guarantees against a request that *did* reach the server will
   * land once the API honors this header - passing an `idempotencyKey` costs nothing and
   * future-proofs your call for when it does.
   *
   * Use a value that is unique per logical send and stable across retries of that same send,
   * e.g. `` `welcome-email-${userId}` ``.
   */
  idempotencyKey?: string;
}

/**
 * Parameters for sending a single transactional email via {@link Send.email}.
 */
export interface SendEmailParams {
  /**
   * The sender address, either a bare email (`hello@acme.example`) or a display name plus
   * email (`Acme <hello@acme.example>`). The domain must be verified for your organization in
   * the Kazuni dashboard before you can send from it.
   */
  from: string;

  /** The recipient's email address. Only a single recipient is supported per request. */
  to: string;

  /** The email subject line. */
  subject: string;

  /** The HTML body of the email. */
  html: string;

  /**
   * An optional plain-text fallback body, for clients that don't render HTML. When omitted,
   * recipients without HTML rendering see no fallback content.
   */
  text?: string;
}

/**
 * The response returned by {@link Send.email} after a successful send request.
 */
export interface SendEmailResponse {
  /** The unique identifier assigned to this send, for use with status lookups and support. */
  id: string;

  /**
   * The current status of the send. Today this is always `"queued"`.
   *
   * `"queued"` means the request was accepted for delivery - it does **not** mean the email
   * has been delivered, or even that delivery has started. Actual delivery outcomes (sent,
   * bounced, complained, etc.) arrive asynchronously via webhooks or a future status-polling
   * endpoint, not as part of this response. Treat a `"queued"` result as "Kazuni accepted the
   * job," not as a delivery receipt.
   */
  status: "queued";
}
