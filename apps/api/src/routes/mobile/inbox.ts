import type { FastifyPluginAsync } from "fastify";
import { mobileInboxListResponseSchema, postInboxMessageInputSchema } from "@ai-playground/mobile-sdk";
import { sendApiError } from "../../lib/api-error.js";
import { enforceInMemoryRateLimit } from "../../lib/rate-limit.js";
import { requireMobileSession } from "../../services/mobile/mobile-session-service.js";
import { createInboxMessage, listInboxMessages } from "../../services/inbox/inbox-service.js";
import { assertMobileProjectAccess } from "../../services/mobile/mobile-project-service.js";

const mobileInboxRoutes: FastifyPluginAsync = async (app) => {
  app.get("/mobile/projects/:projectId/inbox", async (request, reply) => {
    const session = await requireMobileSession(request, reply);
    if (!session) return;

    const { projectId } = request.params as { projectId: string };
    const access = await assertMobileProjectAccess({
      projectId,
      userId: session.userId,
      sessionProjectId: session.projectId ?? null,
    });

    if (!access) {
      return sendApiError(reply, 403, "forbidden");
    }

    const messages = await listInboxMessages(projectId, 50);
    return mobileInboxListResponseSchema.parse({ messages });
  });

  app.post("/mobile/projects/:projectId/inbox", async (request, reply) => {
    const limiter = enforceInMemoryRateLimit({
      bucket: `mobile-inbox-create:${request.ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!limiter.allowed) {
      reply.header("retry-after", String(limiter.retryAfterSeconds ?? 60));
      return sendApiError(reply, 429, "rate_limited");
    }

    const session = await requireMobileSession(request, reply);
    if (!session) return;

    const { projectId } = request.params as { projectId: string };
    const parsed = postInboxMessageInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendApiError(reply, 400, "invalid_request", parsed.error.flatten());
    }

    const access = await assertMobileProjectAccess({
      projectId,
      userId: session.userId,
      sessionProjectId: session.projectId ?? null,
    });

    if (!access) {
      return sendApiError(reply, 403, "forbidden");
    }

    const message = await createInboxMessage({
      projectId,
      userId: session.userId,
      body: parsed.data.body,
    });

    return reply.status(201).send({ message });
  });
};

export default mobileInboxRoutes;
