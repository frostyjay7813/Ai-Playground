"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Provider, Run } from "@ai-playground/sdk";

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
  shareUrl: string;
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

export default function HomePage() {
  const [userId, setUserId] = useState("local");
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

  useEffect(() => {
    if (!phoneMode) {
      void loadProviderKeys(projectId);
      void loadToolInvocations(projectId);
      void loadToolPermissions(projectId);
      void loadMembers(projectId);
    }
    void loadInbox(projectId);
  }, [projectId, userId, phoneMode, phoneToken]);

  useEffect(() => {
    void loadTools();
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
    setPhoneMode(true);
    setInfo("Generated a new phone link");
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

  const phoneShareUrl =
    phoneLink?.shareUrl ??
    (phoneToken ? `${webBase}/?projectId=${encodeURIComponent(projectId)}&phone=1&token=${encodeURIComponent(phoneToken)}` : "");

  return (
    <main className={`shell ${phoneMode ? "shell-phone" : ""}`}>
      <section className="hero">
        <h1>Limitless Agentic Playground</h1>
        <p>{phoneMode ? "Phone mode is active. Use the share link to send instructions without desktop auth." : "Use the inbox to send short instructions from your phone, then pick up the build in the same workspace."}</p>
      </section>
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
          {phoneMode ? (
            <>
              <label>Phone Token</label>
              <input value={phoneToken} onChange={(e) => setPhoneToken(e.target.value)} />
            </>
          ) : null}
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
        {phoneShareUrl ? (
          <p className="phone-link">
            Share link: <code>{phoneShareUrl}</code>
            <button
              type="button"
              className="cta cta-secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(phoneShareUrl);
                setInfo("Copied phone link");
              }}
            >
              Copy
            </button>
          </p>
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
                Generate Phone Link
              </button>
            </form>
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
