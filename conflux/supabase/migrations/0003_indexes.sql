-- Indexes for query performance

-- People indexes
CREATE INDEX idx_people_workspace_name ON people(workspace_id, full_name);
CREATE INDEX idx_people_workspace_updated ON people(workspace_id, updated_at DESC);

-- Organizations indexes
CREATE INDEX idx_organizations_workspace_name ON organizations(workspace_id, name);

-- Interactions indexes
CREATE INDEX idx_interactions_workspace_occurred ON interactions(workspace_id, occurred_at DESC);
CREATE INDEX idx_interactions_workspace_created ON interactions(workspace_id, created_at DESC);

-- Interaction participants indexes
CREATE INDEX idx_interaction_participants_person ON interaction_participants(person_id);

-- Affiliations indexes
CREATE INDEX idx_affiliations_person ON affiliations(person_id);
CREATE INDEX idx_affiliations_organization ON affiliations(organization_id);

-- Graph edges indexes
CREATE INDEX idx_graph_edges_workspace_src ON graph_edges(workspace_id, src_id);
CREATE INDEX idx_graph_edges_workspace_dst ON graph_edges(workspace_id, dst_id);
CREATE INDEX idx_graph_edges_src ON graph_edges(src_type, src_id);
CREATE INDEX idx_graph_edges_dst ON graph_edges(dst_type, dst_id);

-- Assets indexes
CREATE INDEX idx_assets_workspace ON assets(workspace_id);

-- Ingestion jobs indexes
CREATE INDEX idx_ingestion_jobs_workspace_status ON ingestion_jobs(workspace_id, status);
