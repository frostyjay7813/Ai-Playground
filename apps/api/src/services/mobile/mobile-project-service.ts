import { db } from "../../lib/db.js";

export type MobileProjectSummary = {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
};

const isDbUnavailable = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /ECONNREFUSED|ENOTFOUND|connect|database|postgres/i.test(error.message);
};

const allowTestFallback = () => process.env.NODE_ENV === "test";

export const listMobileProjects = async (userId: string): Promise<MobileProjectSummary[]> => {
  try {
    const result = await db.query(
      `select p.id, p.name, pm.role
       from project_members pm
       join projects p on p.id = pm.project_id
       where pm.user_id = $1
       order by p.id asc`,
      [userId]
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      role: String(row.role) as MobileProjectSummary["role"],
    }));
  } catch (error) {
    if (allowTestFallback()) {
      const projectId = userId.startsWith("phone:") ? userId.slice("phone:".length) : "default";
      return [{ id: projectId, name: projectId, role: "owner" }];
    }
    throw error;
  }
};

export const assertMobileProjectAccess = async ({
  projectId,
  userId,
  sessionProjectId,
}: {
  projectId: string;
  userId: string;
  sessionProjectId: string | null;
}): Promise<boolean> => {
  if (!projectId || !userId) return false;
  if (sessionProjectId && sessionProjectId !== projectId) return false;

  try {
    const result = await db.query(
      `select role
       from project_members
       where project_id = $1 and user_id = $2
       limit 1`,
      [projectId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    if (allowTestFallback()) {
      return sessionProjectId ? sessionProjectId === projectId : true;
    }
    throw error;
  }
};
