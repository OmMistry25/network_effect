-- Enable Row Level Security on all tables

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- Helper function to check workspace membership
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Workspaces policies
CREATE POLICY "Users can view workspaces they belong to"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id));

CREATE POLICY "Users can update workspaces they own"
  ON workspaces FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = id AND user_id = auth.uid() AND role = 'owner'
  ));

-- Workspace members policies
CREATE POLICY "Users can view workspace members"
  ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Owners can insert workspace members"
  ON workspace_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid() AND wm.role = 'owner'
  ) OR user_id = auth.uid());

CREATE POLICY "Owners can delete workspace members"
  ON workspace_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_id AND wm.user_id = auth.uid() AND wm.role = 'owner'
  ));

-- People policies
CREATE POLICY "Users can view people in their workspaces"
  ON people FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can insert people in their workspaces"
  ON people FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can update people in their workspaces"
  ON people FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can delete people in their workspaces"
  ON people FOR DELETE
  USING (is_workspace_member(workspace_id));

-- Organizations policies
CREATE POLICY "Users can view organizations in their workspaces"
  ON organizations FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can insert organizations in their workspaces"
  ON organizations FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can update organizations in their workspaces"
  ON organizations FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can delete organizations in their workspaces"
  ON organizations FOR DELETE
  USING (is_workspace_member(workspace_id));

-- Affiliations policies
CREATE POLICY "Users can view affiliations in their workspaces"
  ON affiliations FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can insert affiliations in their workspaces"
  ON affiliations FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can update affiliations in their workspaces"
  ON affiliations FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can delete affiliations in their workspaces"
  ON affiliations FOR DELETE
  USING (is_workspace_member(workspace_id));

-- Interactions policies
CREATE POLICY "Users can view interactions in their workspaces"
  ON interactions FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can insert interactions in their workspaces"
  ON interactions FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can update interactions in their workspaces"
  ON interactions FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can delete interactions in their workspaces"
  ON interactions FOR DELETE
  USING (is_workspace_member(workspace_id));

-- Interaction participants policies
CREATE POLICY "Users can view interaction participants"
  ON interaction_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM interactions i
    WHERE i.id = interaction_id AND is_workspace_member(i.workspace_id)
  ));

CREATE POLICY "Users can insert interaction participants"
  ON interaction_participants FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM interactions i
    WHERE i.id = interaction_id AND is_workspace_member(i.workspace_id)
  ));

CREATE POLICY "Users can delete interaction participants"
  ON interaction_participants FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM interactions i
    WHERE i.id = interaction_id AND is_workspace_member(i.workspace_id)
  ));

-- Assets policies
CREATE POLICY "Users can view assets in their workspaces"
  ON assets FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can insert assets in their workspaces"
  ON assets FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can delete assets in their workspaces"
  ON assets FOR DELETE
  USING (is_workspace_member(workspace_id));

-- Interaction assets policies
CREATE POLICY "Users can view interaction assets"
  ON interaction_assets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM interactions i
    WHERE i.id = interaction_id AND is_workspace_member(i.workspace_id)
  ));

CREATE POLICY "Users can insert interaction assets"
  ON interaction_assets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM interactions i
    WHERE i.id = interaction_id AND is_workspace_member(i.workspace_id)
  ));

CREATE POLICY "Users can delete interaction assets"
  ON interaction_assets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM interactions i
    WHERE i.id = interaction_id AND is_workspace_member(i.workspace_id)
  ));

-- Graph edges policies
CREATE POLICY "Users can view graph edges in their workspaces"
  ON graph_edges FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can insert graph edges in their workspaces"
  ON graph_edges FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can update graph edges in their workspaces"
  ON graph_edges FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can delete graph edges in their workspaces"
  ON graph_edges FOR DELETE
  USING (is_workspace_member(workspace_id));

-- Ingestion jobs policies
CREATE POLICY "Users can view ingestion jobs in their workspaces"
  ON ingestion_jobs FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Users can insert ingestion jobs in their workspaces"
  ON ingestion_jobs FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Users can update ingestion jobs in their workspaces"
  ON ingestion_jobs FOR UPDATE
  USING (is_workspace_member(workspace_id));
