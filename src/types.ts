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

/**
 * The delivery status of a message, at whatever point in its lifecycle it was last observed.
 * Returned by {@link Messages.get} - see that method for how to fetch the current value for a
 * given message.
 *
 * - `"queued"` - accepted for delivery, not yet handed to the sending provider.
 * - `"sending"` - handed to the sending provider, awaiting a delivery outcome.
 * - `"sent"` - accepted by the sending provider for delivery to the recipient's mail server.
 *   Not the same as `"delivered"` - the receiving mail server has not yet confirmed acceptance.
 * - `"delivered"` - confirmed delivered to the recipient's mail server.
 * - `"bounced"` - the recipient's mail server permanently rejected the message.
 * - `"complained"` - the recipient marked the message as spam.
 * - `"rejected"` - rejected before delivery could be attempted.
 * - `"failed"` - the send attempt failed for a reason other than a bounce, complaint, or
 *   rejection.
 */
export type MessageStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "rejected"
  | "failed";

/**
 * The response returned by {@link Messages.get} for a single message.
 */
export interface GetMessageResponse {
  /** The message's unique identifier, as returned by {@link Send.email} (`SendEmailResponse.id`). */
  id: string;

  /** The sender address the message was sent from. */
  from: string;

  /** The recipient address the message was sent to. */
  to: string;

  /** The email subject line. */
  subject: string;

  /** The message's current delivery status. See {@link MessageStatus} for what each value means. */
  status: MessageStatus;

  /**
   * A human-readable description of what went wrong, populated when delivery failed outright.
   * `null` whenever there is nothing to report, which is most of the time.
   */
  error: string | null;

  /** When the message was accepted for delivery, as an ISO 8601 timestamp. */
  queuedAt: string;

  /**
   * When the message was handed to the sending provider, as an ISO 8601 timestamp. `null` until
   * that happens - which includes the entire time a message spends in `"queued"`.
   */
  sentAt: string | null;

  /**
   * When the recipient's mail server confirmed delivery, as an ISO 8601 timestamp. `null` until
   * that happens, and permanently `null` for messages that never reach `"delivered"` (e.g.
   * `"bounced"` or `"failed"`).
   */
  deliveredAt: string | null;
}

/**
 * The permissions granted to an API key, as returned in {@link MeResponse.permissions} by
 * {@link Kazuni.me}.
 */
export interface ApiKeyPermissions {
  /** Whether this key can send email via {@link Send.email}. */
  send: boolean;

  /** Whether this key can read contacts. Not yet exposed anywhere else in this SDK. */
  contactsRead: boolean;

  /** Whether this key can create or modify contacts. Not yet exposed anywhere else in this SDK. */
  contactsWrite: boolean;

  /** Whether this key can read domain records. Not yet exposed anywhere else in this SDK. */
  domainsRead: boolean;
}

/**
 * The response returned by {@link Kazuni.me}: the organization and permissions attached to the
 * API key in use.
 */
export interface MeResponse {
  /** The Kazuni organization id that owns the API key in use. */
  organizationId: string;

  /**
   * The key's mode: `"live"` for keys that send real email, `"test"` for keys meant for
   * development against non-production data. The key's prefix (`cl_live_...` / `cl_test_...`)
   * matches this field.
   */
  mode: "live" | "test";

  /** The permissions granted to the API key in use. See {@link ApiKeyPermissions}. */
  permissions: ApiKeyPermissions;
}
