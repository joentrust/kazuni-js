# @kazuni/sdk

Kazuni is a unified notifications platform for African businesses - email today, with SMS and
WhatsApp planned. This is the official JavaScript/TypeScript SDK for the Kazuni API.

## Install

```bash
pnpm add @kazuni/sdk
```

```bash
npm i @kazuni/sdk
# or
yarn add @kazuni/sdk
```

## Quickstart

```ts
import { Kazuni } from "@kazuni/sdk";

const kazuni = new Kazuni(process.env.KAZUNI_API_KEY!);

const result = await kazuni.send.email({
  from: "Acme <hello@acme.example>",
  to: "customer@example.com",
  subject: "Welcome to Acme",
  html: "<p>Thanks for signing up.</p>",
  text: "Thanks for signing up.",
});

console.log(result.id, result.status); // "email_...", "queued"
```

`from` must be on a domain you have verified with Kazuni. `to` is a single recipient address per
request.

## Configuration

`new Kazuni(apiKey)` is shorthand for `new Kazuni({ apiKey })`. The full options object:

```ts
const kazuni = new Kazuni({
  apiKey: process.env.KAZUNI_API_KEY!,
  baseUrl: "https://api.usekazuni.com", // override for self-hosting or tests
  timeout: 30_000, // per-request timeout in milliseconds
  maxRetries: 2, // retries on 429 and 5xx responses
});
```

- **baseUrl**: defaults to the production Kazuni API. Override it when testing against a local
  API server or a self-hosted deployment.
- **timeout**: aborts a request that takes longer than this, in milliseconds.
- **maxRetries**: on `429` and `5xx` responses, the SDK retries with exponential backoff and
  jitter, honoring the `Retry-After` header when the API sends one. GET requests are always
  retry-eligible. POST requests (like `send.email`) are only retried when you pass an
  `idempotencyKey`, so a retried send can never silently double-send:

```ts
await kazuni.send.email(
  { from: "hello@acme.example", to: "customer@example.com", subject: "Hi", html: "<p>Hi</p>" },
  { idempotencyKey: "welcome-email-user-42" }
);
```

## Errors

Request failures (authentication, validation, network, or API errors) throw a `KazuniError`:

```ts
import { Kazuni, KazuniError } from "@kazuni/sdk";

try {
  await kazuni.send.email({ from: "hello@acme.example", to: "bad", subject: "Hi", html: "<p>Hi</p>" });
} catch (error) {
  if (error instanceof KazuniError) {
    console.error(error.message, error.status, error.code, error.requestId);
  }
}
```

- `error.status` - the HTTP status code, when the failure came from an API response.
- `error.code` - a machine-readable error code, when the API provides one.
- `error.requestId` - a request identifier for support, when the API returns one.

## API reference

Every exported symbol carries JSDoc, so your editor's hover/autocomplete is the fastest
reference. For a browsable Markdown API reference generated from that same JSDoc, run:

```bash
pnpm docs
```

This writes the reference to `docs/api/` (gitignored - generate it locally rather than reading
a possibly-stale copy).

## Status

This SDK is alpha and tracks Kazuni API v1. The v1 surface currently covers sending transactional
email; SMS, WhatsApp, and other resources will land here as the underlying API supports them.
Expect breaking changes before a 1.0 release.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
