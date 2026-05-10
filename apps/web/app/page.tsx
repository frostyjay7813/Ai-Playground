"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Provider, Run } from "@ai-playground/sdk";
import QRCode from "react-qr-code";

const providers: Provider[] = ["openai", "anthropic", "google"];
type ToolSummary = {
  name: string;
  description: string;
};

type ToolInvocation = {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  status: "completed" | "failed";
  errorText: string | null;
  createdAt: string;
};

type ToolPermission = ToolSummary & {
  enabled: boolean;
  updatedAt: string | null;
};

type ProjectMember = {
  projectId: string;
  userId: string;
  displayName: string;
  role: "owner" | "editor" | "viewer";
  createdAt: string;
};

type InboxMessage = {
  id: string;
  projectId: string;
  userId: string;
  body: string;
  status: "open" | "working" | "done";
  createdAt: string;
  updatedAt: string;
};

type PhoneLink = {
  projectId: string;
  phoneToken: string;
  expiresAt?: string;
  shareUrl: string;
};

type PhoneLinkStatus = {
  projectId: string;
  configured: boolean;
  twilioConfigured?: boolean;
  createdAt?: string;
  rotatedAt?: string;
  lastUsedAt?: string;
  expiresAt?: string;
  lastSmsSentAt?: string;
  lastSmsTo?: string;
};

type AuthSession =
  | {
      authenticated: true;
      userId: string;
      displayName: string;
      provider: string | null;
      avatarUrl: string | null;
      profileUrl: string | null;
    }
  | {
      authenticated: false;
    };

const defaultToolInput = (toolName: string) => {
  if (toolName === "math.evaluate") return JSON.stringify({ expression: "2 * (8 + 4)" }, null, 2);
  if (toolName === "text.summarize") {
    return JSON.stringify(
      {
        text: "AI Playground is evolving into a project-scoped agent workspace. It can store provider keys, queue model runs, stream output, and audit tool calls.",
        maxSentences: 2,
      },
      null,
      2
    );
  }
  return JSON.stringify({ timezone: "America/Chicago" }, null, 2);
};

const userIdStorageKey = "ai-playground.user-id";

const formatDuration = (milliseconds: number) => {
  if (milliseconds <= 0) return "expired";
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
};

