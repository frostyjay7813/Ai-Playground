export type RunStatus = "queued" | "running" | "completed" | "failed";

export type MobileRunSummary = {
  id: string;
  conversationId: string;
  provider: "openai" | "anthropic" | "google";
  model: string;
  status: RunStatus;
  promptPreview: string;
  createdAt: string;
  completedAt: string | null;
};

export type MobileRunDetail = {
  id: string;
  projectId: string;
  conversationId: string;
  provider: "openai" | "anthropic" | "google";
  model: string;
  prompt: string;
  status: RunStatus;
  outputText: string;
  errorText: string | null;
  createdAt: string;
  completedAt: string | null;
};

const now = new Date().toISOString();
const runStore = new Map<string, MobileRunDetail[]>([
  [
    "default",
    [
      {
        id: "run_default_1",
        projectId: "default",
        conversationId: "conv_default_1",
        provider: "openai",
        model: "gpt-4.1-mini",
        prompt: "Design an agent workflow.",
        status: "completed",
        outputText: "Here is a proposed workflow...",
        errorText: null,
        createdAt: now,
        completedAt: now,
      },
    ],
  ],
]);

export const listRunsForProject = async (projectId: string, limit: number): Promise<MobileRunSummary[]> => {
  return (runStore.get(projectId) ?? []).slice(0, limit).map((run) => ({
    id: run.id,
    conversationId: run.conversationId,
    provider: run.provider,
    model: run.model,
    status: run.status,
    promptPreview: run.prompt.slice(0, 120),
    createdAt: run.createdAt,
    completedAt: run.completedAt,
  }));
};

export const getRunByIdForUser = async (
  runId: string,
  _userId: string,
  sessionProjectId: string | null
): Promise<MobileRunDetail | null> => {
  if (sessionProjectId) {
    const run = (runStore.get(sessionProjectId) ?? []).find((candidate) => candidate.id === runId);
    return run ?? null;
  }

  for (const runs of runStore.values()) {
    const run = runs.find((candidate) => candidate.id === runId);
    if (run) return run;
  }

  return null;
};
