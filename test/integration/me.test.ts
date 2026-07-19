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

describe.skipIf(!canRun)("integration", () => {
  it("returns the organization and permissions for the key in use", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });

    const me = await kazuni.me();

    expect(typeof me.organizationId).toBe("string");
    expect(me.organizationId.length).toBeGreaterThan(0);
    expect(["live", "test"]).toContain(me.mode);
    expect(typeof me.permissions.send).toBe("boolean");
    expect(typeof me.permissions.contactsRead).toBe("boolean");
    expect(typeof me.permissions.contactsWrite).toBe("boolean");
    expect(typeof me.permissions.domainsRead).toBe("boolean");
  });

  it("surfaces an authentication failure as a 401 KazuniError", async () => {
    const kazuni = new Kazuni({ apiKey: "cl_test_invalid_00000000000000000000000000", baseUrl });

    let error: unknown;
    try {
      await kazuni.me();
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(KazuniError);
    expect((error as KazuniError).status).toBe(401);
  });
});
