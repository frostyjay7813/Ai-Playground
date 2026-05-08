create extension if not exists "pgcrypto";

create table if not exists projects (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  title text not null default 'New Conversation',
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id uuid primary key,
  project_id text not null references projects(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  provider text not null,
  model text not null,
  prompt text not null,
  temperature real not null,
  status text not null,
  output_text text not null default '',
  error_text text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  run_id uuid references runs(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_runs_conversation_created_at on runs (conversation_id, created_at desc);
create index if not exists idx_messages_conversation_created_at on messages (conversation_id, created_at asc);
