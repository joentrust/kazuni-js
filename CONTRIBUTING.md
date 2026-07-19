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
permitted in the default `pnpm test` run - if you're adding a test there, mock the fetch response
instead of hitting a live server. Real-network tests belong in `test/integration/` - see
"Integration tests" below.

## Testing against a local Kazuni API

Everything above runs against a stubbed `fetch`, which never actually exercises a real API call.
To verify the SDK against a real server, run it against the Kazuni platform's local dev stack.
This assumes you have `kazunihq/platform` checked out separately (e.g. at
`/Volumes/Work/code/kazuni/platform`) - it is a different repo from this SDK.

### 1. Boot the platform dev stack

From the root of the `platform` checkout:

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs `docker compose -f docker-compose.dev.yml up -d postgres redis && turbo run dev`:
it starts Postgres and Redis in Docker (Postgres on host port 5456, Redis on 6380), then runs
`apps/api`, `apps/web`, and `apps/worker` directly on the host via Turborepo, each in watch mode.

- API: `http://localhost:8000` (health check: `GET /health`)
- Web dashboard: `http://localhost:8001`

Before the first run, apply database migrations once (from `packages/db` in the platform repo):
`pnpm db:migrate`. The web app also needs Clerk keys in `apps/web/.env.local`
(`VITE_CLERK_PUBLISHABLE_KEY`) and the API needs them in `apps/api/.env`
(`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) - see `apps/api/.env.example` in that repo for the
full list of env vars and their dev defaults. These are the platform repo's setup steps, not this
SDK's - consult its own CONTRIBUTING/CLAUDE.md if you get stuck.

### 2. Sending is simulated - no AWS account needed

The API's `SES_MODE` env var defaults to `mock` (see `apps/api/.env.example` in the platform
repo) whenever no AWS credentials are configured, which is the case in a fresh local checkout.
In mock mode, sends are simulated in-process - nothing is dispatched to a real mail provider, and
you don't need any AWS setup to exercise the send path end to end.

Mock mode also auto-verifies domains: after you add a sending domain in the dashboard, it flips
to `verified` automatically after `SES_MOCK_VERIFY_AFTER_MS` (60 seconds by default) instead of
requiring real DNS changes.

### 3. Get a local API key

1. Open `http://localhost:8001`, sign up/sign in (Clerk-backed), and create or join an
   organization.
2. Go to `/dashboard/<org-slug>/domains` and add the domain you intend to send `from` (e.g.
   `example.test`). Wait about 60 seconds for it to flip to "verified" (mock mode - see above).
3. Go to `/dashboard/<org-slug>/api-keys` and create a key. Pick mode "test" for local work, and
   make sure the **send** permission is checked. The full key value (`cl_test_<32 characters>`,
   or `cl_live_...` for a live-mode key) is shown once at creation time - copy it immediately.
   After that, only the key's prefix (e.g. `cl_test_ab12`) is ever shown again.

### 4. Point the SDK at the local API

```ts
import { Kazuni } from "kazuni";

const kazuni = new Kazuni({
  apiKey: "cl_test_...", // the key you copied above
  baseUrl: "http://localhost:8000",
});

const result = await kazuni.send.email({
  from: "hello@example.test", // must match a domain you verified above
  to: "someone@example.com",
  subject: "Local test",
  html: "<p>Hello from the local dev stack.</p>",
});

console.log(result); // { id: "...", status: "queued" }
```

### 5. Using an unpublished local build of this SDK from another project

Build this SDK, then link it into the consuming project:

```bash
# in this repo
pnpm build

# in the other project
pnpm link /absolute/path/to/kazuni-js
```

`pnpm link <path>` (a relative or absolute path) is the form that works with pnpm - `pnpm link
<package-name>` alone fails with `ERR_PNPM_LINK_BAD_PARAMS` unless you first ran `pnpm link
--global` in this repo and then linked by name from the other project; the direct-path form
above needs no such setup and is what's documented here. After making further changes to this
SDK, rerun `pnpm build` (or run `pnpm exec tsup --watch` in this repo for continuous rebuilds) so
the linked `dist/` output stays current.

## Integration tests

`test/integration/` contains opt-in tests that make real HTTP calls against a running Kazuni API
instead of a stubbed `fetch`. They are skipped by default (via `describe.skipIf`) so `pnpm test`
and CI never need secrets or a live server. To run them, point the SDK at a live API (the local
dev stack above works) with a real API key:

```bash
KAZUNI_TEST_BASE_URL=http://localhost:8000 \
KAZUNI_TEST_API_KEY=cl_test_... \
pnpm test:integration
```

Both env vars must be set or the integration suite is skipped. The key needs the **send**
permission and a verified sending domain, per "Get a local API key" above. The successful-send
test sends `from` the domain used in that walkthrough (`hello@example.test`) by default -
override it with `KAZUNI_TEST_FROM_EMAIL` if you verified a different domain.

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
