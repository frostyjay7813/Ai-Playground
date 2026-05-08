import Fastify from "fastify";
import cors from "@fastify/cors";
import { createRun, createRunSchema } from "@ai-playground/ai-core";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { db } from "./lib/db.js";
import type { Run } from "@ai-playground/sdk";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "./lib/crypto.js";
import {
  canAccessConversation,
  canAccessProject,
  canAccessRun,
  canEditProject,
  canManageProject,
  createOwnedProject,
  listProjectMembers,
  requireUser,
} from "./lib/auth.js";
import { generatePhoneToken, hashPhoneToken } from "./lib/phone.js";
import { listTools, runTool } from "./lib/tools.js";

const app = Fastify({ logger: true });
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "127.0.0.1";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const runQueue = new Queue("chat-runs", { connection: redisConnection });
const streamRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });
const providerKeySchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  apiKey: z.string().min(1),
});
const invokeToolSchema = z.object({
  toolName: z.string().min(1),
  input: z.unknown().default({}),
});
const setToolPermissionSchema = z.object({
  toolName: z.string().min(1),
  enabled: z.boolean(),
});
const setProjectMemberSchema = z.object({
  userId: z.string().min(1).max(80),
  role: z.enum(["owner", "editor", "viewer"]),
});
const updateProjectMemberRoleSchema = z.object({
  role: z.enum(["owner", "editor", "viewer"]),
});
const createInboxMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
const updateInboxMessageSchema = z.object({
  status: z.enum(["open", "working", "done"]),
});

const readPhoneToken = (request: { query?: unknown }) => {
  const query = request.query as { token?: string } | undefined;
  return query?.token;
};

const validatePhoneAccess = async (projectId: string, token: string) => {
  const tokenHash = hashPhoneToken(token);
  const result = await db.query(
    `select phone_user_id
     from project_phone_links
     where project_id = $1 and token_hash = $2`,
    [projectId, tokenHash]
  );
  if (!result.rowCount) {
    return null;
  }
  await db.query(
    `update project_phone_links
     set last_used_at = now()
     where project_id = $1`,
    [projectId]
  );
  return { phoneUserId: String(result.rows[0]?.phone_user_id) };
};

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["content-type", "x-ai-user-id"],
});

app.get("/health", async () => ({ service: "api", ok: true }));

app.get("/projects/:projectId/inbox", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `select id, project_id, user_id, body, status, created_at, updated_at
     from project_inbox_messages
     where project_id = $1
     order by created_at desc
     limit 50`,
    [projectId]
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
});

app.get("/phone/projects/:projectId/inbox", async (request, reply) => {
  const { projectId } = request.params as { projectId: string };
  const token = readPhoneToken(request);
  if (!token) {
    return reply.status(401).send({ error: "missing_token" });
  }
  const access = await validatePhoneAccess(projectId, token);
  if (!access) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `select id, project_id, user_id, body, status, created_at, updated_at
     from project_inbox_messages
     where project_id = $1
     order by created_at desc
     limit 50`,
    [projectId]
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
});

app.post("/phone/projects/:projectId/inbox", async (request, reply) => {
  const { projectId } = request.params as { projectId: string };
  const token = readPhoneToken(request);
  if (!token) {
    return reply.status(401).send({ error: "missing_token" });
  }
  const parsed = createInboxMessageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  const access = await validatePhoneAccess(projectId, token);
  if (!access) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `insert into project_inbox_messages (project_id, user_id, body)
     values ($1, $2, $3)
     returning id, created_at, updated_at`,
    [projectId, access.phoneUserId, parsed.data.body]
  );
  return reply.status(201).send({
    id: result.rows[0]?.id,
    projectId,
    userId: access.phoneUserId,
    body: parsed.data.body,
    status: "open",
    createdAt: result.rows[0]?.created_at,
    updatedAt: result.rows[0]?.updated_at,
  });
});

app.post("/projects/:projectId/inbox", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  const parsed = createInboxMessageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  await createOwnedProject(projectId, user.id);
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `insert into project_inbox_messages (project_id, user_id, body)
     values ($1, $2, $3)
     returning id, created_at, updated_at`,
    [projectId, user.id, parsed.data.body]
  );
  return reply.status(201).send({
    id: result.rows[0]?.id,
    projectId,
    userId: user.id,
    body: parsed.data.body,
    status: "open",
    createdAt: result.rows[0]?.created_at,
    updatedAt: result.rows[0]?.updated_at,
  });
});

