export type MobileProjectSummary = {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
};

export const listMobileProjects = async (_userId: string): Promise<MobileProjectSummary[]> => {
  return [];
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
  if (sessionProjectId && sessionProjectId !== projectId) {
    return false;
  }

  return Boolean(projectId && userId);
};
