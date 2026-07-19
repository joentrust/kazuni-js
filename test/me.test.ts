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

describe("kazuni.me", () => {
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
        organizationId: "org_abc123",
        mode: "test",
        permissions: {
          send: true,
          contactsRead: false,
          contactsWrite: false,
          domainsRead: true,
        },
      }),
    );

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });
    const result = await kazuni.me();

    expect(result).toEqual({
      organizationId: "org_abc123",
      mode: "test",
      permissions: {
        send: true,
        contactsRead: false,
        contactsWrite: false,
        domainsRead: true,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/me`);
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer cl_test_key");
  });

  it("maps a 401 response to a KazuniError", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Invalid API key" }, { status: 401 }));

    const kazuni = new Kazuni({ apiKey: "cl_bad_key", baseUrl: BASE_URL });
    const result = kazuni.me();

    await expect(result).rejects.toBeInstanceOf(KazuniError);
    await expect(result).rejects.toMatchObject({
      name: "KazuniError",
      message: "Invalid API key",
      status: 401,
    });
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
          organizationId: "org_abc123",
          mode: "live",
          permissions: {
            send: true,
            contactsRead: true,
            contactsWrite: true,
            domainsRead: true,
          },
        }),
      );

    const kazuni = new Kazuni({ apiKey: "cl_live_key", baseUrl: BASE_URL, maxRetries: 2 });
    const result = await kazuni.me();

    expect(result.mode).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries and throws a KazuniError after repeated 500s", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Internal server error" }, { status: 500 }));

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL, maxRetries: 2 });

    await expect(kazuni.me()).rejects.toBeInstanceOf(KazuniError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
