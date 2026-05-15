import { z } from "zod";

export const inboxStatusSchema = z.enum(["open", "working", "done"]);

export const mobileInboxMessageSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  body: z.string().min(1),
  status: inboxStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const mobileInboxListResponseSchema = z.object({
  messages: z.array(mobileInboxMessageSchema),
});

export const postInboxMessageInputSchema = z.object({
  body: z.string().min(1).max(4000),
});

export type MobileInboxMessage = z.infer<typeof mobileInboxMessageSchema>;
export type MobileInboxListResponse = z.infer<typeof mobileInboxListResponseSchema>;
export type PostInboxMessageInput = z.infer<typeof postInboxMessageInputSchema>;
