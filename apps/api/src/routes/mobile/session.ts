import type { FastifyPluginAsync } from "fastify";
import { exchangePhoneLinkInputSchema, mobileSessionResponseSchema } from "@ai-playground/mobile-sdk";
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
    const parsed = exchangePhoneLinkInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        details: parsed.error.flatten(),
      });
    }

    const session = await createPhoneMobileSession(parsed.data);

    return mobileSessionResponseSchema.parse({
      authenticated: true,
      mode: "phone",
      sessionToken: session.sessionToken,
      userId: session.userId,
      displayName: session.displayName ?? null,
      projectId: session.projectId,
    });
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
