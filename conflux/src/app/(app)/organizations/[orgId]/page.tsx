import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/serverClient';
import { getActiveWorkspaceId } from '@/lib/supabase/auth';
import type { Organization } from '@/types/domain';

interface Props {
  params: Promise<{ orgId: string }>;
}

export default async function OrganizationDetailPage({ params }: Props) {
  const { orgId } = await params;
  const supabase = await getSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId(supabase);

  if (!workspaceId) {
    return <div>No workspace found</div>;
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !org) {
    notFound();
  }

  const o = org as Organization;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/organizations" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back to organizations
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{o.name}</h1>
          {o.industry && (
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{o.industry}</p>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {o.domain && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Domain</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{o.domain}</dd>
          </div>
        )}

        {o.notes && (
          <div>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{o.notes}</dd>
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">People at this organization</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No people affiliated yet.</p>
      </div>
    </div>
  );
}
