/**
 * Options accepted by the {@link KazuniError} constructor.
 */
export interface KazuniErrorOptions {
  /**
   * The HTTP status code returned by the Kazuni API, when the failure came from a response
   * (as opposed to a network error or client-side timeout, where this is `undefined`).
   */
  status?: number;

  /**
   * A machine-readable error code from the API response body, when the API supplies one.
   * Today the Kazuni API does not return a `code` field on error responses, so this is
   * normally `undefined` - it is here so the SDK can surface one without a breaking change
   * once the API starts sending it.
   */
  code?: string;

  /**
   * A request identifier for support/debugging, read from the `x-request-id` response header.
   *
   * Forward-looking: the Kazuni API does not send this header yet, so `requestId` is normally
   * `undefined` today. The field exists so that once the API starts returning request ids,
   * they show up here with no breaking change to the error shape.
   */
  requestId?: string;

  /** The underlying error that caused this failure (a network error, abort, or parse error). */
  cause?: unknown;
}

/**
 * The error thrown for any failed Kazuni API request - authentication failures, validation
 * errors, rate limiting, server errors, network failures, and timeouts all surface as a
 * `KazuniError`.
 *
 * @example
 * ```ts
 * import { Kazuni, KazuniError } from "@kazuni/sdk";
 *
 * const kazuni = new Kazuni(process.env.KAZUNI_API_KEY!);
 *
 * try {
 *   await kazuni.send.email({
 *     from: "hello@acme.example",
 *     to: "bad-address",
 *     subject: "Hi",
 *     html: "<p>Hi</p>",
 *   });
 * } catch (error) {
 *   if (error instanceof KazuniError) {
 *     console.error(error.message, error.status, error.code, error.requestId);
 *   }
 * }
 * ```
 */
export class KazuniError extends Error {
  /**
   * The HTTP status code returned by the API, when the failure came from a response.
   * `undefined` for network errors and timeouts, since no response was ever received.
   */
  readonly status?: number;

  /**
   * A machine-readable error code from the API response body, when the API supplies one.
   * The Kazuni API does not populate this today, so it is normally `undefined`. See
   * {@link KazuniErrorOptions.code}.
   */
  readonly code?: string;

  /**
   * A request identifier for support/debugging, when the API returns one.
   *
   * Forward-looking: the Kazuni API does not send an `x-request-id` header yet, so this is
   * normally `undefined` today. See {@link KazuniErrorOptions.requestId}.
   */
  readonly requestId?: string;

  /**
   * @param message A human-readable description of the failure. For API error responses this
   *   is the server-provided error message; for network failures and timeouts it is an
   *   SDK-generated message.
   * @param options Additional structured detail about the failure - see
   *   {@link KazuniErrorOptions}.
   */
  constructor(message: string, options: KazuniErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "KazuniError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    Object.setPrototypeOf(this, KazuniError.prototype);
  }
}
