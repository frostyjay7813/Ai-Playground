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

export const listInboxMessages = async (_projectId: string, _limit: number): Promise<InboxMessage[]> => {
  return [];
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
  return {
    id: `msg_${Date.now()}`,
    projectId,
    userId,
    body,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
};
