# Architecture: Personalized AI Playground

## 1. Product Scope (V1)

The platform is a personalized AI environment where a user can:

- Chat with multiple LLM providers in one UI.
- Save reusable prompts and per-project context.
- Upload notes/files and retrieve relevant context at runtime.
- Run controlled tool actions (HTTP, code execution, integrations).
- Compare outputs, quality, latency, and cost across models.

Primary non-goals for V1:

- Full enterprise multi-tenancy.
- Real-time collaboration between multiple users.
- Arbitrary autonomous agents with unrestricted execution.

## 2. High-Level System

```text
Web App (Next.js/React)
  -> API Service (Node/TypeScript)
      -> Auth + User Profiles
      -> Chat Orchestrator
          -> Model Router (OpenAI/Anthropic/others)
          -> Safety + Policy Filters
          -> Memory Retriever (vector + metadata)
          -> Tool Runtime Gateway
      -> Persistence Layer (Postgres)
      -> Cache/Queue (Redis)
  -> Worker Service
      -> File ingestion and chunking
      -> Embedding generation
      -> Index updates
      -> Eval batch jobs
```

## 3. Core Components

### Frontend (`apps/web`)

- Workspace UI with conversations, prompt library, and run metadata.
- Per-run controls: provider, model, temperature, max tokens, tools enabled.
- Trace view: token usage, latency, retrieval chunks, tool calls.

### API (`apps/api`)

- `POST /chat/runs`: create execution run with user config.
- `POST /chat/runs/:id/messages`: stream assistant output.
- `POST /memory/documents`: ingest and index files.
- `GET /evals/runs/:id`: fetch eval scores and regression diffs.

### AI Core (`packages/ai-core`)

- Provider adapters with a common interface.
- Routing policy:
- Cost-optimized default route.
- Quality route for complex tasks.
- Optional fallback route on provider failure.
- Guardrails:
- Input/output policy checks.
- Tool allowlist + schema validation.

### Memory (`packages/memory`)

- Ingestion pipeline: parse -> chunk -> embed -> store.
- Retrieval pipeline: query rewrite -> semantic search -> rerank -> citations.
- Storage:
- Metadata in Postgres.
- Vector index (pgvector first, external vector DB later if needed).

### Worker (`apps/worker`)

- Async tasks for:
- Re-indexing documents.
- Nightly eval execution.
- Cleanup/retention workflows.

## 4. Data Model (V1)

Key entities:

- `users`
- `projects`
- `conversations`
- `messages`
- `runs` (model config + usage + outcome)
- `documents`
- `chunks`
- `retrieval_events`
- `tool_invocations`
- `eval_scenarios`
- `eval_results`

## 5. Security and Safety

- Auth via JWT/session provider.
- Row-level ownership checks on every project/conversation/document.
- Secret isolation: provider keys encrypted at rest.
- Tool runtime isolation with strict command/network policy.
- Audit logs for prompt inputs, model outputs, and tool calls.

## 6. Observability

- Structured logs with `request_id`, `user_id`, `run_id`.
- Metrics:
- latency p50/p95
- token usage (input/output)
- cost per run and per project
- retrieval hit rate
- tool failure rate
- Tracing across web -> API -> provider/tool calls.

## 7. Recommended Tech Stack

- Frontend: Next.js + TypeScript + Tailwind.
- API: Fastify or NestJS + TypeScript.
- DB: Postgres + pgvector.
- Queue/cache: Redis + BullMQ.
- Runtime: Docker Compose for local dev.
- Deploy: Vercel (web) + container platform for API/worker.

## 8. Sequencing Strategy

- Build thin end-to-end vertical slices.
- Ship chat without memory/tools first.
- Add memory retrieval second.
- Add tools and evals third.
- Optimize routing, caching, and reliability after baseline works.
