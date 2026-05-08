# Roadmap: AI Playground

## Phase 0: Foundation (Week 1)

- Initialize monorepo (`apps/*`, `packages/*`).
- Add TypeScript, linting, formatting, CI checks.
- Add local Docker services: Postgres + Redis.
- Set env/config conventions and secrets handling.

Exit criteria:

- `web`, `api`, and `worker` boot locally.
- CI validates lint + typecheck.

## Phase 1: Core Chat Vertical Slice (Weeks 2-3)

- Implement auth and user/project ownership model.
- Build conversation UI + streaming responses.
- Add provider abstraction with one default model provider.
- Persist runs/messages + token/cost metadata.

Exit criteria:

- User can create project, start chat, and see run analytics.

## Phase 2: Personalized Memory (Weeks 4-5)

- Add document ingestion endpoints and worker pipeline.
- Implement chunking + embedding + pgvector retrieval.
- Add citation display in UI.

Exit criteria:

- User can upload docs and receive context-grounded answers with citations.

## Phase 3: Tools + Guardrails (Weeks 6-7)

- Add tool registry and strict JSON schema validation.
- Implement safe tool execution gateway with audit logs.
- Add per-project tool permissions.

Exit criteria:

- User can run allowed tools from chat and inspect invocation traces.

## Phase 4: Evals + Reliability (Weeks 8-9)

- Add eval scenario registry and batch runner.
- Store quality/cost/latency scores by model and prompt version.
- Add fallback routing + retry strategy + SLO dashboards.

Exit criteria:

- Regression checks run before prompt/model changes are promoted.

## Phase 5: Product Hardening (Week 10+)

- Performance tuning and caching.
- Billing/usage limits (if needed).
- Deployment automation and incident playbooks.
