import type { MagicPolishRequest, MagicPolishResponse } from "@task-tracker/shared-types";
import { magicPolishResponseSchema } from "@task-tracker/shared-types";
import { env } from "../../common/config/env.js";
import { ServiceUnavailableError } from "../../common/errors/index.js";
import { logger } from "../../common/logging/logger.js";

export interface AiTextClient {
  polishTask(input: MagicPolishRequest): Promise<MagicPolishResponse>;
}

const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Single-shot, stateless reformatting — no conversation history, no tool/function-calling
// access. Kept short and fixed so every call spends its tokens on the task text, not the
// instructions describing what to do with it.
const SYSTEM_INSTRUCTION =
  "You reformat a task's title and description for a project management tool. Return a " +
  "concise, action-oriented title (max 200 characters) and a clear description (max 2000 " +
  "characters), using a short bulleted list if it contains multiple action items. Fix grammar " +
  "and tone. Do not invent facts, deadlines, owners, or scope not present in the input. If the " +
  "description is empty, write one concise professional sentence restating the title. Respond " +
  "only with the requested JSON, nothing else.";

// Bounds cost and latency per call — this is a formatting task, not one needing a long or
// creative response. Low temperature favors a consistent, professional tone over variety.
const GENERATION_CONFIG = {
  temperature: 0.3,
  maxOutputTokens: 500,
  responseMimeType: "application/json",
  responseSchema: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      description: { type: "STRING" },
    },
    required: ["title", "description"],
  },
};

const REQUEST_TIMEOUT_MS = 10_000;

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function buildPrompt(input: MagicPolishRequest): string {
  const trimmed = input.description?.trim();
  const description = trimmed && trimmed.length > 0 ? trimmed : "(none provided)";
  return `Title: ${input.title}\nDescription: ${description}`;
}

export interface GeminiTextClientConfig {
  apiKey: string | undefined;
  model: string;
}

// Talks to Gemini over plain fetch rather than an SDK — a single-shot generateContent call is a
// handful of lines of HTTP, and pulling in a whole client library for that would be dead weight
// (flagged rather than added silently, per this repo's dependency rule).
//
// Config is constructor-injected (defaulting from env) rather than read from env inline in the
// method — same reasoning as every repository/service in this codebase taking its dependencies
// through the constructor: it's what makes the "key not configured" branch unit-testable
// without reaching for module mocking.
export class GeminiTextClient implements AiTextClient {
  constructor(
    private readonly config: GeminiTextClientConfig = { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL },
  ) {}

  async polishTask(input: MagicPolishRequest): Promise<MagicPolishResponse> {
    if (!this.config.apiKey) {
      throw new ServiceUnavailableError("AI polish is not configured on this server");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${GEMINI_ENDPOINT_BASE}/${this.config.model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Header, not a `?key=` query param — keeps the key out of any URL that might end up
          // in a log line, error message, or fetch-internal trace.
          "x-goog-api-key": this.config.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          generationConfig: GENERATION_CONFIG,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      logger.warn({ err: error }, "magic-polish: gemini request failed");
      throw new ServiceUnavailableError("AI polish is temporarily unavailable");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Never forward the upstream body to the caller — it's ours to log, not theirs to see.
      logger.warn({ status: response.status }, "magic-polish: gemini returned a non-OK response");
      throw new ServiceUnavailableError("AI polish is temporarily unavailable");
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      logger.warn("magic-polish: gemini response had no content");
      throw new ServiceUnavailableError("AI polish is temporarily unavailable");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      logger.warn({ err: error }, "magic-polish: gemini response was not valid JSON");
      throw new ServiceUnavailableError("AI polish is temporarily unavailable");
    }

    const result = magicPolishResponseSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn({ issues: result.error.issues }, "magic-polish: gemini response failed validation");
      throw new ServiceUnavailableError("AI polish is temporarily unavailable");
    }

    return result.data;
  }
}
