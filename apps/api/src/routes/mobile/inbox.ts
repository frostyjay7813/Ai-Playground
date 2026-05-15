import type { FastifyPluginAsync } from "fastify";
import { mobileInboxListResponseSchema, postInboxMessageInputSchema } from "@ai-playground/mobile-sdk";
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
      return reply.status(403).send({ error: "forbidden" });
    }

    const messages = await listInboxMessages(projectId, 50);
    return mobileInboxListResponseSchema.parse({ messages });
  });

  app.post("/mobile/projects/:projectId/inbox", async (request, reply) => {
    const session = await requireMobileSession(request, reply);
    if (!session) return;

    const { projectId } = request.params as { projectId: string };
    const parsed = postInboxMessageInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "invalid_request",
        details: parsed.error.flatten(),
      });
    }

    const access = await assertMobileProjectAccess({
      projectId,
      userId: session.userId,
      sessionProjectId: session.projectId ?? null,
    });

    if (!access) {
      return reply.status(403).send({ error: "forbidden" });
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
