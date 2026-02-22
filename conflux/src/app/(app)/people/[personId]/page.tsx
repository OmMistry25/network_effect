import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/serverClient';
import { getActiveWorkspaceId } from '@/lib/supabase/auth';
import type { Person } from '@/types/domain';

interface Props {
  params: Promise<{ personId: string }>;
}

export default async function PersonDetailPage({ params }: Props) {
  const { personId } = await params;
  const supabase = await getSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId(supabase);

  if (!workspaceId) {
    return <div>No workspace found</div>;
  }

  const { data: person, error } = await supabase
    .from('people')
    .select('*')
    .eq('id', personId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !person) {
    notFound();
  }

  const p = person as Person;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/people" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back to people
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{p.full_name}</h1>
          {p.title && (
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{p.title}</p>
          )}
        </div>
        <Link
          href={`/people/${personId}/edit`}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Edit
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {p.primary_email && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{p.primary_email}</dd>
          </div>
        )}

        {p.phone && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Phone</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{p.phone}</dd>
          </div>
        )}

        {p.headline && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Headline</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{p.headline}</dd>
          </div>
        )}

        {p.notes && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{p.notes}</dd>
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Affiliations</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No affiliations yet.</p>
      </div>

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Recent Interactions</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No interactions yet.</p>
      </div>
    </div>
  );
}
