create table if not exists project_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  body text not null,
  status text not null check (status in ('open', 'working', 'done')) default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_inbox_messages_project_created_at
  on project_inbox_messages (project_id, created_at desc);
