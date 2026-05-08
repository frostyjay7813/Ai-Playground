export type Provider = "openai" | "anthropic" | "google";

export type CreateRunInput = {
  projectId: string;
  conversationId?: string;
  prompt: string;
  provider: Provider;
  model: string;
  temperature?: number;
};

export type Run = {
  id: string;
  projectId: string;
  conversationId: string;
  provider: Provider;
  model: string;
  prompt: string;
  temperature: number;
  status: "queued" | "running" | "completed" | "failed";
  outputText: string;
  errorText: string | null;
  createdAt: string;
  completedAt: string | null;
};
