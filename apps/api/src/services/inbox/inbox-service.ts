export type InboxMessageStatus = "open" | "working" | "done";

export type InboxMessage = {
  id: string;
  projectId: string;
  userId: string;
  body: string;
  status: InboxMessageStatus;
  createdAt: string;
  updatedAt: string;
};

const inboxStore = new Map<string, InboxMessage[]>();

export const listInboxMessages = async (projectId: string, limit: number): Promise<InboxMessage[]> => {
  return (inboxStore.get(projectId) ?? []).slice(0, limit);
};

export const createInboxMessage = async ({
  projectId,
  userId,
  body,
}: {
  projectId: string;
  userId: string;
  body: string;
}): Promise<InboxMessage> => {
  const now = new Date().toISOString();
  const message: InboxMessage = {
    id: `msg_${Date.now()}`,
    projectId,
    userId,
    body,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  const prev = inboxStore.get(projectId) ?? [];
  inboxStore.set(projectId, [message, ...prev]);
  return message;
};
