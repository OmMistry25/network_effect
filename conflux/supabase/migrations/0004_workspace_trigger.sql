-- Automatically create a workspace for new users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Create a new workspace for the user
  INSERT INTO public.workspaces (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'My Workspace'))
  RETURNING id INTO new_workspace_id;

  -- Add user as owner of the workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
