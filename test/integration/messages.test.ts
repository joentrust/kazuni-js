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

// Sender address for the send-then-lookup test. Must be on a domain verified against the
// target API - defaults to the domain used in the CONTRIBUTING.md local dev walkthrough, but
// can be overridden for other environments (e.g. a staging API with a different verified domain).
const fromEmail = process.env.KAZUNI_TEST_FROM_EMAIL ?? "hello@example.test";

describe.skipIf(!canRun)("integration", () => {
  it("sends an email, then retrieves it by id with a matching status", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });

    const sent = await kazuni.send.email({
      from: fromEmail,
      to: "integration-test@example.com",
      subject: `kazuni-js messages.get integration test ${Date.now()}`,
      html: "<p>Sent by the kazuni-js integration test suite.</p>",
      text: "Sent by the kazuni-js integration test suite.",
    });

    const message = await kazuni.messages.get(sent.id);

    expect(message.id).toBe(sent.id);
    expect(message.from).toContain(fromEmail);
    expect(message.to).toBe("integration-test@example.com");
    expect(typeof message.status).toBe("string");
    expect(typeof message.queuedAt).toBe("string");
  });

  it("surfaces a not-found id as a 404 KazuniError", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });

    let error: unknown;
    try {
      await kazuni.messages.get("00000000-0000-0000-0000-000000000000");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(KazuniError);
    expect((error as KazuniError).status).toBe(404);
  });
});
