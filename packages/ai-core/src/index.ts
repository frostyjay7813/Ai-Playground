import { z } from "zod";
import type { CreateRunInput, Run } from "@ai-playground/sdk";

export const createRunSchema = z.object({
  projectId: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(12000),
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7),
});

export const createRun = (input: CreateRunInput): Run => {
  const payload = createRunSchema.parse(input);
  return {
    id: crypto.randomUUID(),
    projectId: payload.projectId,
    conversationId: payload.conversationId ?? crypto.randomUUID(),
    provider: payload.provider,
    model: payload.model,
    prompt: payload.prompt,
    temperature: payload.temperature,
    status: "queued",
    outputText: "",
    errorText: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
};

const getText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(getText).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(getText)
      .filter(Boolean)
      .join(" ");
  }
  return "";
};

export const executeModel = async (
  run: Pick<Run, "provider" | "model" | "prompt"> & { apiKey?: string }
): Promise<string> => {
  if (run.provider === "openai") {
    const key = run.apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Missing OPENAI_API_KEY");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: run.model,
        input: run.prompt,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
    const data = (await response.json()) as { output_text?: string; output?: unknown };
    return data.output_text ?? getText(data.output).trim();
  }

  if (run.provider === "anthropic") {
    const key = run.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: run.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: run.prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API error ${response.status}`);
    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    return (data.content ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }

  if (run.provider === "google") {
    const key = run.apiKey ?? process.env.GOOGLE_API_KEY;
    if (!key) throw new Error("Missing GOOGLE_API_KEY");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(run.model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: run.prompt }] }],
        }),
      }
    );
    if (!response.ok) throw new Error(`Google API error ${response.status}`);
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return (data.candidates ?? [])
      .flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }

  throw new Error(`Unsupported provider: ${run.provider}`);
};
