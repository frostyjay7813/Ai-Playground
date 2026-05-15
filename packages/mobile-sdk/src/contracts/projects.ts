import { z } from "zod";

export const mobileProjectRoleSchema = z.enum(["owner", "editor", "viewer"]);

export const mobileProjectSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: mobileProjectRoleSchema,
});

export const mobileProjectListResponseSchema = z.object({
  projects: z.array(mobileProjectSummarySchema),
});

export type MobileProjectSummary = z.infer<typeof mobileProjectSummarySchema>;
export type MobileProjectListResponse = z.infer<typeof mobileProjectListResponseSchema>;
