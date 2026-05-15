import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ExchangePhoneLinkInput } from "@ai-playground/mobile-sdk";

export type MobileSession = {
  mode: "session" | "phone";
  sessionToken: string;
  userId: string;
  displayName: string | null;
  projectId: string | null;
};

export const resolveMobileSession = async (_request: FastifyRequest): Promise<MobileSession | null> => {
  return null;
};

export const createPhoneMobileSession = async (input: ExchangePhoneLinkInput): Promise<MobileSession> => {
  return {
    mode: "phone",
    sessionToken: randomBytes(24).toString("base64url"),
    userId: "phone:placeholder",
    displayName: null,
    projectId: input.projectId,
  };
};

export const revokeMobileSession = async (_token: string): Promise<void> => {};

export const requireMobileSession = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<MobileSession | null> => {
  const session = await resolveMobileSession(request);
  if (!session) {
    await reply.status(401).send({ error: "unauthorized" });
    return null;
  }
  return session;
};
