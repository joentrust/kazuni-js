import { describe, expect, it } from "vitest";
import { Kazuni, KazuniError } from "../../src/index";

/**
 * Opt-in integration tests that make real HTTP calls against a running Kazuni API. They are
 * skipped unless both KAZUNI_TEST_BASE_URL and KAZUNI_TEST_API_KEY are set, so `pnpm test` and
 * CI never need secrets or a live server. See CONTRIBUTING.md ("Testing against a local Kazuni
 * API") for how to stand up a local API and obtain a key.
 */
const baseUrl = process.env.KAZUNI_TEST_BASE_URL;
const apiKey = process.env.KAZUNI_TEST_API_KEY;
const canRun = Boolean(baseUrl && apiKey);

// Sender address for the successful-send test. Must be on a domain verified against the
// target API - defaults to the domain used in the CONTRIBUTING.md local dev walkthrough, but
// can be overridden for other environments (e.g. a staging API with a different verified domain).
const fromEmail = process.env.KAZUNI_TEST_FROM_EMAIL ?? "hello@example.test";

describe.skipIf(!canRun)("integration", () => {
  it("sends a real email and gets back a queued id", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });

    const result = await kazuni.send.email({
      from: fromEmail,
      to: "integration-test@example.com",
      subject: `kazuni-js integration test ${Date.now()}`,
      html: "<p>Sent by the kazuni-js integration test suite.</p>",
      text: "Sent by the kazuni-js integration test suite.",
    });

    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.status).toBe("queued");
  });

  it("surfaces an authentication failure as a 401 KazuniError", async () => {
    const kazuni = new Kazuni({ apiKey: "cl_test_invalid_00000000000000000000000000", baseUrl });

    let error: unknown;
    try {
      await kazuni.send.email({
        from: fromEmail,
        to: "integration-test@example.com",
        subject: "This should never send",
        html: "<p>This should never send.</p>",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(KazuniError);
    expect((error as KazuniError).status).toBe(401);
  });
});
