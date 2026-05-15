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

export const listRunsForProject = async (_projectId: string, _limit: number): Promise<MobileRunSummary[]> => {
  return [];
};

export const getRunByIdForUser = async (
  _runId: string,
  _userId: string,
  _sessionProjectId: string | null
): Promise<MobileRunDetail | null> => {
  return null;
};
