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

  /**
   * Schedules the email to send at a future time instead of immediately, as an ISO 8601
   * instant. Must be in the future and within 30 days.
   */
  scheduledAt?: string;
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
 * - `"scheduled"` - accepted for delivery at a future `scheduledAt` time; not yet handed to the
 *   sending provider. Cancellable via {@link Messages.cancel} while in this state.
 * - `"canceled"` - a `"scheduled"` message was canceled via {@link Messages.cancel} before it
 *   fired. Terminal - it will never be sent.
 */
export type MessageStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "undelivered"
  | "bounced"
  | "complained"
  | "rejected"
  | "failed"
  | "scheduled"
  | "canceled";

/**
 * Parameters for sending a single SMS via {@link Send.sms}.
 */
export interface SendSmsParams {
  /**
   * The sender ID recipients see - an alphanumeric sender ID (e.g. `"Kazuni"`) or an E.164
   * long code. Whether a given sender ID is permitted depends on the destination country's
   * rules and your account's registration; an unverified sender ID may be rejected with a
   * {@link KazuniError} `status: 403`.
   */
  from: string;

  /** The recipient's phone number. Any format libphonenumber can parse is accepted and
   * normalized to E.164; an unparseable number throws a {@link KazuniError} `status: 400`. */
  to: string;

  /** The message body. Kept plain text; long bodies are split into multiple billed segments. */
  text: string;

  /**
   * Schedules the SMS to send at a future time instead of immediately, as an ISO 8601 instant.
   * Must be in the future and within 30 days.
   */
  scheduledAt?: string;
}

/**
 * The response returned by {@link Send.email} and {@link Send.sms}. Uniform across channels so
 * the return shape does not change as channels are added - a resolved promise means the send was
 * accepted, never that it was delivered.
 */
export interface SendMessageResponse {
  /** The unique identifier assigned to this send, for use with {@link Messages.get} and support. */
  id: string;

  /** The channel the message was sent on. */
  channel: Channel;

  /** Always `"queued"` - the request was accepted, not delivered. */
  status: "queued";

  /**
   * A non-fatal advisory, present only when the send was accepted with a caveat - for example,
   * an SMS sent under a sender ID whose registration status for the destination country could
   * not be confirmed. Absent on a clean send.
   */
  warning?: string;
}

/**
 * The response returned by {@link Messages.get} for a single message.
 */
export interface GetMessageResponse {
  /** The message's unique identifier, as returned by a send (`SendMessageResponse.id`). */
  id: string;

  /** The channel this message was sent on. */
  channel: Channel;

  /** The sender address/ID the message was sent from. */
  from: string;

  /** The recipient address/number the message was sent to. */
  to: string;

  /** The email subject line, or `null` for channels without a subject (SMS). */
  subject: string | null;

  /** The number of billed segments, for SMS. `null` for channels where it does not apply. */
  segments: number | null;

  /** The message's current delivery status. See {@link MessageStatus} for what each value means. */
  status: MessageStatus;

  /**
   * A human-readable description of what went wrong, populated when delivery failed outright.
   * `null` whenever there is nothing to report, which is most of the time.
   */
  error: string | null;

  /**
   * When a scheduled message is due to send, as an ISO 8601 timestamp. `null` for messages that
   * were not scheduled - i.e. every message that did not set `scheduledAt` on send. Still
   * populated after the message reaches `"scheduled"`'s eventual outcome or is `"canceled"`, so
   * you can see what the schedule was.
   */
  scheduledAt: string | null;

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
 * The response returned by {@link Messages.cancel} after canceling a scheduled message.
 *
 * Deliberately narrower than {@link GetMessageResponse}: the cancel endpoint returns only these
 * two fields, and reusing the wider type here would promise data the response does not actually
 * carry. Call {@link Messages.get} afterward if you need the rest of the message's envelope.
 */
export interface CancelMessageResponse {
  /** The canceled message's unique identifier, echoing the id passed to {@link Messages.cancel}. */
  id: string;

  /**
   * The message's status after the cancel request. `"canceled"` on success - including when the
   * message was already `"canceled"`, since canceling is idempotent. See {@link MessageStatus}.
   */
  status: MessageStatus;
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

/**
 * The kind of value a contact identifier holds. See {@link IdentifierInput} and
 * {@link ContactIdentifier}.
 */
export type IdentifierType = "email" | "phone";

/**
 * A delivery channel a contact can be subscribed to. Used with
 * {@link Contacts.setSubscription} and in {@link ContactResponse.subscriptions}.
 */
export type Channel = "email" | "sms" | "whatsapp";

/**
 * A contact's subscription state for a given {@link Channel}.
 */
export type SubscriptionStatus = "subscribed" | "unsubscribed";

/**
 * An identifier attached to a contact, as returned by the API. See
 * {@link ContactResponse.identifiers}.
 */
export interface ContactIdentifier {
  /** The identifier's own id, distinct from the owning contact's id. Used by
   * {@link Contacts.removeIdentifier}. */
  id: string;

  /** Whether this is an email address or a phone number. */
  type: IdentifierType;

  /**
   * The identifier's normalized value - lowercased for email, E.164 for phone. This may differ
   * from whatever raw string was originally submitted via {@link IdentifierInput.value}.
   */
  value: string;

