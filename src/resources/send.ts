import { type RequestConfig, request } from "../request";
import type { RequestOptions, SendEmailParams, SendEmailResponse } from "../types";

export class Send {
  #config: RequestConfig;

  constructor(config: RequestConfig) {
    this.#config = config;
  }

  email(params: SendEmailParams, options?: RequestOptions): Promise<SendEmailResponse> {
    return request<SendEmailResponse>(this.#config, "POST", "/v1/emails/send", params, options);
  }
}
