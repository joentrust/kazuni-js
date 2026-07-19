# Contributing to kazuni-js

Thanks for your interest in improving the Kazuni SDK.

## Dev setup

```bash
git clone https://github.com/kazunihq/kazuni-js.git
cd kazuni-js
pnpm install
```

Requires Node 18 or later and pnpm (this repo pins the version via `packageManager` in
`package.json` - run `corepack enable` if you don't have pnpm yet).

## Running tests

```bash
pnpm typecheck
pnpm test
pnpm build
```

Tests use vitest with a stubbed `fetch` (`vi.stubGlobal`). Real network calls in tests are not
permitted - if you're adding a test, mock the fetch response instead of hitting a live server.

## Runtime constraints

The SDK targets Node 18+, edge runtimes, and Cloudflare Workers. That means:

- No Node-only APIs (no `fs`, `http`, `crypto` module, `Buffer`, etc.).
- Use only global `fetch`, `AbortController`, `Response`, and other Web-standard APIs.
- Zero runtime dependencies. Do not add one without discussion first (see below).

## What we're looking for

- Framework examples (Next.js, Express, Cloudflare Workers, Deno, Bun, etc.)
- Bug fixes with a clear repro
- Documentation and README improvements
- Typo fixes and small clarity improvements

Feel free to open a PR directly for any of the above.

## What to discuss first in an issue

- New API surface (new resources, methods, or parameters)
- Core design changes (constructor shape, error model, retry behavior)
- New runtime dependencies

Open an issue describing the change before writing code, so we can agree on the approach. This
avoids wasted work on PRs that don't fit the SDK's direction.
