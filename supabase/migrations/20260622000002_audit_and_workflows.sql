-- Audit log (append-only)
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid references projects,
  session_id uuid references sessions,
  model text not null,
  provider text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  pii_scrubbed boolean default false,
  created_at timestamptz default now()
);
-- Immutable: no update or delete allowed
create rule no_update_audit as on update to audit_log do instead nothing;
create rule no_delete_audit as on delete to audit_log do instead nothing;

-- Workflow runs
create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id text not null,
  project_id uuid references projects,
  triggered_by text not null,
  trigger_payload jsonb default '{}',
  status text not null default 'running',
  current_node_id text,
  shared_state jsonb default '{}',
  completed_nodes jsonb default '{}',
  human_checkpoints jsonb default '[]',
  total_cost_usd numeric(10,6) default 0,
  started_at timestamptz default now(),
  completed_at timestamptz
);
create index on workflow_runs (project_id, status);
