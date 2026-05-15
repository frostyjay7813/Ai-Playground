import type { FastifyInstance } from "fastify";
import mobileInboxRoutes from "./routes/mobile/inbox.js";
import mobileProjectRoutes from "./routes/mobile/projects.js";
import mobileRunRoutes from "./routes/mobile/runs.js";
import mobileSessionRoutes from "./routes/mobile/session.js";

export const registerAppRoutes = async (app: FastifyInstance) => {
  await app.register(mobileSessionRoutes);
  await app.register(mobileProjectRoutes);
  await app.register(mobileInboxRoutes);
  await app.register(mobileRunRoutes);
};
