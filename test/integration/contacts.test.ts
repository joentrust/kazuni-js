import { describe, expect, it } from "vitest";
import { Kazuni, KazuniError } from "../../src/index";

/**
 * Opt-in integration tests that make real HTTP calls against a running Kazuni API. They are
 * skipped unless both KAZUNI_TEST_BASE_URL and KAZUNI_TEST_API_KEY are set, so `pnpm test` and
 * CI never need secrets or a live server. See CONTRIBUTING.md ("Testing against a local Kazuni
 * API") for how to stand up a local API and obtain a key. The key needs both the `contactsRead`
 * and `contactsWrite` permissions for these tests to pass.
 */
const baseUrl = process.env.KAZUNI_TEST_BASE_URL;
const apiKey = process.env.KAZUNI_TEST_API_KEY;
const canRun = Boolean(baseUrl && apiKey);

describe.skipIf(!canRun)("integration", () => {
  it("creates, retrieves, updates, and deletes a contact", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });
    const email = `kazuni-js-integration-${Date.now()}@example.com`;

    const created = await kazuni.contacts.create({
      identifiers: [{ type: "email", value: email, isPrimary: true }],
      firstName: "Integration",
      lastName: "Test",
    });

    expect(created.firstName).toBe("Integration");
    expect(created.identifiers).toHaveLength(1);
    expect(created.identifiers[0]?.value).toBe(email.toLowerCase());

    const fetched = await kazuni.contacts.get(created.id);
    expect(fetched.id).toBe(created.id);

    const updated = await kazuni.contacts.update(created.id, { lastName: "Updated" });
    expect(updated.lastName).toBe("Updated");

    const withPhone = await kazuni.contacts.addIdentifier(created.id, {
      type: "phone",
      value: "+15551234567",
    });
    expect(withPhone.identifiers).toHaveLength(2);

    const phoneIdentifier = withPhone.identifiers.find((identifier) => identifier.type === "phone");
    expect(phoneIdentifier).toBeDefined();
    if (phoneIdentifier) {
      const withoutPhone = await kazuni.contacts.removeIdentifier(created.id, phoneIdentifier.id);
      expect(withoutPhone.identifiers).toHaveLength(1);
    }

    const unsubscribed = await kazuni.contacts.setSubscription(created.id, "sms", {
      status: "unsubscribed",
      source: "api",
    });
    expect(unsubscribed.subscriptions.sms).toBe("unsubscribed");

    await kazuni.contacts.delete(created.id);

    let error: unknown;
    try {
      await kazuni.contacts.get(created.id);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(KazuniError);
    expect((error as KazuniError).status).toBe(404);
  });

  it("upserts a contact by matching an existing identifier", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });
    const email = `kazuni-js-integration-upsert-${Date.now()}@example.com`;

    const created = await kazuni.contacts.upsert({
      identifiers: [{ type: "email", value: email }],
      firstName: "Before",
    });

    const matched = await kazuni.contacts.upsert({
      identifiers: [{ type: "email", value: email }],
      firstName: "After",
    });

    expect(matched.id).toBe(created.id);
    expect(matched.firstName).toBe("After");

    await kazuni.contacts.delete(created.id);
  });

  it("lists contacts and paginates with page/limit/q", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });
    const email = `kazuni-js-integration-list-${Date.now()}@example.com`;

    const created = await kazuni.contacts.create({
      identifiers: [{ type: "email", value: email }],
    });

    const page = await kazuni.contacts.list({ page: 1, limit: 5, q: email });
    expect(page.data.some((contact) => contact.id === created.id)).toBe(true);
    expect(page.page).toBe(1);
    expect(page.limit).toBe(5);

    await kazuni.contacts.delete(created.id);
  });

  it("surfaces a 409 conflict when upserted identifiers resolve to two different contacts", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });
    const emailA = `kazuni-js-integration-conflict-a-${Date.now()}@example.com`;
    const emailB = `kazuni-js-integration-conflict-b-${Date.now()}@example.com`;

    const contactA = await kazuni.contacts.create({
      identifiers: [{ type: "email", value: emailA }],
    });
    const contactB = await kazuni.contacts.create({
      identifiers: [{ type: "email", value: emailB }],
    });

    let error: unknown;
    try {
      await kazuni.contacts.upsert({
        identifiers: [
          { type: "email", value: emailA },
          { type: "email", value: emailB },
        ],
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(KazuniError);
    expect((error as KazuniError).status).toBe(409);
    expect((error as KazuniError).code).toBe("contact_conflict");

    await kazuni.contacts.delete(contactA.id);
    await kazuni.contacts.delete(contactB.id);
  });

  it("surfaces a 422 for an unparseable phone number", async () => {
    const kazuni = new Kazuni({ apiKey: apiKey as string, baseUrl });

    let error: unknown;
    try {
      await kazuni.contacts.create({
        identifiers: [{ type: "phone", value: "not-a-phone-number" }],
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(KazuniError);
    expect((error as KazuniError).status).toBe(422);
  });
});
