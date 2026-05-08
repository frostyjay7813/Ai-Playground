# AI Playground

Personalized AI workspace for prompt experiments, multi-provider model access, memory-backed assistants, and workflow automations.

## V1 Goals

- Unified chat playground with provider/model switching.
- Personal profiles, projects, and reusable prompt templates.
- Retrieval-augmented memory for user-owned notes/files.
- Tool execution layer for safe, auditable automations.
- Evaluation harness for prompt/model quality and cost tracking.

## Repository Layout

```text
Ai-Playground/
  apps/
    web/                # Frontend app (workspace UI)
    api/                # Backend API (auth, chat, tools, memory)
    worker/             # Async jobs (indexing, eval runs, ingest)
  packages/
    sdk/                # Shared API client + typed contracts
    ai-core/            # Provider adapters, routing, guardrails
    memory/             # Embedding + retrieval abstractions
    evals/              # Evaluation scenarios and scoring utilities
    config/             # Shared lint/ts/build configuration
  infra/
    docker/             # Local containers and service definitions
    terraform/          # Cloud infra (optional later phase)
  docs/
    architecture.md     # System architecture + design decisions
    roadmap.md          # Implementation phases and milestones
```

## Architecture

See [docs/architecture.md](/home/jay7813/Ai-Playground/docs/architecture.md) for the full system design and [docs/roadmap.md](/home/jay7813/Ai-Playground/docs/roadmap.md) for implementation phases.

## Quick Start (Phase 0 Scaffold)

1. Start local data services:
   `docker compose -f infra/docker/docker-compose.yml up -d`
2. Install dependencies:
   `npm install`
3. Run DB migration:
   `npm run db:migrate`
4. Run workspace services in separate terminals:
   `npm run dev -w @ai-playground/api`
   `npm run dev -w @ai-playground/worker`
   `npm run dev -w @ai-playground/web`

## Phase 1 Baseline Implemented

- `apps/web`: Next.js app with run composer UI.
- `apps/api`: Fastify API with `POST /chat/runs` and `GET /health`.
- `apps/worker`: BullMQ worker consuming `chat-runs` from Redis.
- `packages/sdk`: shared run contracts.
- `packages/ai-core`: run validation + run construction.
- `infra/db`: Postgres schema + migration script.
- Live streaming via `GET /chat/runs/:runId/stream` (SSE).
- Real provider execution in worker for `openai`, `anthropic`, and `google`.
- Project-scoped tools are default-deny and must be enabled before invocation.

## Provider Setup

Set a shared encryption key in your environment:

- `ENCRYPTION_KEY` (base64-encoded 32-byte key)

Then store provider keys per project through API:

```bash
curl -X POST http://localhost:4000/projects/default/provider-keys \
  -H "content-type: application/json" \
  -d '{"provider":"openai","apiKey":"sk-..."}'
```

You can repeat the same endpoint for `anthropic` and `google`.

Runs now require a configured provider key per project/provider pair. Keys are encrypted at rest in Postgres.

## Local Auth

The local auth boundary is user-scoped by `x-ai-user-id` (or `?userId=` for SSE streams). The web app exposes a `User ID` field and sends it with API calls.

- `DEFAULT_USER_ID=local` is used when no user is provided.
- New projects are owned by the current user.
- Existing projects require membership before provider keys, runs, history, or streams are accessible.
- Project owners can add, update, and remove members through the web UI.

## Phone Inbox

The `Command Inbox` section at the top of the app is the phone-friendly entry point. It stores short instructions per project, lets project editors mark them as `open`, `working`, or `done`, and keeps the latest messages visible in the same workspace.

Owners can also generate a project phone link from the UI. That link opens a reduced phone mode with a project-scoped token, so you can send instructions from your phone without typing a desktop user ID.

## Tools

Available built-in tools:

- `time.now`
- `math.evaluate`
- `text.summarize`

Project members can enable or disable tools from the web UI. Every invocation is written to `tool_invocations` with input, output, status, and error details.

## Example Run Request

```bash
curl -X POST http://localhost:4000/chat/runs \
  -H "content-type: application/json" \
  -d '{
    "projectId": "default",
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "prompt": "Design an agent workflow.",
    "temperature": 0.7
  }'
```
