import {
  AIProviderError,
  type AIMessage,
  type AIProvider,
  type GenerateRequest,
  type GenerateResult,
} from "./provider";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 30_000;

type GeminiRole = "user" | "model";

type GeminiPart = { text?: string };

type GeminiContent = { role: GeminiRole; parts: GeminiPart[] };

type GeminiGenerateContentResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
  }[];
  promptFeedback?: { blockReason?: string };
};

function toGeminiRole(role: AIMessage["role"]): GeminiRole {
  return role === "assistant" ? "model" : "user";
}

/**
 * Native-`fetch` client for the Gemini API. No SDK dependency — the response
 * body and API key never reach the caller; only a typed `AIProviderError`
 * (or the extracted text) crosses this boundary.
 */
export class GeminiProvider implements AIProvider {
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AIProviderError(
        "NOT_CONFIGURED",
        "The AI assistant is not configured. Set GEMINI_API_KEY to enable it.",
      );
    }

    const contents: GeminiContent[] = request.messages.map((message) => ({
      role: toGeminiRole(message.role),
      parts: [{ text: message.content }],
    }));

    let response: Response;
    try {
      response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: request.system }] },
          contents,
          generationConfig: {
            temperature: request.temperature ?? 0.2,
            responseMimeType: "application/json",
            responseSchema: request.responseSchema,
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new AIProviderError(
          "TIMEOUT",
          "The AI assistant took too long to respond. Please try again.",
        );
      }
      throw new AIProviderError(
        "UPSTREAM",
        "Could not reach the AI assistant. Please try again.",
      );
    }

    if (response.status === 429) {
      throw new AIProviderError(
        "RATE_LIMITED",
        "The AI assistant is rate limited right now (free-tier quota). Please wait a minute and try again.",
      );
    }

    if (!response.ok) {
      throw new AIProviderError(
        "UPSTREAM",
        "The AI assistant returned an error. Please try again.",
      );
    }

    let data: GeminiGenerateContentResponse;
    try {
      data = (await response.json()) as GeminiGenerateContentResponse;
    } catch {
      throw new AIProviderError(
        "UPSTREAM",
        "The AI assistant returned an unreadable response.",
      );
    }

    if (data.promptFeedback?.blockReason) {
      throw new AIProviderError(
        "UPSTREAM",
        "The AI assistant declined to respond to that message.",
      );
    }

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("");
    if (!text) {
      throw new AIProviderError(
        "UPSTREAM",
        "The AI assistant did not return a response.",
      );
    }

    return { text };
  }
}