export default function HomePage() {
  const [userId, setUserId] = useState("local");
  const [authSession, setAuthSession] = useState<AuthSession>({ authenticated: false });
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [projectId, setProjectId] = useState("default");
  const [conversationId, setConversationId] = useState<string>("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [keyProvider, setKeyProvider] = useState<Provider>("openai");
  const [providerKey, setProviderKey] = useState("");
  const [configuredProviders, setConfiguredProviders] = useState<string[]>([]);
  const [model, setModel] = useState("gpt-4.1-mini");
  const [prompt, setPrompt] = useState("Design an agentic architecture for my idea.");
  const [temperature, setTemperature] = useState(0.7);
  const [runs, setRuns] = useState<Run[]>([]);
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [toolPermissions, setToolPermissions] = useState<ToolPermission[]>([]);
  const [selectedTool, setSelectedTool] = useState("time.now");
  const [toolInput, setToolInput] = useState(defaultToolInput("time.now"));
  const [toolInvocations, setToolInvocations] = useState<ToolInvocation[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<ProjectMember["role"]>("viewer");
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxBody, setInboxBody] = useState("");
  const [phoneToken, setPhoneToken] = useState("");
  const [phoneMode, setPhoneMode] = useState(false);
  const [phoneLink, setPhoneLink] = useState<PhoneLink | null>(null);
  const [phoneLinkStatus, setPhoneLinkStatus] = useState<PhoneLinkStatus | null>(null);
  const [phoneSmsTo, setPhoneSmsTo] = useState("");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const webBase = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://localhost:3000";

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryProject = searchParams.get("projectId");
    const queryToken = searchParams.get("token") ?? "";
    const queryPhone = searchParams.get("phone") === "1";
    if (queryProject) {
      setProjectId(queryProject);
    }
    if (queryToken) {
      setPhoneToken(queryToken);
    }
    setPhoneMode(queryPhone || Boolean(queryToken));
    const storedUserId = window.localStorage.getItem(userIdStorageKey);
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(userIdStorageKey, userId);
  }, [userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadProviderKeys = async (project: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(project)}/provider-keys`,
      { headers: { "x-ai-user-id": userId } }
    );
    if (!res.ok) return;
    const payload = (await res.json()) as Array<{ provider: string }>;
    setConfiguredProviders(payload.map((item) => item.provider));
  };

  const loadTools = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/tools`);
    if (!res.ok) return;
    const payload = (await res.json()) as ToolSummary[];
    setTools(payload);
    if (payload.length > 0 && !payload.some((tool) => tool.name === selectedTool)) {
      setSelectedTool(payload[0].name);
      setToolInput(defaultToolInput(payload[0].name));
    }
  };

  const loadToolInvocations = async (project: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(project)}/tools/invocations`,
      { headers: { "x-ai-user-id": userId } }
    );
    if (!res.ok) {
      setToolInvocations([]);
      return;
    }
    setToolInvocations((await res.json()) as ToolInvocation[]);
  };

  const loadToolPermissions = async (project: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(project)}/tools/permissions`,
      { headers: { "x-ai-user-id": userId } }
    );
    if (!res.ok) {
      setToolPermissions([]);
      return;
    }
    setToolPermissions((await res.json()) as ToolPermission[]);
  };

  const loadMembers = async (project: string) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(project)}/members`,
      { headers: { "x-ai-user-id": userId } }
    );
    if (!res.ok) {
      setMembers([]);
      return;
    }
    setMembers((await res.json()) as ProjectMember[]);
  };

  const loadInbox = async (project: string) => {
    const res = await fetch(
      phoneToken
        ? `${apiBase}/phone/projects/${encodeURIComponent(project)}/inbox?token=${encodeURIComponent(phoneToken)}`
        : `${apiBase}/projects/${encodeURIComponent(project)}/inbox`,
      phoneToken ? undefined : { headers: { "x-ai-user-id": userId } }
    );
    if (!res.ok) {
      setInboxMessages([]);
      return;
    }
    setInboxMessages((await res.json()) as InboxMessage[]);
  };

  const loadPhoneLinkStatus = async (project: string) => {
    const res = await fetch(`${apiBase}/projects/${encodeURIComponent(project)}/phone-link`, {
      headers: { "x-ai-user-id": userId },
    });
    if (!res.ok) {
      setPhoneLinkStatus(null);
      return;
    }
    setPhoneLinkStatus((await res.json()) as PhoneLinkStatus);
  };

  const loadAuthSession = async () => {
    const res = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    if (!res.ok) {
      setAuthSession({ authenticated: false });
      if (userId.startsWith("github:")) {
        setUserId("local");
      }
      return;
    }
    const payload = (await res.json()) as AuthSession;
    setAuthSession(payload);
    if (payload.authenticated) {
      setUserId(payload.userId);
    }
  };

  const loadGithubConfig = async () => {
    const res = await fetch(`${apiBase}/auth/github/config`);
    if (!res.ok) return;
    const payload = (await res.json()) as { configured: boolean };
    setGithubConfigured(payload.configured);
  };

  useEffect(() => {
    void loadAuthSession();
  }, []);

  useEffect(() => {
    if (!phoneMode) {
      void loadProviderKeys(projectId);
      void loadToolInvocations(projectId);
      void loadToolPermissions(projectId);
      void loadMembers(projectId);
      void loadPhoneLinkStatus(projectId);
    }
    void loadInbox(projectId);
  }, [projectId, userId, phoneMode, phoneToken]);

  useEffect(() => {
    void loadTools();
    void loadGithubConfig();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const payload = { projectId, conversationId: conversationId || undefined, provider, model, prompt, temperature };
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/chat/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ai-user-id": userId },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError(`Run request failed (${res.status})`);
      return;
    }
    const createdRun = (await res.json()) as Run;
    setConversationId(createdRun.conversationId);
    setRuns((prev) => [...prev, createdRun]);

    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/chat/runs/${createdRun.id}/stream?userId=${encodeURIComponent(userId)}`
    );
    eventSource.addEventListener("chunk", (event) => {
      const chunk = JSON.parse((event as MessageEvent).data) as {
        runId: string;
        status: Run["status"];
        outputText: string;
        errorText?: string;
      };
      setRuns((prev) =>
        prev.map((run) =>
          run.id === chunk.runId
            ? {
                ...run,
                status: chunk.status,
                outputText: chunk.outputText,
                errorText: chunk.errorText ?? run.errorText,
                completedAt:
                  chunk.status === "completed" || chunk.status === "failed"
                    ? new Date().toISOString()
                    : run.completedAt,
              }
            : run
        )
      );
      if (chunk.status === "completed" || chunk.status === "failed") {
        eventSource.close();
      }
    });
  };

  const onSaveProviderKey = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(projectId)}/provider-keys`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-user-id": userId },
        body: JSON.stringify({ provider: keyProvider, apiKey: providerKey }),
      }
    );
    if (!res.ok) {
      setError(`Provider key save failed (${res.status})`);
      return;
    }
    setProviderKey("");
    setInfo(`Saved ${keyProvider} key for project ${projectId}`);
    await loadProviderKeys(projectId);
  };

  const onInvokeTool = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    let input: unknown;
    try {
      input = JSON.parse(toolInput);
    } catch {
      setError("Tool input must be valid JSON");
      return;
    }
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(projectId)}/tools/invoke`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-user-id": userId },
        body: JSON.stringify({ toolName: selectedTool, input }),
      }
    );
    const payload = (await res.json()) as ToolInvocation;
    if (!res.ok) {
      setError(payload.errorText ?? `Tool invocation failed (${res.status})`);
      await loadToolInvocations(projectId);
      return;
    }
    setInfo(`Ran ${selectedTool}`);
    setToolInvocations((prev) => [payload, ...prev].slice(0, 25));
  };

  const onToggleToolPermission = async (toolName: string, enabled: boolean) => {
    setError(null);
    setInfo(null);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(projectId)}/tools/permissions`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-user-id": userId },
        body: JSON.stringify({ toolName, enabled }),
      }
    );
    if (!res.ok) {
      setError(`Tool permission update failed (${res.status})`);
      return;
    }
    setToolPermissions((prev) =>
      prev.map((tool) => (tool.name === toolName ? { ...tool, enabled } : tool))
    );
    setInfo(`${enabled ? "Enabled" : "Disabled"} ${toolName}`);
  };

  const onAddMember = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(projectId)}/members`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-user-id": userId },
        body: JSON.stringify({ userId: memberUserId, role: memberRole }),
      }
    );
    if (!res.ok) {
      setError(`Member update failed (${res.status})`);
      return;
    }
    setMemberUserId("");
    setMemberRole("viewer");
    setInfo(`Updated member ${memberUserId}`);
    await loadMembers(projectId);
  };

  const onAddInboxMessage = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const res = await fetch(
      phoneToken
        ? `${apiBase}/phone/projects/${encodeURIComponent(projectId)}/inbox?token=${encodeURIComponent(phoneToken)}`
        : `${apiBase}/projects/${encodeURIComponent(projectId)}/inbox`,
      phoneToken
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: inboxBody }),
          }
        : {
            method: "POST",
            headers: { "content-type": "application/json", "x-ai-user-id": userId },
            body: JSON.stringify({ body: inboxBody }),
          }
    );
    if (!res.ok) {
      setError(`Inbox message failed (${res.status})`);
      return;
    }
    setInboxBody("");
    setInfo("Message saved to inbox");
    await loadInbox(projectId);
  };

  const onGeneratePhoneLink = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const res = await fetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/phone-link`, {
      method: "POST",
      headers: { "x-ai-user-id": userId },
    });
    if (!res.ok) {
      setError(`Phone link generation failed (${res.status})`);
      return;
    }
    const payload = (await res.json()) as PhoneLink;
    setPhoneLink(payload);
    setPhoneToken(payload.phoneToken);
    await loadPhoneLinkStatus(projectId);
    setInfo("Generated a new phone link");
  };

  const onRevokePhoneLink = async () => {
    setError(null);
    setInfo(null);
    const res = await fetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/phone-link`, {
      method: "DELETE",
      headers: { "x-ai-user-id": userId },
    });
    if (!res.ok && res.status !== 204) {
      setError(`Phone link revoke failed (${res.status})`);
      return;
    }
    setPhoneLink(null);
    setPhoneLinkStatus(null);
    if (!phoneMode) {
      setPhoneToken("");
    }
    setInfo("Revoked phone link");
  };

  const onSharePhoneLink = async () => {
    if (!phoneShareUrl) {
      setError("Generate a phone link first");
      return;
    }
    setError(null);
    setInfo(null);
    try {
      const nav: any = typeof window !== "undefined" ? window.navigator : undefined;
      if (nav && "share" in nav) {
        await (nav as unknown as { share: (data: { title?: string; text?: string; url?: string }) => Promise<void> }).share({
          title: "AI Playground",
          text: "Open phone mode:",
          url: phoneShareUrl,
        });
        setInfo("Opened share sheet");
        return;
      }
      if (!nav || !nav.clipboard) {
        setError("Clipboard not available in this browser");
        return;
      }
      await nav.clipboard.writeText(phoneShareUrl);
      setInfo("Copied phone link");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    }
  };

  const onCopyPhoneLink = async () => {
    if (!phoneShareUrl) {
      setError("Generate a phone link first");
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await navigator.clipboard.writeText(phoneShareUrl);
      setInfo("Copied phone link");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed");
    }
  };

  const onSendPhoneLinkSms = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const res = await fetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/phone-link/sms`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ai-user-id": userId },
      body: JSON.stringify({ to: phoneSmsTo }),
    });
    const payload = (await res.json()) as {
      shareUrl?: string;
      message?: string;
      warning?: string;
      error?: string;
      to?: string;
      smsSent?: boolean;
    };
    if (!res.ok) {
      setError(payload.message ?? payload.error ?? `Phone SMS failed (${res.status})`);
      return;
    }
    if (payload.shareUrl) {
      const parsed = new URL(payload.shareUrl);
      const token = parsed.searchParams.get("token");
      if (token) {
        setPhoneToken(token);
      }
      setPhoneLink({
        projectId,
        phoneToken: token ?? "",
        shareUrl: payload.shareUrl,
      });
    }
    await loadPhoneLinkStatus(projectId);
    if (payload.smsSent) {
      setInfo(`Sent phone link SMS to ${payload.to ?? phoneSmsTo}`);
    } else {
      setInfo(payload.warning ?? "Generated a fresh phone link (SMS not sent)");
    }
  };

  const onChangeInboxStatus = async (messageId: string, status: InboxMessage["status"]) => {
    setError(null);
    setInfo(null);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(projectId)}/inbox/${encodeURIComponent(messageId)}/status`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-user-id": userId },
        body: JSON.stringify({ status }),
      }
    );
    if (!res.ok) {
      setError(`Inbox status update failed (${res.status})`);
      return;
    }
    await loadInbox(projectId);
  };

  const onRemoveMember = async (targetUserId: string) => {
    setError(null);
    setInfo(null);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(targetUserId)}`,
      { method: "DELETE", headers: { "x-ai-user-id": userId } }
    );
    if (!res.ok) {
      setError(`Member removal failed (${res.status})`);
      return;
    }
    setInfo(`Removed ${targetUserId}`);
    await loadMembers(projectId);
  };

  const onChangeMemberRole = async (targetUserId: string, role: ProjectMember["role"]) => {
    setError(null);
    setInfo(null);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"}/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(targetUserId)}/role`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-user-id": userId },
        body: JSON.stringify({ role }),
      }
    );
    if (!res.ok) {
      setError(`Member role update failed (${res.status})`);
      return;
    }
    setInfo(`Updated ${targetUserId} to ${role}`);
    await loadMembers(projectId);
  };

  const onStartGitHubLogin = () => {
    setError(null);
    setInfo(null);
    window.location.href = `${apiBase}/auth/github/start?returnTo=${encodeURIComponent(window.location.href)}`;
  };

  const onSignOut = () => {
    setError(null);
    setInfo(null);
    window.location.href = `${apiBase}/auth/logout`;
  };

  const phoneShareUrl =
    phoneLink?.shareUrl ??
    (phoneToken ? `${webBase}/?projectId=${encodeURIComponent(projectId)}&phone=1&token=${encodeURIComponent(phoneToken)}` : "");
  const phoneLinkExpiryMs = phoneLinkStatus?.expiresAt ? new Date(phoneLinkStatus.expiresAt).getTime() - now : null;
  const phoneLinkIsActive = Boolean(phoneLinkStatus?.configured && (phoneLinkExpiryMs === null || phoneLinkExpiryMs > 0));

  return (
    <main className={`shell ${phoneMode ? "shell-phone" : ""}`}>
      <section className="hero">
        <h1>Limitless Agentic Playground</h1>
        <p>{phoneMode ? "Phone mode is active. Use the share link to send instructions without desktop auth." : "Use the inbox to send short instructions from your phone, then pick up the build in the same workspace."}</p>
      </section>
      {!phoneMode ? (
        <section className="panel">
          <h3>Login</h3>
          {authSession.authenticated ? (
            <p>
              Signed in as <strong>{authSession.displayName}</strong>{" "}
              {authSession.profileUrl ? (
                <a href={authSession.profileUrl} target="_blank" rel="noreferrer">
                  Open profile
                </a>
              ) : null}
            </p>
          ) : (
            <p>{githubConfigured ? "Sign in with GitHub to use redirect login." : "Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI to enable GitHub login."}</p>
          )}
          {authSession.authenticated && authSession.avatarUrl ? (
            <img
              src={authSession.avatarUrl}
              alt={`Avatar for ${authSession.displayName}`}
              width={56}
              height={56}
              style={{ borderRadius: "999px" }}
            />
          ) : null}
          <div className="member-actions">
            <button type="button" className="cta" onClick={onStartGitHubLogin} disabled={!githubConfigured}>
              {authSession.authenticated ? "Reconnect GitHub" : "Sign in with GitHub"}
            </button>
            <button type="button" className="cta cta-secondary" onClick={onSignOut} disabled={!authSession.authenticated}>
              Sign out
            </button>
          </div>
          {authSession.authenticated ? <p>User ID: <code>{authSession.userId}</code></p> : null}
        </section>
      ) : null}
      <section className="panel panel-phone">
        <form onSubmit={onAddInboxMessage}>
          <h3>Command Inbox</h3>
          {!phoneMode ? (
            <>
              <label>User ID</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </>
          ) : null}
          <label>Project ID</label>
          <input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          <label>Message</label>
          <textarea
            rows={4}
            value={inboxBody}
            onChange={(e) => setInboxBody(e.target.value)}
            placeholder="e.g. continue building the phone inbox, add a markdown preview, and make the tools panel more compact"
          />
          <button className="cta" type="submit">
            Save Message
          </button>
          <button className="cta cta-secondary" type="button" onClick={() => loadInbox(projectId)}>
            Refresh Inbox
          </button>
        </form>
        {!phoneMode && phoneShareUrl ? (
          <div className="phone-link">
            <div className="phone-link-qr">
              <QRCode value={phoneShareUrl} size={176} />
            </div>
            <p>Scan the QR code or copy/share the link without exposing the token inline.</p>
            <div className="member-actions">
              <button type="button" className="cta cta-secondary" onClick={onSharePhoneLink}>
                Share Link…
              </button>
              <button type="button" className="cta cta-secondary" onClick={onCopyPhoneLink}>
                Copy Link
              </button>
              <button type="button" className="cta cta-secondary" onClick={onGeneratePhoneLink}>
                Rotate Link
              </button>
              <button type="button" className="cta cta-secondary" onClick={onRevokePhoneLink}>
                Revoke Link
              </button>
            </div>
          </div>
        ) : null}
        {inboxMessages.length > 0 ? (
          <div className="grid">
            {inboxMessages.map((message) => (
              <article className="metric" key={message.id}>
                <small>{message.userId}</small>
                <strong>{message.status}</strong>
                <p>{message.body}</p>
                {!phoneMode ? (
                  <div className="member-actions">
                    <button type="button" className="cta cta-secondary" onClick={() => onChangeInboxStatus(message.id, "open")}>
                      Open
                    </button>
                    <button type="button" className="cta cta-secondary" onClick={() => onChangeInboxStatus(message.id, "working")}>
                      Working
                    </button>
                    <button type="button" className="cta cta-secondary" onClick={() => onChangeInboxStatus(message.id, "done")}>
                      Done
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
      {!phoneMode ? (
        <>
          <section className="panel">
            <form onSubmit={onGeneratePhoneLink}>
              <h3>Phone Access</h3>
              <label>User ID</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} />
              <label>Project ID</label>
              <input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
              <button className="cta" type="submit">
                Generate / Rotate Link
              </button>
              <button className="cta cta-secondary" type="button" onClick={onRevokePhoneLink} disabled={!phoneLinkStatus?.configured}>
                Revoke Link
              </button>
            </form>
            {phoneLinkStatus?.twilioConfigured ? (
              <form onSubmit={onSendPhoneLinkSms}>
                <label>Send Link To (via Twilio)</label>
                <input value={phoneSmsTo} onChange={(e) => setPhoneSmsTo(e.target.value)} placeholder="+16592573794" />
                <button className="cta" type="submit" disabled={!phoneSmsTo}>
                  Send SMS Link
                </button>
                <button className="cta cta-secondary" type="button" onClick={() => loadPhoneLinkStatus(projectId)}>
                  Refresh Link Status
                </button>
              </form>
            ) : (
              <p>
                SMS sending is disabled (Twilio not configured). Use <strong>Share Link…</strong> instead.
              </p>
            )}
            {phoneLinkStatus?.configured ? (
              <p>
                <span className={`status-pill ${phoneLinkIsActive ? "status-pill-active" : "status-pill-expired"}`}>
                  {phoneLinkIsActive ? "Active" : "Expired"}
                </span>{" "}
                | Expires in{" "}
                {phoneLinkExpiryMs !== null ? formatDuration(phoneLinkExpiryMs) : "n/a"} | Last SMS:{" "}
                {phoneLinkStatus.lastSmsSentAt ?? "n/a"} {phoneLinkStatus.lastSmsTo ? `(${phoneLinkStatus.lastSmsTo})` : ""}
              </p>
            ) : (
              <p>Link status: not configured</p>
            )}
          </section>
          <section className="panel">
            <form onSubmit={onSaveProviderKey}>
              <h3>Project Provider Keys</h3>
              <label>User ID</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} />
              <label>Project ID</label>
              <input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
              <label>Provider</label>
              <select value={keyProvider} onChange={(e) => setKeyProvider(e.target.value as Provider)}>
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <label>API Key</label>
              <input
                type="password"
                value={providerKey}
                onChange={(e) => setProviderKey(e.target.value)}
                placeholder="Paste provider key"
              />
              <button className="cta" type="submit">
                Save Provider Key
              </button>
              <button className="cta cta-secondary" type="button" onClick={() => loadProviderKeys(projectId)}>
                Refresh Configured Providers
              </button>
              {configuredProviders.length > 0 ? (
                <p>Configured: {configuredProviders.join(", ")}</p>
              ) : (
                <p>Configured: none</p>
              )}
            </form>
          </section>
          <section className="panel">
            <form onSubmit={onAddMember}>
              <h3>Project Members</h3>
              <label>User ID</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} />
              <label>Project ID</label>
              <input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
              <label>Member User ID</label>
              <input value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} placeholder="Invite user id" />
              <label>Role</label>
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as ProjectMember["role"])}>
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
                <option value="owner">owner</option>
              </select>
              <button className="cta" type="submit">
                Save Member
              </button>
              <button className="cta cta-secondary" type="button" onClick={() => loadMembers(projectId)}>
                Refresh Members
              </button>
            </form>
            {members.length > 0 ? (
              <div className="grid">
                {members.map((member) => (
                  <article className="metric" key={member.userId}>
                    <small>{member.displayName}</small>
                    <strong>{member.role}</strong>
                    <p>{member.userId}</p>
                    <div className="member-actions">
                      <button type="button" className="cta cta-secondary" onClick={() => onChangeMemberRole(member.userId, "viewer")}>
                        Viewer
                      </button>
                      <button type="button" className="cta cta-secondary" onClick={() => onChangeMemberRole(member.userId, "editor")}>
                        Editor
                      </button>
                      <button type="button" className="cta cta-secondary" onClick={() => onRemoveMember(member.userId)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
          <section className="panel">
            <form onSubmit={onSubmit}>
              <label>User ID</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} />
              <label>Project ID</label>
              <input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
              <label>Provider</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <label>Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} />
              <label>Temperature</label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
              <label>Prompt</label>
              <textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <button className="cta" type="submit">
                Queue Run
              </button>
            </form>
            {error ? <p>{error}</p> : null}
            {info ? <p>{info}</p> : null}
            {runs.length > 0 ? (
              <div className="grid">
                {runs.map((run) => (
                  <article className="metric" key={run.id}>
                    <small>{run.model}</small>
                    <strong>{run.status}</strong>
                    <p>{run.outputText || "Waiting for stream..."}</p>
                    {run.errorText ? <p className="run-error">Error: {run.errorText}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
          <section className="panel">
            <form onSubmit={onInvokeTool}>
              <h3>Project Tools</h3>
              <label>User ID</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} />
              <label>Project ID</label>
              <input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
              <label>Tool</label>
              <select
                value={selectedTool}
                onChange={(e) => {
                  setSelectedTool(e.target.value);
                  setToolInput(defaultToolInput(e.target.value));
                }}
              >
                {tools.map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.name}
                  </option>
                ))}
              </select>
              {toolPermissions.length > 0 ? (
                <div className="tool-permissions">
                  {toolPermissions.map((tool) => (
                    <label className="tool-toggle" key={tool.name}>
                      <input
                        type="checkbox"
                        checked={tool.enabled}
                        onChange={(e) => onToggleToolPermission(tool.name, e.target.checked)}
                      />
                      <span>{tool.name}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <label>Input JSON</label>
              <textarea rows={6} value={toolInput} onChange={(e) => setToolInput(e.target.value)} />
              <button className="cta" type="submit">
                Run Tool
              </button>
              <button className="cta cta-secondary" type="button" onClick={() => loadToolInvocations(projectId)}>
                Refresh Invocations
              </button>
            </form>
            {toolInvocations.length > 0 ? (
              <div className="grid">
                {toolInvocations.map((invocation) => (
                  <article className="metric" key={invocation.id}>
                    <small>{invocation.toolName}</small>
                    <strong>{invocation.status}</strong>
                    <pre>{JSON.stringify(invocation.output ?? invocation.errorText, null, 2)}</pre>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
