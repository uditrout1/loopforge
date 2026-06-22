-- Knowledge Graph nodes
create table graph_nodes (
  id text not null,
  project_id uuid not null references projects on delete cascade,
  entity_type text not null,
  title text not null,
  metadata jsonb not null default '{}',
  source_system text not null default 'manual',
  source_id text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (project_id, id)
);

create unique index on graph_nodes (project_id, entity_type, source_id);
create index on graph_nodes (project_id, entity_type);
create index on graph_nodes using gin (to_tsvector('english', title));
create index on graph_nodes using gin (metadata jsonb_path_ops);

-- Knowledge Graph edges
create table graph_edges (
  id text not null,
  project_id uuid not null references projects on delete cascade,
  source_node_id text not null,
  target_node_id text not null,
  relationship text not null,
  confidence numeric(4,3) not null default 1.0,
  metadata jsonb not null default '{}',
  created_at timestamptz default now(),
  primary key (project_id, id)
);

create unique index on graph_edges (project_id, source_node_id, target_node_id, relationship);
create index on graph_edges (project_id, source_node_id);
create index on graph_edges (project_id, target_node_id);
create index on graph_edges (project_id, relationship);
