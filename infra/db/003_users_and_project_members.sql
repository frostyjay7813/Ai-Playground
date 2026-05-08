create table if not exists users (
  id text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

insert into users (id, display_name)
values ('local', 'Local User')
on conflict (id) do nothing;

alter table projects
  add column if not exists owner_user_id text references users(id);

update projects
set owner_user_id = 'local'
where owner_user_id is null;

alter table projects
  alter column owner_user_id set not null;

create table if not exists project_members (
  project_id text not null references projects(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

insert into project_members (project_id, user_id, role)
select id, owner_user_id, 'owner'
from projects
on conflict (project_id, user_id) do nothing;
