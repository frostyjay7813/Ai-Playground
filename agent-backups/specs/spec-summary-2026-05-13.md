# Spec Summary - 2026-05-13

Source: `agent_files/docs/specs/current-spec.md`
Backup time: 2026-05-13 05:11 CDT (America/Chicago)

## Scope Snapshot
- AI Playground is currently scoped as a project-based AI workspace with multi-provider chat, run persistence, provider key management, project ownership, controlled tool execution, and a roadmap toward retrieval-backed memory and formal eval workflows.
- The current near-term emphasis is stronger document memory, safer tool execution, and measurable prompt and model evaluation.

## Current State Summary
- Implemented baseline: project-scoped chat runs, persisted runs and messages, encrypted provider keys, and project ownership or membership access controls.
- Planned or evolving: document ingestion and retrieval with citations, project-scoped audited tools that stay default-deny unless enabled, prompt and model eval workflows, and richer trace visibility in the UI.

## Acceptance Focus
- Users should be able to create a project, configure a provider key, submit a run, and receive streamed output.
- Access to runs, keys, and project state should stay limited to authorized project members.
- Tool invocation should remain disabled unless explicitly enabled and should be logged with visible status or errors.

## Dependencies Called Out In The Spec
- OpenAI, Anthropic, and Google model providers
- Postgres
- Redis and worker queue infrastructure
- Docker Compose
- Shared packages for contracts, provider logic, memory, and evals

## Open Questions
- What retrieval quality and citation behavior is required before memory is production ready?
- How much tool autonomy is acceptable before stronger approval or policy layers are needed?
- Which metrics should block prompt or model changes from promotion in the eval system?
- Should evals be user-facing, internal-only, or both?
