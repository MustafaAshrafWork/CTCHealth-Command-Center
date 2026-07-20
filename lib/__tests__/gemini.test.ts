import { afterEach, describe, expect, it, vi } from "vitest";

import { AIProviderError } from "../ai/provider";
import { GeminiProvider } from "../ai/gemini";

const baseRequest = {
  system: "You are a test assistant.",
  messages: [{ role: "user" as const, content: "Hello" }],
};

const originalApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalApiKey;
  }
  vi.unstubAllGlobals();
});

describe("GeminiProvider", () => {
  it("rejects with NOT_CONFIGURED and never calls fetch when the key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiProvider();
    await expect(provider.generate(baseRequest)).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects with UPSTREAM on a non-2xx response", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("server error", { status: 500 }),
      ),
    );

    const provider = new GeminiProvider();
    await expect(provider.generate(baseRequest)).rejects.toMatchObject({
      code: "UPSTREAM",
    });
  });

  it("rejects with TIMEOUT when the request aborts due to a timeout", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")),
    );

    const provider = new GeminiProvider();
    await expect(provider.generate(baseRequest)).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });

  it("extracts the response text and sends the key only in the header", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: '{"message":"hi","status":"collecting","draft":null}' }],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const responseSchema = { type: "OBJECT", properties: {} };
    const provider = new GeminiProvider();
    const result = await provider.generate({ ...baseRequest, responseSchema });

    expect(result.text).toBe(
      '{"message":"hi","status":"collecting","draft":null}',
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");

    const requestBody = JSON.parse(init.body as string);
    expect(requestBody.generationConfig.responseMimeType).toBe(
      "application/json",
    );
    expect(requestBody.generationConfig.responseSchema).toEqual(responseSchema);
  });

  it("rejects with UPSTREAM when no candidate text is returned", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ candidates: [] })),
    );

    const provider = new GeminiProvider();
    await expect(provider.generate(baseRequest)).rejects.toMatchObject({
      code: "UPSTREAM",
    });
  });
});

describe("AIProviderError", () => {
  it("carries a stable error code", () => {
    const error = new AIProviderError("INVALID_RESPONSE", "bad shape");
    expect(error.code).toBe("INVALID_RESPONSE");
    expect(error.message).toBe("bad shape");
  });
});
