alter table users
  add column if not exists provider text,
  add column if not exists provider_user_id text,
  add column if not exists avatar_url text,
  add column if not exists profile_url text;

create unique index if not exists idx_users_provider_identity
  on users (provider, provider_user_id)
  where provider is not null and provider_user_id is not null;

create table if not exists auth_sessions (
  session_token text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_auth_sessions_expires_at on auth_sessions (expires_at);
