# Mobile Auth/Session Model (Phase 1)

## Token Lifetime
- Mobile session tokens are opaque bearer tokens with a 7-day TTL in the current Phase-1 implementation.
- Expired tokens are rejected as unauthenticated and removed from the in-memory token map.

## Revoke Behavior
- `POST /mobile/session/logout` revokes the current bearer token.
- Revocation removes token state immediately.

## Phone-link Scope
- Phone-link exchange creates a session scoped to a single project (`projectId`).
- Access checks reject requests to other projects when a session is project-scoped.

## Device Re-auth Rules
- If token is missing, expired, or revoked, the client must re-auth via session bootstrap or phone-link exchange.
- Mobile client should clear local token on 401 and force auth flow restart.

## Phase-1 Constraints
- Session store is currently in-memory and intended only for portable shell validation.
- Production hardening needs durable session storage, rotation, and audit logging.
