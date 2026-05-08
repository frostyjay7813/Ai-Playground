create table if not exists project_provider_keys (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'google')),
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, provider)
);