app.post("/projects/:projectId/inbox/:messageId/status", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId, messageId } = request.params as { projectId: string; messageId: string };
  const parsed = updateInboxMessageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  if (!(await canEditProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `update project_inbox_messages
     set status = $3, updated_at = now()
     where id = $1::uuid and project_id = $2
     returning id, project_id, user_id, body, status, created_at, updated_at`,
    [messageId, projectId, parsed.data.status]
  );
  if (!result.rowCount) {
    return reply.status(404).send({ error: "not_found" });
  }
  const row = result.rows[0] as Record<string, unknown>;
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
});

app.get("/projects/:projectId/members", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await listProjectMembers(projectId);
  return result.rows.map((row: Record<string, unknown>) => ({
    projectId: row.project_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  }));
});

app.post("/projects/:projectId/phone-link", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  await createOwnedProject(projectId, user.id);
  if (!(await canManageProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const phoneToken = generatePhoneToken();
  const phoneUserId = randomUUID();
  const tokenHash = hashPhoneToken(phoneToken);
  await db.query(`insert into users (id, display_name) values ($1, $2)`, [phoneUserId, "Phone Inbox"]);
  await db.query(
    `insert into project_phone_links (project_id, phone_user_id, token_hash, created_by)
     values ($1, $2, $3, $4)
     on conflict (project_id)
     do update set phone_user_id = excluded.phone_user_id,
                   token_hash = excluded.token_hash,
                   created_by = excluded.created_by,
                   rotated_at = now(),
                   last_used_at = null`,
    [projectId, phoneUserId, tokenHash, user.id]
  );
  const baseUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
  return {
    projectId,
    phoneToken,
    shareUrl: `${baseUrl}/?projectId=${encodeURIComponent(projectId)}&phone=1&token=${encodeURIComponent(phoneToken)}`,
  };
});

app.get("/projects/:projectId/phone-link", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  if (!(await canManageProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `select created_at, rotated_at, last_used_at
     from project_phone_links
     where project_id = $1`,
    [projectId]
  );
  if (!result.rowCount) {
    return { projectId, configured: false };
  }
  return {
    projectId,
    configured: true,
    createdAt: result.rows[0]?.created_at,
    rotatedAt: result.rows[0]?.rotated_at,
    lastUsedAt: result.rows[0]?.last_used_at,
  };
});

app.post("/projects/:projectId/members", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  const parsed = setProjectMemberSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  await createOwnedProject(projectId, user.id);
  if (!(await canManageProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  await db.query(
    `insert into users (id, display_name)
     values ($1, $1)
     on conflict (id) do nothing`,
    [parsed.data.userId]
  );
  await db.query(
    `insert into project_members (project_id, user_id, role)
     values ($1, $2, $3)
     on conflict (project_id, user_id)
     do update set role = excluded.role`,
    [projectId, parsed.data.userId, parsed.data.role]
  );
  return reply.status(204).send();
});

app.post("/projects/:projectId/members/:memberUserId/role", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId, memberUserId } = request.params as { projectId: string; memberUserId: string };
  const parsed = updateProjectMemberRoleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  if (!(await canManageProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const owner = await db.query("select owner_user_id from projects where id = $1", [projectId]);
  if (owner.rows[0]?.owner_user_id === memberUserId && parsed.data.role !== "owner") {
    return reply.status(400).send({ error: "cannot_downgrade_owner" });
  }
  await db.query(
    `update project_members
     set role = $3
     where project_id = $1 and user_id = $2`,
    [projectId, memberUserId, parsed.data.role]
  );
  return reply.status(204).send();
});

app.delete("/projects/:projectId/members/:memberUserId", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId, memberUserId } = request.params as { projectId: string; memberUserId: string };
  if (!(await canManageProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const owner = await db.query("select owner_user_id from projects where id = $1", [projectId]);
  if (owner.rows[0]?.owner_user_id === memberUserId) {
    return reply.status(400).send({ error: "cannot_remove_owner" });
  }
  await db.query(
    `delete from project_members
     where project_id = $1 and user_id = $2`,
    [projectId, memberUserId]
  );
  return reply.status(204).send();
});

app.get("/tools", async () => listTools());

app.get("/projects/:projectId/tools/permissions", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `select tool_name, enabled, updated_at
     from project_tool_permissions
     where project_id = $1`,
    [projectId]
  );
  const permissionByTool = new Map(
    result.rows.map((row: Record<string, unknown>) => [
      String(row.tool_name),
      { enabled: Boolean(row.enabled), updatedAt: row.updated_at },
    ])
  );
  return listTools().map((tool) => ({
    ...tool,
    enabled: permissionByTool.get(tool.name)?.enabled ?? false,
    updatedAt: permissionByTool.get(tool.name)?.updatedAt ?? null,
  }));
});

