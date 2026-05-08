create table if not exists project_tool_permissions (
  project_id text not null references projects(id) on delete cascade,
  tool_name text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (project_id, tool_name)
);
