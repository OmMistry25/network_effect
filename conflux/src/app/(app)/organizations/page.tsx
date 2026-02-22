import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/serverClient';
import { getActiveWorkspaceId } from '@/lib/supabase/auth';
import type { Organization } from '@/types/domain';

export default async function OrganizationsPage() {
  const supabase = await getSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId(supabase);

  if (!workspaceId) {
    return <div>No workspace found</div>;
  }

  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (error) {
    return <div>Error loading organizations: {error.message}</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Organizations</h1>
        <Link
          href="/organizations/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add organization
        </Link>
      </div>

      {organizations && organizations.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {(organizations as Organization[]).map((org) => (
            <li key={org.id}>
              <Link
                href={`/organizations/${org.id}`}
                className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{org.name}</p>
                {org.industry && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{org.industry}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400">No organizations yet. Add your first organization.</p>
      )}
    </div>
  );
}
