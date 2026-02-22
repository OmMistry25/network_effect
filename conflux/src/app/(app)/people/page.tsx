import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/serverClient';
import { getActiveWorkspaceId } from '@/lib/supabase/auth';
import type { Person } from '@/types/domain';

export default async function PeoplePage() {
  const supabase = await getSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId(supabase);

  if (!workspaceId) {
    return <div>No workspace found</div>;
  }

  const { data: people, error } = await supabase
    .from('people')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (error) {
    return <div>Error loading people: {error.message}</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">People</h1>
        <Link
          href="/people/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add person
        </Link>
      </div>

      {people && people.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {(people as Person[]).map((person) => (
            <li key={person.id}>
              <Link
                href={`/people/${person.id}`}
                className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {person.full_name}
                </p>
                {person.title && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{person.title}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400">No people yet. Add your first contact.</p>
      )}
    </div>
  );
}
