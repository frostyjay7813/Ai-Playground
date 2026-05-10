import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { db } from "./db.js";

export type AuthenticatedSessionUser = {
  userId: string;
  displayName: string;
  provider: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
};

const sessionCookieName = "ai_playground_session";
const oauthStateCookieName = "ai_playground_oauth_state";
const oauthReturnToCookieName = "ai_playground_oauth_return_to";
const authSessionTtlDays = Number(process.env.AUTH_SESSION_TTL_DAYS ?? 30);
const authSessionTtlMs = authSessionTtlDays * 24 * 60 * 60 * 1000;

const parseCookieHeader = (cookieHeader: string | undefined) => {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, decodeURIComponent(rawValueParts.join("=") ?? ""));
  }
  return cookies;
};

const getCookie = (request: FastifyRequest, name: string) => parseCookieHeader(request.headers.cookie)?.get(name);

const serializeCookie = (name: string, value: string, maxAgeSeconds: number) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
};

export const sessionCookie = (value: string, maxAgeSeconds = authSessionTtlMs / 1000) =>
  serializeCookie(sessionCookieName, value, maxAgeSeconds);

export const clearSessionCookie = () => serializeCookie(sessionCookieName, "", 0);

export const oauthStateCookie = (value: string) => serializeCookie(oauthStateCookieName, value, 10 * 60);

export const clearOAuthStateCookie = () => serializeCookie(oauthStateCookieName, "", 0);

export const oauthReturnToCookie = (value: string) => serializeCookie(oauthReturnToCookieName, value, 10 * 60);

export const clearOAuthReturnToCookie = () => serializeCookie(oauthReturnToCookieName, "", 0);

export const readOAuthStateCookie = (request: FastifyRequest) => getCookie(request, oauthStateCookieName);

export const readOAuthReturnToCookie = (request: FastifyRequest) => getCookie(request, oauthReturnToCookieName);

export const readSessionToken = (request: FastifyRequest) => getCookie(request, sessionCookieName);

export const resolveAuthenticatedSessionUser = async (
  request: FastifyRequest
): Promise<AuthenticatedSessionUser | null> => {
  const sessionToken = readSessionToken(request);
  if (!sessionToken) return null;
  const result = await db.query(
    `select s.user_id, u.display_name, u.provider, u.avatar_url, u.profile_url
     from auth_sessions s
     join users u on u.id = s.user_id
     where s.session_token = $1 and s.expires_at > now()`,
    [sessionToken]
  );
  if (!result.rowCount) {
    await db.query(`delete from auth_sessions where session_token = $1`, [sessionToken]).catch(() => {});
    return null;
  }
  const row = result.rows[0] as Record<string, unknown>;
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name),
    provider: row.provider ? String(row.provider) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    profileUrl: row.profile_url ? String(row.profile_url) : null,
  };
};

export const issueAuthSession = async (userId: string, provider: string) => {
  const sessionToken = randomUUID();
  const expiresAt = new Date(Date.now() + authSessionTtlMs);
  await db.query(
    `insert into auth_sessions (session_token, user_id, provider, expires_at)
     values ($1, $2, $3, $4::timestamptz)`,
    [sessionToken, userId, provider, expiresAt.toISOString()]
  );
  return { sessionToken, expiresAt };
};

export const deleteAuthSession = async (sessionToken: string) => {
  await db.query(`delete from auth_sessions where session_token = $1`, [sessionToken]);
};

