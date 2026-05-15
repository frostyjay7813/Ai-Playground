import type {
  ExchangePhoneLinkInput,
  MobileInboxListResponse,
  MobileProjectListResponse,
  MobileRunDetailResponse,
  MobileRunListResponse,
  MobileSessionResponse,
  PostInboxMessageInput,
} from "@ai-playground/mobile-sdk";

type ApiClientOptions = {
  baseUrl: string;
  getSessionToken: () => Promise<string | null> | string | null;
  onUnauthorized?: () => Promise<void> | void;
};

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export const createApiClient = ({ baseUrl, getSessionToken, onUnauthorized }: ApiClientOptions) => {
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await getSessionToken();
    const headers = new Headers(init.headers);

    if (!headers.has("content-type") && init.body) {
      headers.set("content-type", "application/json");
    }

    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await response.json() : await response.text();

    if (response.status === 401 && onUnauthorized) {
      await onUnauthorized();
    }

    if (!response.ok) {
      const message =
        typeof body === "object" && body && "error" in body
          ? String((body as { error?: unknown }).error ?? "Request failed")
          : `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, body);
    }

    return body as T;
  };

  return {
    getMobileSession() {
      return request<MobileSessionResponse>("/mobile/session");
    },

    exchangePhoneLink(input: ExchangePhoneLinkInput) {
      return request<MobileSessionResponse>("/mobile/session/phone", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    logout() {
      return request<{ ok: true }>("/mobile/session/logout", {
        method: "POST",
      });
    },

    listProjects() {
      return request<MobileProjectListResponse>("/mobile/projects");
    },

    listInbox(projectId: string) {
      return request<MobileInboxListResponse>(`/mobile/projects/${encodeURIComponent(projectId)}/inbox`);
    },

    postInboxMessage(projectId: string, input: PostInboxMessageInput) {
      return request<{ message: MobileInboxListResponse["messages"][number] }>(
        `/mobile/projects/${encodeURIComponent(projectId)}/inbox`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      );
    },

    listRuns(projectId: string, limit = 20) {
      return request<MobileRunListResponse>(`/mobile/projects/${encodeURIComponent(projectId)}/runs?limit=${limit}`);
    },

    getRun(runId: string) {
      return request<MobileRunDetailResponse>(`/mobile/runs/${encodeURIComponent(runId)}`);
    },
  };
};
