import type { FastifyPluginAsync } from "fastify";
import { exchangePhoneLinkInputSchema, mobileSessionResponseSchema } from "@ai-playground/mobile-sdk";
import { sendApiError } from "../../lib/api-error.js";
import { enforceInMemoryRateLimit } from "../../lib/rate-limit.js";
import {
  createPhoneMobileSession,
  resolveMobileSession,
  revokeMobileSession,
} from "../../services/mobile/mobile-session-service.js";

const mobileSessionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/mobile/session", async (request) => {
    const session = await resolveMobileSession(request);

    if (!session) {
      return mobileSessionResponseSchema.parse({ authenticated: false });
    }

    return mobileSessionResponseSchema.parse({
      authenticated: true,
      mode: session.mode,
      sessionToken: session.sessionToken,
      userId: session.userId,
      displayName: session.displayName ?? null,
      projectId: session.projectId ?? null,
    });
  });

  app.post("/mobile/session/phone", async (request, reply) => {
    const limiter = enforceInMemoryRateLimit({
      bucket: `mobile-session-phone:${request.ip}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!limiter.allowed) {
      reply.header("retry-after", String(limiter.retryAfterSeconds ?? 60));
      return sendApiError(reply, 429, "rate_limited");
    }

    const parsed = exchangePhoneLinkInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendApiError(reply, 400, "invalid_request", parsed.error.flatten());
    }

    try {
      const session = await createPhoneMobileSession(parsed.data);

      return mobileSessionResponseSchema.parse({
        authenticated: true,
        mode: "phone",
        sessionToken: session.sessionToken,
        userId: session.userId,
        displayName: session.displayName ?? null,
        projectId: session.projectId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      if (message === "invalid_phone_link") {
        return sendApiError(reply, 401, "invalid_phone_link");
      }
      return sendApiError(reply, 500, "session_creation_failed");
    }
  });

  app.post("/mobile/session/logout", async (request) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

    if (token) {
      await revokeMobileSession(token);
    }

    return { ok: true as const };
  });
};

export default mobileSessionRoutes;
