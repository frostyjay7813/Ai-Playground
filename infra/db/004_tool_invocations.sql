create table if not exists tool_invocations (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  tool_name text not null,
  input jsonb not null,
  output jsonb,
  status text not null check (status in ('completed', 'failed')),
  error_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tool_invocations_project_created_at
  on tool_invocations (project_id, created_at desc);
