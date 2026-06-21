-- Enable pgvector
create extension if not exists vector;

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text default 'starter',
  settings jsonb default '{}',
  created_at timestamptz default now()
);

-- Projects
create table projects (
  id uuid primary key,
  org_id uuid references organizations,
  name text not null,
  repo_url text,
  repo_provider text not null default 'local',
  stack jsonb default '{}',
  knowledge jsonb default '{}',
  data_classification text not null default 'internal',
  indexed_at timestamptz,
  created_at timestamptz default now()
);

-- Context chunks (embedded file segments)
create table context_chunks (
  id text primary key,
  project_id uuid references projects on delete cascade,
  file_path text not null,
  content text not null,
  embedding vector(1536),
  chunk_index int not null,
  token_count int not null default 0,
  file_hash text not null,
  updated_at timestamptz default now()
);
create index on context_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index on context_chunks (project_id);

-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  summary text,
  total_cost_usd numeric(10,6) default 0,
  created_at timestamptz default now(),
  ended_at timestamptz
);

-- Tickets (backlog)
create table tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects on delete cascade,
  external_id text,
  external_url text,
  title text not null,
  description text,
  type text not null default 'feature',
  status text not null default 'open',
  priority_score numeric(5,2) default 0,
  priority_reason text default '',
  sources jsonb default '[]',
  linked_files text[] default '{}',
  linked_prs text[] default '{}',
  manual_priority_override boolean default false,
  created_by text default 'developer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on tickets (project_id, status);
create index on tickets (project_id, priority_score desc);