app.post("/projects/:projectId/tools/permissions", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  const parsed = setToolPermissionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  await createOwnedProject(projectId, user.id);
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  if (!listTools().some((tool) => tool.name === parsed.data.toolName)) {
    return reply.status(404).send({ error: "unknown_tool" });
  }
  const result = await db.query(
    `insert into project_tool_permissions (project_id, tool_name, enabled)
     values ($1, $2, $3)
     on conflict (project_id, tool_name)
     do update set enabled = excluded.enabled, updated_at = now()
     returning tool_name, enabled, updated_at`,
    [projectId, parsed.data.toolName, parsed.data.enabled]
  );
  return {
    toolName: result.rows[0]?.tool_name,
    enabled: result.rows[0]?.enabled,
    updatedAt: result.rows[0]?.updated_at,
  };
});

app.post("/projects/:projectId/tools/invoke", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  const parsed = invokeToolSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  await createOwnedProject(projectId, user.id);
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const permission = await db.query(
    `select enabled
     from project_tool_permissions
     where project_id = $1 and tool_name = $2`,
    [projectId, parsed.data.toolName]
  );
  if (!permission.rows[0]?.enabled) {
    const message = `Tool is not enabled for project: ${parsed.data.toolName}`;
    const result = await db.query(
      `insert into tool_invocations (project_id, user_id, tool_name, input, status, error_text)
       values ($1, $2, $3, $4::jsonb, 'failed', $5)
       returning id, created_at`,
      [projectId, user.id, parsed.data.toolName, JSON.stringify(parsed.data.input), message]
    );
    return reply.status(403).send({
      id: result.rows[0]?.id,
      projectId,
      toolName: parsed.data.toolName,
      input: parsed.data.input,
      status: "failed",
      errorText: message,
      createdAt: result.rows[0]?.created_at,
    });
  }

  try {
    const output = await runTool(parsed.data.toolName, parsed.data.input, {
      projectId,
      userId: user.id,
    });
    const result = await db.query(
      `insert into tool_invocations (project_id, user_id, tool_name, input, output, status)
       values ($1, $2, $3, $4::jsonb, $5::jsonb, 'completed')
       returning id, created_at`,
      [projectId, user.id, parsed.data.toolName, JSON.stringify(parsed.data.input), JSON.stringify(output)]
    );
    return reply.status(201).send({
      id: result.rows[0]?.id,
      projectId,
      toolName: parsed.data.toolName,
      input: parsed.data.input,
      output,
      status: "completed",
      createdAt: result.rows[0]?.created_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tool failure";
    const result = await db.query(
      `insert into tool_invocations (project_id, user_id, tool_name, input, status, error_text)
       values ($1, $2, $3, $4::jsonb, 'failed', $5)
       returning id, created_at`,
      [projectId, user.id, parsed.data.toolName, JSON.stringify(parsed.data.input), message]
    );
    return reply.status(400).send({
      id: result.rows[0]?.id,
      projectId,
      toolName: parsed.data.toolName,
      input: parsed.data.input,
      status: "failed",
      errorText: message,
      createdAt: result.rows[0]?.created_at,
    });
  }
});

app.get("/projects/:projectId/tools/invocations", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `select id, tool_name, input, output, status, error_text, created_at
     from tool_invocations
     where project_id = $1
     order by created_at desc
     limit 25`,
    [projectId]
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    toolName: row.tool_name,
    input: row.input,
    output: row.output,
    status: row.status,
    errorText: row.error_text,
    createdAt: row.created_at,
  }));
});

