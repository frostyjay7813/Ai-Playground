import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "./db.js";

export type AuthUser = {
  id: string;
};

const getQueryUserId = (request: FastifyRequest): string | undefined => {
  const query = request.query as { userId?: string } | undefined;
  return query?.userId;
};

export const requireUser = async (request: FastifyRequest, reply: FastifyReply): Promise<AuthUser | null> => {
  const headerUserId = request.headers["x-ai-user-id"];
  const userId =
    (Array.isArray(headerUserId) ? headerUserId[0] : headerUserId) ??
    getQueryUserId(request) ??
    process.env.DEFAULT_USER_ID ??
    "local";

  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(userId)) {
    reply.status(401).send({ error: "invalid_user" });
    return null;
  }

  await db.query(
    `insert into users (id, display_name)
     values ($1, $1)
     on conflict (id) do nothing`,
    [userId]
  );
  return { id: userId };
};

export const createOwnedProject = async (projectId: string, userId: string): Promise<void> => {
  await db.query(
    `insert into projects (id, name, owner_user_id)
     values ($1, $1, $2)
     on conflict (id) do nothing`,
    [projectId, userId]
  );
  const owner = await db.query("select owner_user_id from projects where id = $1", [projectId]);
  if (owner.rows[0]?.owner_user_id !== userId) return;
  await db.query(
    `insert into project_members (project_id, user_id, role)
     values ($1, $2, 'owner')
     on conflict (project_id, user_id) do nothing`,
    [projectId, userId]
  );
};

export const canAccessProject = async (projectId: string, userId: string): Promise<boolean> => {
  const result = await db.query(
    `select 1
     from project_members
     where project_id = $1 and user_id = $2`,
    [projectId, userId]
  );
  return Boolean(result.rowCount);
};

export const canAccessConversation = async (conversationId: string, userId: string): Promise<boolean> => {
  const result = await db.query(
    `select 1
     from conversations c
     join project_members pm on pm.project_id = c.project_id
     where c.id = $1::uuid and pm.user_id = $2`,
    [conversationId, userId]
  );
  return Boolean(result.rowCount);
};

export const canAccessRun = async (runId: string, userId: string): Promise<boolean> => {
  const result = await db.query(
    `select 1
     from runs r
     join project_members pm on pm.project_id = r.project_id
     where r.id = $1::uuid and pm.user_id = $2`,
    [runId, userId]
  );
  return Boolean(result.rowCount);
};

export const canManageProject = async (projectId: string, userId: string): Promise<boolean> => {
  const result = await db.query(
    `select 1
     from projects
     where id = $1 and owner_user_id = $2`,
    [projectId, userId]
  );
  return Boolean(result.rowCount);
};

export const listProjectMembers = async (projectId: string) =>
  db.query(
    `select pm.project_id, pm.user_id, pm.role, pm.created_at, u.display_name
     from project_members pm
     join users u on u.id = pm.user_id
     where pm.project_id = $1
     order by case pm.role when 'owner' then 0 when 'editor' then 1 else 2 end, pm.created_at asc`,
    [projectId]
  );
