import { z } from "zod";

export const mobileSessionModeSchema = z.enum(["session", "phone"]);

export const authenticatedMobileSessionSchema = z.object({
  authenticated: z.literal(true),
  mode: mobileSessionModeSchema,
  sessionToken: z.string().min(20),
  userId: z.string().min(1),
  displayName: z.string().min(1).nullable(),
  projectId: z.string().min(1).nullable().optional(),
});

export const unauthenticatedMobileSessionSchema = z.object({
  authenticated: z.literal(false),
});

export const mobileSessionResponseSchema = z.union([
  authenticatedMobileSessionSchema,
  unauthenticatedMobileSessionSchema,
]);

export const exchangePhoneLinkInputSchema = z.object({
  projectId: z.string().min(1),
  token: z.string().min(1),
});

export type AuthenticatedMobileSession = z.infer<typeof authenticatedMobileSessionSchema>;
export type MobileSessionResponse = z.infer<typeof mobileSessionResponseSchema>;
export type ExchangePhoneLinkInput = z.infer<typeof exchangePhoneLinkInputSchema>;
