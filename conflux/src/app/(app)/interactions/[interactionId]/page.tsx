import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/serverClient';
import { getActiveWorkspaceId } from '@/lib/supabase/auth';
import { ParticipantsSection } from '@/components/interactions/ParticipantsSection';
import type { Interaction } from '@/types/domain';

interface Props {
  params: Promise<{ interactionId: string }>;
}

export default async function InteractionDetailPage({ params }: Props) {
  const { interactionId } = await params;
  const supabase = await getSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId(supabase);

  if (!workspaceId) {
    return <div>No workspace found</div>;
  }

  const { data: interaction, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('id', interactionId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !interaction) {
    notFound();
  }

  const i = interaction as Interaction;

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/interactions" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back to interactions
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {i.title || `${i.interaction_type} interaction`}
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            <span className="capitalize">{i.interaction_type}</span> · {formatDate(i.occurred_at)}
          </p>
        </div>
        <Link
          href={`/interactions/${interactionId}/edit`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Edit
        </Link>
      </div>

      <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <ParticipantsSection interactionId={interactionId} workspaceId={workspaceId} />
      </div>

      {i.summary && (
        <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Summary</h2>
          <p className="mt-2 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{i.summary}</p>
        </div>
      )}

      {i.raw_text && (
        <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{i.raw_text}</p>
        </div>
      )}
    </div>
  );
}
