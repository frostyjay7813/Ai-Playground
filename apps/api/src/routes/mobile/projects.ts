import type { FastifyPluginAsync } from "fastify";
import { mobileProjectListResponseSchema } from "@ai-playground/mobile-sdk";
import { requireMobileSession } from "../../services/mobile/mobile-session-service.js";
import { listMobileProjects } from "../../services/mobile/mobile-project-service.js";

const mobileProjectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/mobile/projects", async (request, reply) => {
    const session = await requireMobileSession(request, reply);
    if (!session) return;

    const projects = await listMobileProjects(session.userId);

    return mobileProjectListResponseSchema.parse({ projects });
  });
};

export default mobileProjectRoutes;
