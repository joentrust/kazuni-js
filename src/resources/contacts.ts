import { type RequestConfig, request } from "../request";
import type {
  AddIdentifierParams,
  Channel,
  ContactResponse,
  CreateContactParams,
  ListContactsParams,
  ListContactsResponse,
  RequestOptions,
  SetSubscriptionParams,
  UpdateContactParams,
  UpsertContactParams,
} from "../types";

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

/**
 * The `contacts` namespace on a {@link Kazuni} client, exposed as `kazuni.contacts`. Groups
 * together every method for creating, looking up, and managing the contacts your organization
 * sends to - including their identifiers (email/phone) and per-channel subscription state.
 *
 * Every method here requires an API key with the `contactsRead` or `contactsWrite` permission,
 * noted per method below. A key lacking the required permission throws a {@link KazuniError}
 * with `status: 403` naming the missing permission.
 */
export class Contacts {
  #config: RequestConfig;

  /** @internal Constructed by {@link Kazuni} - not meant to be called directly. */
  constructor(config: RequestConfig) {
    this.#config = config;
  }

  /**
   * Lists contacts for your organization, newest first, with optional search and list
   * filtering.
   *
   * This makes a `GET /v1/contacts` request. Requires the `contactsRead` permission.
   *
   * This is a `GET` request, so it is retry-eligible by default - no `idempotencyKey` is needed
   * or accepted, unlike the mutating methods on this class. Listing contacts has no side
   * effects, so retrying it on a transient failure is always safe.
   *
   * @param params Pagination and filtering options. See {@link ListContactsParams}. Omit
   *   entirely to fetch the first page with default paging.
   * @returns A page of contacts plus pagination metadata. See {@link ListContactsResponse}.
   * @throws {KazuniError} On any non-2xx response (invalid API key, missing permission, an
   *   invalid `listId`, rate limiting, server error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const page = await kazuni.contacts.list({ page: 1, limit: 25, q: "amara" });
   * console.log(page.total, page.data.length);
   * ```
   *
   * @example Filtering to a single list
   * ```ts
   * const { data } = await kazuni.contacts.list({ listId: "3fa85f64-5717-4562-b3fc-2c963f66afa6" });
   * ```
   */
  list(params?: ListContactsParams): Promise<ListContactsResponse> {
    const query = buildQueryString({
      page: params?.page,
      limit: params?.limit,
      q: params?.q,
      listId: params?.listId,
    });
    return request<ListContactsResponse>(this.#config, "GET", `/v1/contacts${query}`);
  }

  /**
   * Creates a new contact.
   *
   * This makes a `POST /v1/contacts` request. Requires the `contactsWrite` permission. Unlike
   * {@link Contacts.upsert}, this never updates an existing contact - if any supplied identifier
   * is already owned by another contact in your organization, the call throws rather than
   * attaching it or silently creating a duplicate. Prefer {@link Contacts.upsert} whenever a
   * caller might submit the same contact more than once (e.g. syncing from an external system)
   * and you want that case to update in place instead of failing.
   *
   * @param params The contact to create - at least one identifier is required. See
   *   {@link CreateContactParams}.
   * @param options Per-request options. Pass `idempotencyKey` to make this call safe to retry
   *   on transient failures - see {@link RequestOptions.idempotencyKey} for exactly what that
   *   does and does not guarantee today. Without it, a failed create is never automatically
   *   retried, so it can never be silently created twice by the SDK.
   * @returns The newly created contact. See {@link ContactResponse}.
   * @throws {KazuniError} With `status: 409` and `code: "contact_conflict"` if any supplied
   *   identifier is already owned by an existing contact in your organization (uniqueness is
   *   per-organization, so the same identifier value in a different organization is unaffected).
   *   Resolve this deliberately - for example by calling {@link Contacts.upsert} instead, or by
   *   looking up the existing contact via {@link Contacts.list} - rather than retrying the same
   *   call.
   * @throws {KazuniError} With `status: 422` if an identifier's `value` cannot be parsed as a
   *   valid email or phone number for its `type` (e.g. an unparseable phone number). Also thrown
   *   on any other non-2xx response (invalid API key, missing permission, validation failure,
   *   rate limiting, server error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const contact = await kazuni.contacts.create({
   *   identifiers: [{ type: "email", value: "amara@example.com", isPrimary: true }],
   *   firstName: "Amara",
   *   lastName: "Diallo",
   *   metadata: { plan: "pro" },
   * });
   *
   * console.log(contact.id, contact.subscriptions.email); // "...", "subscribed"
   * ```
   *
   * @example Handling a duplicate identifier deliberately
   * ```ts
   * try {
   *   await kazuni.contacts.create({
   *     identifiers: [{ type: "email", value: "amara@example.com" }],
   *   });
   * } catch (error) {
   *   if (error instanceof KazuniError && error.code === "contact_conflict") {
   *     // amara@example.com already belongs to another contact - use upsert() instead, or look
   *     // up the existing contact and decide how to proceed.
   *   }
   * }
   * ```
   */
  create(params: CreateContactParams, options?: RequestOptions): Promise<ContactResponse> {
    return request<ContactResponse>(this.#config, "POST", "/v1/contacts", params, options);
  }

  /**
   * Creates a contact, or updates one that already matches, in a single call.
   *
   * This makes a `POST /v1/contacts/upsert` request. Requires the `contactsWrite` permission.
   * Matching works by looking up every identifier in `params.identifiers` against existing
   * contacts: if none match, a new contact is created (the API responds `201`); if exactly one
   * existing contact matches - by any supplied identifier, not just all of them - that contact
   * is updated in place (the API responds `200`). The SDK does not currently surface which of
   * the two happened; both cases resolve to the same {@link ContactResponse} shape, so inspect
   * `createdAt`/`updatedAt` yourself if you need to distinguish them.
   *
   * When an update happens, `firstName`/`lastName` are only overwritten if you supply them,
   * `metadata` is merged (your keys win on conflict), and any identifiers you passed that the
   * matched contact doesn't already have are attached to it.
   *
   * @param params The contact to create or match against. See {@link UpsertContactParams} - the
   *   same shape as {@link CreateContactParams}.
   * @param options Per-request options. Pass `idempotencyKey` to make this call safe to retry
   *   on transient failures - see {@link RequestOptions.idempotencyKey}.
   * @returns The created or updated contact. See {@link ContactResponse}.
   * @throws {KazuniError} With `status: 409` and `code: "contact_conflict"` if the supplied
   *   identifiers resolve to *more than one* existing contact - the API deliberately refuses to
   *   guess which one you meant, so guessing is left up to the caller: look up each identifier
   *   individually (e.g. via {@link Contacts.list} with `q`) and decide how to reconcile them,
   *   for example by merging manually before retrying.
   * @throws {KazuniError} With `status: 422` if an identifier's `value` cannot be parsed as a
   *   valid email or phone number for its `type`. Also thrown on any other non-2xx response
   *   (invalid API key, missing permission, rate limiting, server error) or on a network
   *   failure/timeout.
   *
   * @example
   * ```ts
   * const contact = await kazuni.contacts.upsert({
   *   identifiers: [{ type: "email", value: "amara@example.com" }],
   *   metadata: { lastSeenAt: new Date().toISOString() },
   * });
   * ```
   *
   * @example Handling a conflict deliberately rather than guessing
   * ```ts
   * try {
   *   await kazuni.contacts.upsert({
   *     identifiers: [
   *       { type: "email", value: "amara@example.com" },
   *       { type: "phone", value: "+15551234567" },
   *     ],
   *   });
   * } catch (error) {
   *   if (error instanceof KazuniError && error.code === "contact_conflict") {
   *     // The email and phone belong to two different existing contacts - resolve which one
   *     // is correct (or merge them) before retrying, rather than picking one automatically.
   *   }
   * }
   * ```
   */
  upsert(params: UpsertContactParams, options?: RequestOptions): Promise<ContactResponse> {
    return request<ContactResponse>(this.#config, "POST", "/v1/contacts/upsert", params, options);
  }

  /**
   * Retrieves a single contact by id.
   *
   * This makes a `GET /v1/contacts/:id` request. Requires the `contactsRead` permission. Only
   * contacts belonging to your organization are visible: an id that doesn't exist and an id
   * that belongs to another organization both 404 identically, so a 404 here never confirms or
   * denies that a given id exists elsewhere.
   *
   * This is a `GET` request, so it is retry-eligible by default - no `idempotencyKey` is needed
   * or accepted. Reading a contact has no side effects, so retrying it on a transient failure is
   * always safe.
   *
   * @param id The contact id to look up - the `id` field of a {@link ContactResponse}.
   * @returns The contact. See {@link ContactResponse}.
   * @throws {KazuniError} With `status: 404` if no contact with that id exists for your
   *   organization. Also thrown on any other non-2xx response (invalid API key, missing
   *   permission, rate limiting, server error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const contact = await kazuni.contacts.get("3fa85f64-5717-4562-b3fc-2c963f66afa6");
   * console.log(contact.firstName, contact.identifiers.length);
   * ```
   */
  get(id: string): Promise<ContactResponse> {
    return request<ContactResponse>(this.#config, "GET", `/v1/contacts/${encodeURIComponent(id)}`);
  }

  /**
   * Updates a contact's name and/or metadata.
   *
   * This makes a `PATCH /v1/contacts/:id` request. Requires the `contactsWrite` permission.
   * Every field in `params` is independently optional: an omitted field is left unchanged, but
   * a supplied `metadata` object **replaces** the existing one wholesale rather than merging
   * into it - see {@link UpdateContactParams.metadata}. To change identifiers or subscriptions,
   * use {@link Contacts.addIdentifier}, {@link Contacts.removeIdentifier}, or
   * {@link Contacts.setSubscription} instead - this method does not touch either.
   *
   * @param id The id of the contact to update.
   * @param params The fields to change. See {@link UpdateContactParams}.
   * @param options Per-request options. Pass `idempotencyKey` to make this call safe to retry
   *   on transient failures - see {@link RequestOptions.idempotencyKey}.
   * @returns The updated contact. See {@link ContactResponse}.
   * @throws {KazuniError} With `status: 404` if no contact with that id exists for your
   *   organization. Also thrown on any other non-2xx response (invalid API key, missing
   *   permission, validation failure, rate limiting, server error) or on a network
   *   failure/timeout.
   *
   * @example
   * ```ts
   * const contact = await kazuni.contacts.update("3fa85f64-5717-4562-b3fc-2c963f66afa6", {
   *   lastName: "Ochieng",
   * });
   * ```
   */
  update(
    id: string,
    params: UpdateContactParams,
    options?: RequestOptions,
  ): Promise<ContactResponse> {
    return request<ContactResponse>(
      this.#config,
      "PATCH",
      `/v1/contacts/${encodeURIComponent(id)}`,
      params,
      options,
    );
  }

  /**
   * Deletes a contact, along with its identifiers and subscription state.
   *
   * This makes a `DELETE /v1/contacts/:id` request. Requires the `contactsWrite` permission.
   * This is a hard, irreversible delete - there is no way to recover a deleted contact through
   * this SDK.
   *
   * @param id The id of the contact to delete.
   * @param options Per-request options. Pass `idempotencyKey` to make this call safe to retry
   *   on transient failures - see {@link RequestOptions.idempotencyKey}. Note that once a delete
   *   has succeeded, retrying the same call (even with a matching `idempotencyKey`, which the
   *   API does not yet deduplicate on) throws a `404` rather than resolving again, since the
   *   contact no longer exists.
   * @throws {KazuniError} With `status: 404` if no contact with that id exists for your
   *   organization. Also thrown on any other non-2xx response (invalid API key, missing
   *   permission, rate limiting, server error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * await kazuni.contacts.delete("3fa85f64-5717-4562-b3fc-2c963f66afa6");
   * ```
   */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return request<void>(
      this.#config,
      "DELETE",
      `/v1/contacts/${encodeURIComponent(id)}`,
      undefined,
      options,
    );
  }

  /**
   * Attaches an additional identifier (email or phone) to an existing contact.
   *
   * This makes a `POST /v1/contacts/:id/identifiers` request. Requires the `contactsWrite`
   * permission. If the identifier is already attached to this same contact, the call succeeds
   * as a no-op and returns the contact unchanged.
   *
   * @param id The id of the contact to attach the identifier to.
   * @param params The identifier to add. See {@link AddIdentifierParams}.
   * @param options Per-request options. Pass `idempotencyKey` to make this call safe to retry
   *   on transient failures - see {@link RequestOptions.idempotencyKey}.
   * @returns The contact with the new identifier included. See {@link ContactResponse}.
   * @throws {KazuniError} With `status: 404` if no contact with that id exists for your
   *   organization.
   * @throws {KazuniError} With `status: 409` and `code: "contact_conflict"` if the identifier is
   *   already attached to a *different* contact - the API refuses to move it automatically,
   *   since doing so would silently merge identity across two contacts. Resolve this
   *   deliberately: decide which contact should own the identifier (for example by merging the
   *   two contacts) before retrying.
   * @throws {KazuniError} With `status: 422` if `params.value` cannot be parsed as a valid email
   *   or phone number for `params.type`. Also thrown on any other non-2xx response (invalid API
   *   key, missing permission, rate limiting, server error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const contact = await kazuni.contacts.addIdentifier("3fa85f64-5717-4562-b3fc-2c963f66afa6", {
   *   type: "phone",
   *   value: "+15551234567",
   * });
   * ```
   */
  addIdentifier(
    id: string,
    params: AddIdentifierParams,
    options?: RequestOptions,
  ): Promise<ContactResponse> {
    return request<ContactResponse>(
      this.#config,
      "POST",
      `/v1/contacts/${encodeURIComponent(id)}/identifiers`,
      params,
      options,
    );
  }

  /**
   * Removes an identifier from a contact.
   *
   * This makes a `DELETE /v1/contacts/:id/identifiers/:idfId` request. Requires the
   * `contactsWrite` permission. If `identifierId` doesn't correspond to an identifier currently
   * attached to this contact (already removed, belongs to a different contact, or never
   * existed), the call succeeds as a no-op and returns the contact unchanged - it does not
   * throw. Removing a contact's *last* remaining identifier is different: the API refuses it,
   * because a contact with zero identifiers would be unreachable by {@link Contacts.list}'s `q`
   * search and by {@link Contacts.upsert} matching going forward. Add a replacement identifier
   * with {@link Contacts.addIdentifier} first if you need to swap a contact's sole identifier.
   *
   * @param id The id of the contact to remove the identifier from.
   * @param identifierId The identifier's own id - {@link ContactIdentifier.id} from
   *   `contact.identifiers`, not the identifier's `value`.
   * @param options Per-request options. Pass `idempotencyKey` to make this call safe to retry
   *   on transient failures - see {@link RequestOptions.idempotencyKey}.
   * @returns The contact with the identifier removed. See {@link ContactResponse}.
   * @throws {KazuniError} With `status: 404` if no contact with `id` exists for your
   *   organization.
   * @throws {KazuniError} With `status: 422` if `identifierId` is the contact's only remaining
   *   identifier - removing it is refused rather than leaving the contact with none. Also thrown
   *   on any other non-2xx response (invalid API key, missing permission, rate limiting, server
   *   error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const contact = await kazuni.contacts.get("3fa85f64-5717-4562-b3fc-2c963f66afa6");
   * const phoneIdentifier = contact.identifiers.find((i) => i.type === "phone");
   * if (phoneIdentifier) {
   *   await kazuni.contacts.removeIdentifier(contact.id, phoneIdentifier.id);
   * }
   * ```
   */
  removeIdentifier(
    id: string,
    identifierId: string,
    options?: RequestOptions,
  ): Promise<ContactResponse> {
    return request<ContactResponse>(
      this.#config,
      "DELETE",
      `/v1/contacts/${encodeURIComponent(id)}/identifiers/${encodeURIComponent(identifierId)}`,
      undefined,
      options,
    );
  }

  /**
   * Sets a contact's subscription status for a single channel.
   *
   * This makes a `PUT /v1/contacts/:id/subscriptions/:chan` request. Requires the
   * `contactsWrite` permission. This sets the channel's status outright (it is not a toggle) -
   * calling it with `{ status: "unsubscribed" }` on an already-unsubscribed channel succeeds
   * and is a no-op.
   *
   * @param id The id of the contact to update.
   * @param channel The channel to set the subscription status for. See {@link Channel}.
   * @param params The status to set, and optionally where the change originated. See
   *   {@link SetSubscriptionParams}.
   * @param options Per-request options. Pass `idempotencyKey` to make this call safe to retry
   *   on transient failures - see {@link RequestOptions.idempotencyKey}.
   * @returns The contact with the updated subscription status. See {@link ContactResponse}.
   * @throws {KazuniError} With `status: 404` if no contact with that id exists for your
   *   organization. Also thrown on any other non-2xx response (invalid API key, missing
   *   permission, rate limiting, server error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * await kazuni.contacts.setSubscription("3fa85f64-5717-4562-b3fc-2c963f66afa6", "sms", {
   *   status: "unsubscribed",
   *   source: "reply_stop",
   * });
   * ```
   */
  setSubscription(
    id: string,
    channel: Channel,
    params: SetSubscriptionParams,
    options?: RequestOptions,
  ): Promise<ContactResponse> {
    return request<ContactResponse>(
      this.#config,
      "PUT",
      `/v1/contacts/${encodeURIComponent(id)}/subscriptions/${encodeURIComponent(channel)}`,
      params,
      options,
    );
  }
}
