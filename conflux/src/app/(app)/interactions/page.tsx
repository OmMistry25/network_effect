import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/serverClient';
import { getActiveWorkspaceId } from '@/lib/supabase/auth';
import type { Interaction } from '@/types/domain';

export default async function InteractionsPage() {
  const supabase = await getSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId(supabase);

  if (!workspaceId) {
    return <div>No workspace found</div>;
  }

  const { data: interactions, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('occurred_at', { ascending: false });

  if (error) {
    return <div>Error loading interactions: {error.message}</div>;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Interactions</h1>
        <Link
          href="/capture/note"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Log interaction
        </Link>
      </div>

      {interactions && interactions.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {(interactions as Interaction[]).map((interaction) => (
            <li key={interaction.id}>
              <Link
                href={`/interactions/${interaction.id}`}
                className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {interaction.title || `${interaction.interaction_type} on ${formatDate(interaction.occurred_at)}`}
                  </p>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDate(interaction.occurred_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm capitalize text-zinc-500 dark:text-zinc-400">
                  {interaction.interaction_type}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400">No interactions yet. Log your first interaction.</p>
      )}
    </div>
  );
}
