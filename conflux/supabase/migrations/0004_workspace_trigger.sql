-- Automatically create a workspace for new users

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Create a new workspace for the user
  INSERT INTO workspaces (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'My Workspace'))
  RETURNING id INTO new_workspace_id;

  -- Add user as owner of the workspace
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
