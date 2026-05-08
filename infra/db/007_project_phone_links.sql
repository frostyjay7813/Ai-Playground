create table if not exists project_phone_links (
  project_id text primary key references projects(id) on delete cascade,
  phone_user_id text not null references users(id) on delete cascade,
  token_hash text not null,
  created_by text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  last_used_at timestamptz
);

