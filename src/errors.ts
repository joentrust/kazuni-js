export interface KazuniErrorOptions {
  status?: number;
  code?: string;
  requestId?: string;
  cause?: unknown;
}

export class KazuniError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(message: string, options: KazuniErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "KazuniError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    Object.setPrototypeOf(this, KazuniError.prototype);
  }
}