  /** Whether this identifier is the contact's primary one for its {@link type}. */
  isPrimary: boolean;
}

/**
 * An identifier to attach to a contact - passed via {@link CreateContactParams.identifiers},
 * {@link UpsertContactParams.identifiers}, and {@link Contacts.addIdentifier}.
 */
export interface IdentifierInput {
  /** Whether `value` is an email address or a phone number. */
  type: IdentifierType;

  /**
   * The raw identifier value. Emails are normalized by lowercasing; phone numbers are parsed
   * and normalized to E.164. A value that cannot be parsed as a valid identifier of `type`
   * throws a {@link KazuniError} with `status: 422` - see the throwing methods for detail.
   */
  value: string;

  /**
   * Whether this identifier should be marked as the contact's primary one for its `type`.
   * Defaults to `false` when omitted.
   */
  isPrimary?: boolean;
}

/**
 * A contact, as returned by every {@link Contacts} method that reads or mutates one.
 */
export interface ContactResponse {
  /** The contact's unique id. */
  id: string;

  /** The contact's first name, or `null` when not set. */
  firstName: string | null;

  /** The contact's last name, or `null` when not set. */
  lastName: string | null;

  /** Free-form string key/value metadata attached to the contact. */
  metadata: Record<string, string>;

  /** Every identifier (email and/or phone) currently attached to this contact. */
  identifiers: ContactIdentifier[];

  /**
   * The contact's subscription status for each {@link Channel}. Always has an entry for every
   * channel, even ones the contact has never been explicitly subscribed or unsubscribed on -
   * unset channels default to `"subscribed"` for email and `"unsubscribed"` for sms/whatsapp.
   */
  subscriptions: Record<Channel, SubscriptionStatus>;

  /** When the contact was created, as an ISO 8601 timestamp. */
  createdAt: string;

  /** When the contact was last updated, as an ISO 8601 timestamp. */
  updatedAt: string;
}

/**
 * Parameters for {@link Contacts.create} and {@link Contacts.upsert}.
 */
export interface CreateContactParams {
  /**
   * The identifiers to attach to the contact - at least one is required. For
   * {@link Contacts.upsert}, every one of these is used to search for an existing match; see
   * {@link Contacts.upsert} for what happens when they resolve to more than one contact.
   */
  identifiers: IdentifierInput[];

  /** The contact's first name. */
  firstName?: string;

  /** The contact's last name. */
  lastName?: string;

  /** Free-form string key/value metadata to attach to the contact. Defaults to `{}`. */
  metadata?: Record<string, string>;

  /** A list id to add the contact to immediately after it's created or matched. */
  listId?: string;
}

/**
 * Parameters for {@link Contacts.upsert}. Identical in shape to {@link CreateContactParams} -
 * kept as a distinct alias so the two methods' signatures can diverge later without a breaking
 * change to either.
 */
export type UpsertContactParams = CreateContactParams;

/**
 * Parameters for {@link Contacts.update}. Every field is optional and independently settable -
 * omitted fields are left unchanged, so passing `{ lastName: "Ochieng" }` updates only the last
 * name.
 */
export interface UpdateContactParams {
  /** The contact's new first name. */
  firstName?: string;

  /** The contact's new last name. */
  lastName?: string;

  /**
   * Replacement metadata for the contact. This **replaces** the existing metadata object
   * wholesale rather than merging into it - include any existing keys you want to keep.
   */
  metadata?: Record<string, string>;
}

/**
 * Parameters for {@link Contacts.addIdentifier}. Identical in shape to {@link IdentifierInput}.
 */
export type AddIdentifierParams = IdentifierInput;

/**
 * The source to record for a subscription change, passed via
 * {@link SetSubscriptionParams.source}.
 */
export type SubscriptionSource = "signup" | "import" | "unsubscribe_link" | "reply_stop" | "api";

/**
 * Parameters for {@link Contacts.setSubscription}.
 */
export interface SetSubscriptionParams {
  /** The subscription status to set the contact to for the given channel. */
  status: SubscriptionStatus;

  /**
   * Where this subscription change originated. Defaults to `"api"` when omitted, which is the
   * right choice for most programmatic calls - use a more specific source (e.g.
   * `"unsubscribe_link"`) only when this call is relaying an action that happened somewhere
   * else.
   */
  source?: SubscriptionSource;
}

/**
 * Query parameters for {@link Contacts.list}.
 */
export interface ListContactsParams {
  /** The page number to fetch, starting at `1`. Defaults to `1` when omitted. */
  page?: number;

  /** How many contacts to return per page. Defaults to `50`, capped at `200`, when omitted. */
  limit?: number;

  /**
   * A free-text search filtering contacts by first name, last name, or identifier value
   * (email/phone), matched case-insensitively as a substring.
   */
  q?: string;

  /** Restricts results to contacts that are members of this list id. */
  listId?: string;
}

/**
 * The response returned by {@link Contacts.list}: a page of contacts plus pagination metadata.
 */
export interface ListContactsResponse {
  /** The contacts on this page, in most-recently-created-first order. */
  data: ContactResponse[];

  /** The total number of contacts matching the query, across all pages. */
  total: number;

  /** The page number this response corresponds to, echoing {@link ListContactsParams.page}. */
  page: number;

  /** The page size used for this response, echoing {@link ListContactsParams.limit}. */
  limit: number;
}
