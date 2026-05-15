import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { mobileRunDetailResponseSchema, mobileRunListResponseSchema } from "@ai-playground/mobile-sdk";
import { requireMobileSession } from "../../services/mobile/mobile-session-service.js";
import { getRunByIdForUser, listRunsForProject } from "../../services/runs/run-service.js";
import { assertMobileProjectAccess } from "../../services/mobile/mobile-project-service.js";

const listRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const mobileRunRoutes: FastifyPluginAsync = async (app) => {
  app.get("/mobile/projects/:projectId/runs", async (request, reply) => {
    const session = await requireMobileSession(request, reply);
    if (!session) return;

    const { projectId } = request.params as { projectId: string };
    const parsedQuery = listRunsQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "invalid_query",
        details: parsedQuery.error.flatten(),
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

    const runs = await listRunsForProject(projectId, parsedQuery.data.limit);
    return mobileRunListResponseSchema.parse({ runs });
  });

  app.get("/mobile/runs/:runId", async (request, reply) => {
    const session = await requireMobileSession(request, reply);
    if (!session) return;

    const { runId } = request.params as { runId: string };
    const run = await getRunByIdForUser(runId, session.userId, session.projectId ?? null);

    if (!run) {
      return reply.status(404).send({ error: "not_found" });
    }

    return mobileRunDetailResponseSchema.parse({ run });
  });
};

export default mobileRunRoutes;
