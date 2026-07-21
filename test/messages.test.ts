import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Kazuni, KazuniError } from "../src/index";

const BASE_URL = "https://api.test.local";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("kazuni.messages.get", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a GET request with auth header and returns the parsed response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "email_123",
        from: "hello@example.com",
        to: "user@example.com",
        subject: "Welcome",
        status: "delivered",
        error: null,
        queuedAt: "2026-07-19T10:00:00.000Z",
        sentAt: "2026-07-19T10:00:01.000Z",
        deliveredAt: "2026-07-19T10:00:05.000Z",
      }),
    );

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });
    const result = await kazuni.messages.get("email_123");

    expect(result).toEqual({
      id: "email_123",
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Welcome",
      status: "delivered",
      error: null,
      queuedAt: "2026-07-19T10:00:00.000Z",
      sentAt: "2026-07-19T10:00:01.000Z",
      deliveredAt: "2026-07-19T10:00:05.000Z",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/messages/email_123`);
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer cl_test_key");
  });

  it("URL-encodes the id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "id/with slash",
        from: "hello@example.com",
        to: "user@example.com",
        subject: "Welcome",
        status: "queued",
        error: null,
        queuedAt: "2026-07-19T10:00:00.000Z",
        sentAt: null,
        deliveredAt: null,
      }),
    );

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });
    await kazuni.messages.get("id/with slash");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/messages/id%2Fwith%20slash`);
  });

  it("maps a 404 response to a KazuniError", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Email not found" }, { status: 404 }));

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });

    await expect(kazuni.messages.get("nonexistent")).rejects.toMatchObject({
      name: "KazuniError",
      message: "Email not found",
      status: 404,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a 404 response to a KazuniError instance", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Email not found" }, { status: 404 }));

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });

    await expect(kazuni.messages.get("nonexistent")).rejects.toBeInstanceOf(KazuniError);
  });

  it("retries on 429 without an idempotency key, then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "Rate limit exceeded" },
          { status: 429, headers: { "retry-after": "0" } },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "email_456",
          from: "hello@example.com",
          to: "user@example.com",
          subject: "Welcome",
          status: "sent",
          error: null,
          queuedAt: "2026-07-19T10:00:00.000Z",
          sentAt: "2026-07-19T10:00:01.000Z",
          deliveredAt: null,
        }),
      );

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL, maxRetries: 2 });
    const result = await kazuni.messages.get("email_456");

    expect(result.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries and throws a KazuniError after repeated 500s", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Internal server error" }, { status: 500 }));

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL, maxRetries: 2 });

    await expect(kazuni.messages.get("email_789")).rejects.toBeInstanceOf(KazuniError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
