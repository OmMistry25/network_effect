import { getSupabaseServerClient } from '@/lib/supabase/serverClient';
import { getActiveWorkspaceId } from '@/lib/supabase/auth';

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId(supabase);
  const { data: { user } } = await supabase.auth.getUser();

  const { data: workspace } = workspaceId
    ? await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
    : { data: null };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Account</h2>
          <p className="mt-1 text-zinc-900 dark:text-zinc-100">{user?.email}</p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Workspace</h2>
          <p className="mt-1 text-zinc-900 dark:text-zinc-100">{workspace?.name || 'No workspace'}</p>
        </div>

        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Workspace ID</h2>
          <p className="mt-1 font-mono text-sm text-zinc-600 dark:text-zinc-400">{workspaceId}</p>
        </div>
      </div>
    </div>
  );
}
