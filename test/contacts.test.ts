import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Kazuni, KazuniError } from "../src/index";

const BASE_URL = "https://api.test.local";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const sampleContact = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  firstName: "Amara",
  lastName: "Diallo",
  metadata: { plan: "pro" },
  identifiers: [{ id: "id-1", type: "email", value: "amara@example.com", isPrimary: true }],
  subscriptions: { email: "subscribed", sms: "unsubscribed", whatsapp: "unsubscribed" },
  createdAt: "2026-07-19T10:00:00.000Z",
  updatedAt: "2026-07-19T10:00:00.000Z",
};

describe("kazuni.contacts", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let kazuni: Kazuni;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("create", () => {
    it("sends a POST request and returns the created contact", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(sampleContact, { status: 201 }));

      const result = await kazuni.contacts.create({
        identifiers: [{ type: "email", value: "amara@example.com", isPrimary: true }],
        firstName: "Amara",
        lastName: "Diallo",
        metadata: { plan: "pro" },
      });

      expect(result).toEqual(sampleContact);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts`);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        identifiers: [{ type: "email", value: "amara@example.com", isPrimary: true }],
        firstName: "Amara",
        lastName: "Diallo",
        metadata: { plan: "pro" },
      });
    });

    it("maps a 422 invalid-identifier response to a KazuniError", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "Invalid phone: not-a-number" }, { status: 422 }),
      );

      await expect(
        kazuni.contacts.create({
          identifiers: [{ type: "phone", value: "not-a-number" }],
        }),
      ).rejects.toMatchObject({
        name: "KazuniError",
        message: "Invalid phone: not-a-number",
        status: 422,
      });
    });

    it("maps a 403 missing-permission response to a KazuniError naming the permission", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          { error: "API key lacks required permission: contactsWrite" },
          { status: 403 },
        ),
      );

      await expect(
        kazuni.contacts.create({ identifiers: [{ type: "email", value: "a@example.com" }] }),
      ).rejects.toMatchObject({
        name: "KazuniError",
        message: "API key lacks required permission: contactsWrite",
        status: 403,
      });
    });

    it("maps a 409 conflict response to a KazuniError with code contact_conflict", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "contact_conflict" }, { status: 409 }));

      await expect(
        kazuni.contacts.create({
          identifiers: [{ type: "email", value: "amara@example.com" }],
        }),
      ).rejects.toMatchObject({ name: "KazuniError", status: 409, code: "contact_conflict" });
    });
  });

  describe("upsert", () => {
    it("sends a POST request to /v1/contacts/upsert and returns the contact", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(sampleContact, { status: 200 }));

      const result = await kazuni.contacts.upsert({
        identifiers: [{ type: "email", value: "amara@example.com" }],
      });

      expect(result).toEqual(sampleContact);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts/upsert`);
      expect(init.method).toBe("POST");
    });

    it("maps a 409 conflict response to a KazuniError with code contact_conflict", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "contact_conflict" }, { status: 409 }));

      let error: unknown;
      try {
        await kazuni.contacts.upsert({
          identifiers: [
            { type: "email", value: "amara@example.com" },
            { type: "phone", value: "+15551234567" },
          ],
        });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(KazuniError);
      expect((error as KazuniError).status).toBe(409);
      expect((error as KazuniError).code).toBe("contact_conflict");
    });
  });

  describe("get", () => {
    it("sends a GET request and returns the contact", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(sampleContact));

      const result = await kazuni.contacts.get(sampleContact.id);

      expect(result).toEqual(sampleContact);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts/${sampleContact.id}`);
      expect(init.method).toBe("GET");
    });

    it("maps a 404 response to a KazuniError", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "Contact not found" }, { status: 404 }),
      );

      await expect(kazuni.contacts.get("nonexistent")).rejects.toMatchObject({
        name: "KazuniError",
        message: "Contact not found",
        status: 404,
      });
    });
  });

  describe("list", () => {
    const listResponse = { data: [sampleContact], total: 1, page: 1, limit: 50 };

    it("sends a GET request with no query string when no params are given", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(listResponse));

      const result = await kazuni.contacts.list();

      expect(result).toEqual(listResponse);
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts`);
    });

    it("builds a query string from page, limit, q, and listId", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(listResponse));

      await kazuni.contacts.list({
        page: 2,
        limit: 10,
        q: "amara",
        listId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      });

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      const parsed = new URL(url);
      expect(parsed.pathname).toBe("/v1/contacts");
      expect(parsed.searchParams.get("page")).toBe("2");
      expect(parsed.searchParams.get("limit")).toBe("10");
      expect(parsed.searchParams.get("q")).toBe("amara");
      expect(parsed.searchParams.get("listId")).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
    });

    it("omits params that are not supplied", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(listResponse));

      await kazuni.contacts.list({ q: "amara" });

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      const parsed = new URL(url);
      expect([...parsed.searchParams.keys()]).toEqual(["q"]);
    });
  });

  describe("update", () => {
    it("sends a PATCH request and returns the updated contact", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ ...sampleContact, lastName: "Ochieng" }));

      const result = await kazuni.contacts.update(sampleContact.id, { lastName: "Ochieng" });

      expect(result.lastName).toBe("Ochieng");
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts/${sampleContact.id}`);
      expect(init.method).toBe("PATCH");
    });
  });

  describe("delete", () => {
    it("sends a DELETE request and resolves with no content", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(undefined, { status: 204 }));

      await expect(kazuni.contacts.delete(sampleContact.id)).resolves.toBeUndefined();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts/${sampleContact.id}`);
      expect(init.method).toBe("DELETE");
      expect(init.body).toBeUndefined();
    });

    it("maps a 404 response to a KazuniError", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "Contact not found" }, { status: 404 }),
      );

      await expect(kazuni.contacts.delete("nonexistent")).rejects.toMatchObject({
        name: "KazuniError",
        status: 404,
      });
    });
  });

  describe("addIdentifier", () => {
    it("sends a POST request and returns the updated contact", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(sampleContact, { status: 201 }));

      const result = await kazuni.contacts.addIdentifier(sampleContact.id, {
        type: "phone",
        value: "+15551234567",
      });

      expect(result).toEqual(sampleContact);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts/${sampleContact.id}/identifiers`);
      expect(init.method).toBe("POST");
    });

    it("maps a 409 conflict response to a KazuniError with code contact_conflict", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "contact_conflict" }, { status: 409 }));

      await expect(
        kazuni.contacts.addIdentifier(sampleContact.id, {
          type: "email",
          value: "taken@example.com",
        }),
      ).rejects.toMatchObject({ name: "KazuniError", status: 409, code: "contact_conflict" });
    });

    it("maps a 422 invalid-identifier response to a KazuniError", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "Invalid email: not-an-email" }, { status: 422 }),
      );

      await expect(
        kazuni.contacts.addIdentifier(sampleContact.id, { type: "email", value: "not-an-email" }),
      ).rejects.toMatchObject({ name: "KazuniError", status: 422 });
    });
  });

  describe("removeIdentifier", () => {
    it("sends a DELETE request and returns the updated contact", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(sampleContact));

      const result = await kazuni.contacts.removeIdentifier(sampleContact.id, "id-1");

      expect(result).toEqual(sampleContact);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts/${sampleContact.id}/identifiers/id-1`);
      expect(init.method).toBe("DELETE");
    });

    it("maps a 422 last-identifier response to a KazuniError", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "Invalid email: amara@example.com" }, { status: 422 }),
      );

      await expect(
        kazuni.contacts.removeIdentifier(sampleContact.id, "id-1"),
      ).rejects.toMatchObject({ name: "KazuniError", status: 422 });
    });
  });

  describe("setSubscription", () => {
    it("sends a PUT request and returns the updated contact", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          ...sampleContact,
          subscriptions: { ...sampleContact.subscriptions, sms: "unsubscribed" },
        }),
      );

      const result = await kazuni.contacts.setSubscription(sampleContact.id, "sms", {
        status: "unsubscribed",
        source: "reply_stop",
      });

      expect(result.subscriptions.sms).toBe("unsubscribed");
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/v1/contacts/${sampleContact.id}/subscriptions/sms`);
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body as string)).toEqual({
        status: "unsubscribed",
        source: "reply_stop",
      });
    });
  });
});
