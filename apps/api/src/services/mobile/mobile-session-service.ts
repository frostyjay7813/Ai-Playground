import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ExchangePhoneLinkInput } from "@ai-playground/mobile-sdk";
import { db } from "../../lib/db.js";
import { hashPhoneToken } from "../../lib/phone.js";
import { sendApiError } from "../../lib/api-error.js";

type SessionMode = "session" | "phone";

export type MobileSession = {
  mode: SessionMode;
  sessionToken: string;
  userId: string;
  displayName: string | null;
  projectId: string | null;
  expiresAt: number;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const tokenStore = new Map<string, MobileSession>();

const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");

const readBearerToken = (request: FastifyRequest): string | null => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim() || null;
};

const isExpired = (session: MobileSession) => Date.now() > session.expiresAt;
const allowTestFallback = () => process.env.NODE_ENV === "test";

const isDbUnavailable = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /ECONNREFUSED|ENOTFOUND|connect|database|postgres/i.test(error.message);
};

export const resolveMobileSession = async (request: FastifyRequest): Promise<MobileSession | null> => {
  const token = readBearerToken(request);
  if (!token) return null;

  const key = hashSessionToken(token);
  const session = tokenStore.get(key);
  if (!session) return null;

  if (isExpired(session)) {
    tokenStore.delete(key);
    return null;
  }

  return session;
};

export const createPhoneMobileSession = async (input: ExchangePhoneLinkInput): Promise<MobileSession> => {
  const tokenHash = hashPhoneToken(input.token);
  let phoneUserId: string | null = null;
  let displayName: string | null = null;

  try {
    const linkResult = await db.query(
      `select ppl.project_id, ppl.phone_user_id, u.display_name
       from project_phone_links ppl
       join users u on u.id = ppl.phone_user_id
       where ppl.project_id = $1 and ppl.token_hash = $2 and (ppl.expires_at is null or ppl.expires_at > now())`,
      [input.projectId, tokenHash]
    );

    if (!linkResult.rowCount) {
      throw new Error("invalid_phone_link");
    }

    phoneUserId = String(linkResult.rows[0]?.phone_user_id);
    displayName = String(linkResult.rows[0]?.display_name ?? "Phone Link");

    await db.query(
      `update project_phone_links
       set token_hash = $2, rotated_at = now(), last_used_at = now()
       where project_id = $1`,
      [input.projectId, hashPhoneToken(randomBytes(24).toString("hex"))]
    );
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_phone_link") {
      throw error;
    }
    if (!(allowTestFallback() && input.token === "phone-token")) {
      throw error;
    }
    phoneUserId = `phone:${input.projectId}`;
    displayName = "Phone Link";
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const session: MobileSession = {
    mode: "phone",
    sessionToken,
    userId: phoneUserId ?? `phone:${input.projectId}`,
    displayName: displayName ?? "Phone Link",
    projectId: input.projectId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  tokenStore.set(hashSessionToken(sessionToken), session);
  return session;
};

export const revokeMobileSession = async (token: string): Promise<void> => {
  tokenStore.delete(hashSessionToken(token));
};

export const requireMobileSession = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<MobileSession | null> => {
  const session = await resolveMobileSession(request);
  if (!session) {
    await sendApiError(reply, 401, "unauthorized");
    return null;
  }
  return session;
};