app.post("/projects/:projectId/provider-keys", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  const parsed = providerKeySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  await createOwnedProject(projectId, user.id);
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const encrypted = encryptSecret(parsed.data.apiKey);
  await db.query(
    `insert into project_provider_keys (project_id, provider, encrypted_key)
     values ($1, $2, $3)
     on conflict (project_id, provider)
     do update set encrypted_key = excluded.encrypted_key, updated_at = now()`,
    [projectId, parsed.data.provider, encrypted]
  );
  return reply.status(204).send();
});

app.get("/projects/:projectId/provider-keys", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { projectId } = request.params as { projectId: string };
  if (!(await canAccessProject(projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `select provider, updated_at
     from project_provider_keys
     where project_id = $1
     order by provider asc`,
    [projectId]
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    provider: String(row.provider),
    configured: true,
    updatedAt: row.updated_at,
  }));
});

app.post("/chat/runs", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const parsed = createRunSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
  }
  const run = createRun(parsed.data) as Run;
  await createOwnedProject(run.projectId, user.id);
  if (!(await canAccessProject(run.projectId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const keyResult = await db.query(
    `select encrypted_key from project_provider_keys where project_id = $1 and provider = $2`,
    [run.projectId, run.provider]
  );
  if (!keyResult.rowCount) {
    return reply.status(400).send({
      error: "missing_provider_key",
      message: `No provider key configured for project ${run.projectId} and provider ${run.provider}`,
    });
  }
  const encryptedKey = String(keyResult.rows[0]?.encrypted_key);
  const apiKey = decryptSecret(encryptedKey);

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      "insert into projects (id, name, owner_user_id) values ($1, $2, $3) on conflict (id) do nothing",
      [run.projectId, run.projectId, user.id]
    );
    await client.query(
      "insert into project_members (project_id, user_id, role) values ($1, $2, 'owner') on conflict (project_id, user_id) do nothing",
      [run.projectId, user.id]
    );
    await client.query(
      "insert into conversations (id, project_id, title) values ($1::uuid, $2, $3) on conflict (id) do nothing",
      [run.conversationId, run.projectId, "AI Conversation"]
    );
    await client.query(
      `insert into runs
       (id, project_id, conversation_id, provider, model, prompt, temperature, status, output_text, error_text, created_at, completed_at)
       values ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)`,
      [
        run.id,
        run.projectId,
        run.conversationId,
        run.provider,
        run.model,
        run.prompt,
        run.temperature,
        run.status,
        run.outputText,
        run.errorText,
        run.createdAt,
        run.completedAt,
      ]
    );
    await client.query(
      "insert into messages (conversation_id, run_id, role, content) values ($1::uuid, $2::uuid, 'user', $3)",
      [run.conversationId, run.id, run.prompt]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  await runQueue.add("execute-run", { ...run, apiKey }, {
    attempts: 3,
    removeOnComplete: 500,
    removeOnFail: 500,
  });
  return reply.status(201).send(run);
});

app.get("/chat/conversations/:conversationId/runs", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { conversationId } = request.params as { conversationId: string };
  if (!(await canAccessConversation(conversationId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  const result = await db.query(
    `select id, project_id, conversation_id, provider, model, prompt, temperature, status, output_text, error_text, created_at, completed_at
     from runs
     where conversation_id = $1::uuid
     order by created_at asc`,
    [conversationId]
  );
  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    provider: row.provider,
    model: row.model,
    prompt: row.prompt,
    temperature: Number(row.temperature),
    status: row.status,
    outputText: row.output_text,
    errorText: row.error_text,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
});

app.get("/chat/runs/:runId/stream", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { runId } = request.params as { runId: string };
  if (!(await canAccessRun(runId, user.id))) {
    return reply.status(403).send({ error: "forbidden" });
  }
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  reply.raw.write(`event: ready\ndata: ${JSON.stringify({ runId })}\n\n`);

  const channel = `run:${runId}`;
  const subscriber = streamRedis.duplicate();
  await subscriber.connect();
  await subscriber.subscribe(channel);

  subscriber.on("message", (_ch, payload) => {
    reply.raw.write(`event: chunk\ndata: ${payload}\n\n`);
  });

  const close = async () => {
    await subscriber.unsubscribe(channel);
    await subscriber.quit();
    reply.raw.end();
  };
  request.raw.on("close", close);
});

const start = async () => {
await app.listen({ port, host });
};

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
