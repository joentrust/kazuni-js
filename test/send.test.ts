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

describe("kazuni.send.email", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a request with auth header and returns the parsed response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "email_123", status: "queued" }, { status: 202 }),
    );

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });
    const result = await kazuni.send.email({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Welcome",
      html: "<p>hi</p>",
    });

    expect(result).toEqual({ id: "email_123", status: "queued" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/emails/send`);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer cl_test_key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toBeUndefined();
  });

  it("maps a 401 response to a KazuniError", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Invalid API key" }, { status: 401 }));

    const kazuni = new Kazuni({ apiKey: "cl_bad_key", baseUrl: BASE_URL });

    await expect(
      kazuni.send.email({
        from: "hello@example.com",
        to: "user@example.com",
        subject: "Welcome",
        html: "<p>hi</p>",
      }),
    ).rejects.toMatchObject({
      name: "KazuniError",
      message: "Invalid API key",
      status: 401,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on 429 when an idempotency key is provided, then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "Rate limit exceeded" },
          { status: 429, headers: { "retry-after": "0" } },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "email_456", status: "queued" }, { status: 202 }));

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL, maxRetries: 2 });
    const result = await kazuni.send.email(
      {
        from: "hello@example.com",
        to: "user@example.com",
        subject: "Welcome",
        html: "<p>hi</p>",
      },
      { idempotencyKey: "idem-1" },
    );

    expect(result).toEqual({ id: "email_456", status: "queued" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries and throws a KazuniError after repeated 500s", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Internal server error" }, { status: 500 }));

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL, maxRetries: 2 });

    await expect(
      kazuni.send.email(
        {
          from: "hello@example.com",
          to: "user@example.com",
          subject: "Welcome",
          html: "<p>hi</p>",
        },
        { idempotencyKey: "idem-2" },
      ),
    ).rejects.toBeInstanceOf(KazuniError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 500 on a POST without an idempotency key", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Internal server error" }, { status: 500 }));

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL, maxRetries: 2 });

    await expect(
      kazuni.send.email({
        from: "hello@example.com",
        to: "user@example.com",
        subject: "Welcome",
        html: "<p>hi</p>",
      }),
    ).rejects.toBeInstanceOf(KazuniError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes the Idempotency-Key header through to the request", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "email_789", status: "queued" }, { status: 202 }),
    );

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });
    await kazuni.send.email(
      {
        from: "hello@example.com",
        to: "user@example.com",
        subject: "Welcome",
        html: "<p>hi</p>",
      },
      { idempotencyKey: "my-idempotency-key" },
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("my-idempotency-key");
  });
});

describe("kazuni.send.sms", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to /v1/messages/send with channel sms and returns the ack", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "msg_1", channel: "sms", status: "queued" }, { status: 202 }),
    );

    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });
    const result = await kazuni.send.sms({ from: "Kazuni", to: "+265991234567", text: "hi" });

    expect(result).toEqual({ id: "msg_1", channel: "sms", status: "queued" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/v1/messages/send`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      channel: "sms",
      from: "Kazuni",
      to: "+265991234567",
      text: "hi",
    });
  });

  it("surfaces a warning on the ack when present", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { id: "msg_2", channel: "sms", status: "queued", warning: "sender ID unconfirmed" },
        { status: 202 },
      ),
    );
    const kazuni = new Kazuni({ apiKey: "cl_test_key", baseUrl: BASE_URL });
    const result = await kazuni.send.sms({ from: "Kazuni", to: "+265991234567", text: "hi" });
    expect(result.warning).toBe("sender ID unconfirmed");
  });
});
