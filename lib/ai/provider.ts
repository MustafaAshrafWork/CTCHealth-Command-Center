export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateRequest = {
  system: string;
  messages: AIMessage[];
  responseSchema?: Record<string, unknown>;
  temperature?: number;
};

export type GenerateResult = { text: string };

export interface AIProvider {
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export type AIProviderErrorCode =
  | "NOT_CONFIGURED"
  | "TIMEOUT"
  | "UPSTREAM"
  | "RATE_LIMITED"
  | "INVALID_RESPONSE";

export class AIProviderError extends Error {
  constructor(
    public readonly code: AIProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
