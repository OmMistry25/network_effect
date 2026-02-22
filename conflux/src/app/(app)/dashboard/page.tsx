import { getSupabaseServerClient } from '@/lib/supabase/serverClient';

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {session ? `Logged in as ${session.user.email}` : 'Not logged in'}
      </p>
    </div>
  );
}
