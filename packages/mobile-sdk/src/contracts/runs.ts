import { z } from "zod";

export const runStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const mobileRunSummarySchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().min(1),
  status: runStatusSchema,
  promptPreview: z.string().min(1),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const mobileRunListResponseSchema = z.object({
  runs: z.array(mobileRunSummarySchema),
});

export const mobileRunDetailSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  conversationId: z.string().min(1),
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().min(1),
  prompt: z.string().min(1),
  status: runStatusSchema,
  outputText: z.string(),
  errorText: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const mobileRunDetailResponseSchema = z.object({
  run: mobileRunDetailSchema,
});

export type MobileRunSummary = z.infer<typeof mobileRunSummarySchema>;
export type MobileRunListResponse = z.infer<typeof mobileRunListResponseSchema>;
export type MobileRunDetail = z.infer<typeof mobileRunDetailSchema>;
export type MobileRunDetailResponse = z.infer<typeof mobileRunDetailResponseSchema>;
