export interface KazuniOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export type KazuniConstructorArg = string | KazuniOptions;

export interface RequestOptions {
  idempotencyKey?: string;
}

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResponse {
  id: string;
  status: "queued";
}
