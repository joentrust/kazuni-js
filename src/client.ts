import {
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  type RequestConfig,
} from "./request";
import { Send } from "./resources/send";
import type { KazuniConstructorArg } from "./types";

export class Kazuni {
  readonly send: Send;

  #config: RequestConfig;

  constructor(arg: KazuniConstructorArg) {
    const options = typeof arg === "string" ? { apiKey: arg } : arg;

    if (!options.apiKey) {
      throw new Error("Kazuni: apiKey is required");
    }

    this.#config = {
      apiKey: options.apiKey,
      baseUrl: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    };

    this.send = new Send(this.#config);
  }
}
