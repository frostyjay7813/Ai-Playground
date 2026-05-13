# Architecture Summary

## Snapshot Date
`2026-05-13`

## System Overview
AI Playground is organized as a monorepo for a project-scoped AI workspace that combines a web UI, backend orchestration, background workers, provider integrations, memory retrieval, and later evaluation workflows.

## Runtime Surfaces
- `apps/web` for the user workspace and chat experience
- `apps/api` for auth, run orchestration, provider key management, tool coordination, and memory endpoints
- `apps/worker` for asynchronous ingestion, indexing, and evaluation work

## Shared Packages
- `packages/sdk` for shared contracts
- `packages/ai-core` for provider adapters, validation, routing, and guardrails
- `packages/memory` for chunking, embedding, retrieval, and citation-related abstractions
- `packages/evals` for evaluation scenarios and scoring

## Infrastructure Assumptions
- Postgres for durable state
- Redis and queue-backed background processing
- Docker-based local development support

## Main Architecture Boundaries
- Projects are the primary ownership boundary for runs, provider keys, files, and tools
- Provider keys are expected to be encrypted at rest
- Tool execution is intended to be allowlisted, auditable, and default-deny
- Background work should stay decoupled from interactive chat responsiveness

## Current Risks To Watch
1. Memory quality depends on chunking, ranking, and citation quality
2. Tool permissions and validation may need hardening as capabilities grow
3. Multi-provider abstractions may hide provider-specific behavior differences
4. Eval coverage may lag behind prompt, routing, and provider changes

## Backup Notes
- This file is a small continuity snapshot derived from the current architecture notes
- It is intentionally scoped to `agent-backups/`
- It does not include secrets, credentials, or unrelated repository content
