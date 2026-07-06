import { jest } from "@jest/globals";
import { ServiceUnavailableError } from "../../src/common/errors/index.js";
import { GeminiTextClient } from "../../src/modules/tasks/magic-polish.client.js";

function geminiResponse(text: string, init: ResponseInit = { status: 200 }): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    init,
  );
}

describe("GeminiTextClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws ServiceUnavailableError without ever calling fetch when no API key is configured", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    const client = new GeminiTextClient({ apiKey: undefined, model: "gemini-2.5-flash" });

    await expect(client.polishTask({ title: "write report" })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the API key as a header, never a query param, and returns the parsed result", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        geminiResponse(JSON.stringify({ title: "Write the report", description: "- Draft\n- Review" })),
      );
    const client = new GeminiTextClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    const result = await client.polishTask({ title: "write report", description: "draft it" });

    expect(result).toEqual({ title: "Write the report", description: "- Draft\n- Review" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("test-key");
    expect(url).toContain("gemini-2.5-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("throws ServiceUnavailableError when the upstream call rejects (network error or timeout)", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const client = new GeminiTextClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    await expect(client.polishTask({ title: "write report" })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it("throws ServiceUnavailableError on a non-OK upstream response", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    const client = new GeminiTextClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    await expect(client.polishTask({ title: "write report" })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it("throws ServiceUnavailableError when the response has no candidate text", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    const client = new GeminiTextClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    await expect(client.polishTask({ title: "write report" })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it("throws ServiceUnavailableError when the candidate text is not valid JSON", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(geminiResponse("not json"));
    const client = new GeminiTextClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    await expect(client.polishTask({ title: "write report" })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });

  it("throws ServiceUnavailableError when the parsed JSON fails the response schema", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(geminiResponse(JSON.stringify({ title: "", description: "ok" })));
    const client = new GeminiTextClient({ apiKey: "test-key", model: "gemini-2.5-flash" });

    await expect(client.polishTask({ title: "write report" })).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );
  });
});
