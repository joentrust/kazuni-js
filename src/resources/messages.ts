import { type RequestConfig, request } from "../request";
import type { GetMessageResponse } from "../types";

/**
 * The `messages` namespace on a {@link Kazuni} client, exposed as `kazuni.messages`. Named for
 * where the API is heading, not just where it is today: {@link Messages.get} currently calls
 * `GET /v1/emails/:id`, the only message-status endpoint the API exposes right now. Once SMS and
 * WhatsApp land, the API will expose `GET /v1/messages/:id` with a `channel` field distinguishing
 * delivery channels, and this method will move to call that endpoint without changing its name
 * or shape from the caller's perspective.
 */
export class Messages {
  #config: RequestConfig;

  /** @internal Constructed by {@link Kazuni} - not meant to be called directly. */
  constructor(config: RequestConfig) {
    this.#config = config;
  }

  /**
   * Retrieves a message and its current delivery status.
   *
   * This makes a `GET /v1/emails/:id` request today - see {@link Messages} for why the method is
   * named `get` rather than `getEmail`. Only messages belonging to your organization are
   * visible: an id that doesn't exist and an id that belongs to another organization both 404
   * identically, so a 404 here never confirms or denies that a given id exists elsewhere.
   *
   * This is a `GET` request, so it is retry-eligible by default - no `idempotencyKey` is needed
   * or accepted, unlike {@link Send.email}. Reading a message's status has no side effects, so
   * retrying it on a transient failure is always safe.
   *
   * @param id The message id to look up - the `id` returned by {@link Send.email}
   *   (`SendEmailResponse.id`).
   * @returns The message's envelope fields and current delivery status. See
   *   {@link GetMessageResponse}.
   * @throws {KazuniError} With `status: 404` if no message with that id exists for your
   *   organization. Also thrown on any other non-2xx response (invalid API key, rate limiting,
   *   server error) or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const message = await kazuni.messages.get("3fa85f64-5717-4562-b3fc-2c963f66afa6");
   * console.log(message.status); // "delivered"
   * ```
   *
   * @example Handling a not-found id
   * ```ts
   * try {
   *   await kazuni.messages.get(unknownId);
   * } catch (error) {
   *   if (error instanceof KazuniError && error.status === 404) {
   *     console.log("No message with that id");
   *   }
   * }
   * ```
   */
  get(id: string): Promise<GetMessageResponse> {
    return request<GetMessageResponse>(this.#config, "GET", `/v1/emails/${encodeURIComponent(id)}`);
  }
}
