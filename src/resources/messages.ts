import { type RequestConfig, request } from "../request";
import type { CancelMessageResponse, GetMessageResponse } from "../types";

/**
 * The `messages` namespace on a {@link Kazuni} client, exposed as `kazuni.messages`. Named for
 * where the API is heading, not just where it is today: {@link Messages.get} calls
 * `GET /v1/messages/:id`, which returns a `channel` field distinguishing delivery channels, so a
 * single method reads the status of an email or an SMS without changing its name or shape.
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
   * This makes a `GET /v1/messages/:id` request - see {@link Messages} for why the method is
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
    return request<GetMessageResponse>(
      this.#config,
      "GET",
      `/v1/messages/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Cancels a scheduled message before it sends.
   *
   * This makes a `POST /v1/messages/:id/cancel` request with no body. Only messages sent with
   * `scheduledAt` (see {@link SendEmailParams.scheduledAt} / {@link SendSmsParams.scheduledAt})
   * can be canceled, and only while they are still `"scheduled"` - once the scheduled time
   * arrives and the message moves to `"sending"` or `"sent"`, cancellation is no longer
   * possible.
   *
   * Canceling is idempotent: calling this on a message that is already `"canceled"` succeeds
   * and returns the same result, rather than erroring on the second call. This makes it safe to
   * retry a cancel that timed out without first checking whether the first attempt landed.
   *
   * As with {@link Messages.get}, only messages belonging to your organization are visible - an
   * id that doesn't exist and an id that belongs to another organization both 404 identically,
   * so a 404 here never confirms or denies that a given id exists elsewhere.
   *
   * @param id The message id to cancel - the `id` returned by {@link Send.email} or
   *   {@link Send.sms} (`SendMessageResponse.id`), or read back via {@link Messages.get}.
   * @returns The message's id and its status after the request, always `"canceled"` on success.
   *   See {@link CancelMessageResponse}.
   * @throws {KazuniError} With `status: 404` if no message with that id exists for your
   *   organization - never `status: 403`, so a 404 never confirms the id exists under another
   *   organization either.
   * @throws {KazuniError} With `status: 409` if the message is not in a cancellable state - i.e.
   *   any status other than `"scheduled"` or `"canceled"` (most commonly `"sending"` or
   *   `"sent"`, because the scheduled time already arrived). The error's body carries the
   *   message's current status; callers should treat this as "too late to cancel," not retry it.
   *   Also thrown on any other non-2xx response (invalid API key, rate limiting, server error)
   *   or on a network failure/timeout.
   *
   * @example
   * ```ts
   * const result = await kazuni.messages.cancel("email_123");
   * console.log(result.status); // "canceled"
   * ```
   *
   * @example Handling a message that already sent
   * ```ts
   * try {
   *   await kazuni.messages.cancel(id);
   * } catch (error) {
   *   if (error instanceof KazuniError && error.status === 409) {
   *     console.log("Too late - the message already left the scheduled state");
   *   }
   * }
   * ```
   */
  cancel(id: string): Promise<CancelMessageResponse> {
    return request<CancelMessageResponse>(
      this.#config,
      "POST",
      `/v1/messages/${encodeURIComponent(id)}/cancel`,
    );
  }
}
