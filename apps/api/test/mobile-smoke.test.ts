import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import mobileSessionRoutes from "../src/routes/mobile/session.js";
import mobileProjectRoutes from "../src/routes/mobile/projects.js";
import mobileInboxRoutes from "../src/routes/mobile/inbox.js";
import mobileRunRoutes from "../src/routes/mobile/runs.js";

test("mobile smoke path: session -> projects -> inbox -> runs", async () => {
  const app = Fastify();
  await app.register(mobileSessionRoutes);
  await app.register(mobileProjectRoutes);
  await app.register(mobileInboxRoutes);
  await app.register(mobileRunRoutes);

  const sessionResponse = await app.inject({
    method: "POST",
    url: "/mobile/session/phone",
    payload: {
      projectId: "default",
      token: "phone-token",
    },
  });

  assert.equal(sessionResponse.statusCode, 200);
  const sessionBody = sessionResponse.json() as { authenticated: boolean; sessionToken: string };
  assert.equal(sessionBody.authenticated, true);
  assert.ok(sessionBody.sessionToken.length > 20);

  const authorization = `Bearer ${sessionBody.sessionToken}`;

  const projectsResponse = await app.inject({
    method: "GET",
    url: "/mobile/projects",
    headers: { authorization },
  });
  assert.equal(projectsResponse.statusCode, 200);

  const inboxCreateResponse = await app.inject({
    method: "POST",
    url: "/mobile/projects/default/inbox",
    headers: { authorization },
    payload: { body: "ship mobile inbox" },
  });
  assert.equal(inboxCreateResponse.statusCode, 201);

  const inboxListResponse = await app.inject({
    method: "GET",
    url: "/mobile/projects/default/inbox",
    headers: { authorization },
  });
  assert.equal(inboxListResponse.statusCode, 200);

  const runsResponse = await app.inject({
    method: "GET",
    url: "/mobile/projects/default/runs?limit=20",
    headers: { authorization },
  });
  assert.equal(runsResponse.statusCode, 200);

  await app.close();
});
