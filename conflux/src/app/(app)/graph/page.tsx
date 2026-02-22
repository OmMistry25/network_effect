import { getSupabaseServerClient } from '@/lib/supabase/serverClient';
import { getActiveWorkspaceId } from '@/lib/supabase/auth';

export default async function GraphPage() {
  const supabase = await getSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId(supabase);

  if (!workspaceId) {
    return <div>No workspace found</div>;
  }

  const { data: edges } = await supabase
    .from('graph_edges')
    .select('*')
    .eq('workspace_id', workspaceId)
    .limit(100);

  const { data: people } = await supabase
    .from('people')
    .select('id, full_name')
    .eq('workspace_id', workspaceId);

  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('workspace_id', workspaceId);

  const nodeMap = new Map<string, string>();
  people?.forEach((p) => nodeMap.set(p.id, p.full_name));
  organizations?.forEach((o) => nodeMap.set(o.id, o.name));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Graph</h1>

      {edges && edges.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">Connections</h2>
          <ul className="space-y-2">
            {edges.map((edge) => (
              <li key={edge.id} className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-700">
                <p className="text-zinc-900 dark:text-zinc-100">
                  <span className="font-medium">{nodeMap.get(edge.src_id) || edge.src_id}</span>
                  <span className="mx-2 text-zinc-500">→</span>
                  <span className="font-medium">{nodeMap.get(edge.dst_id) || edge.dst_id}</span>
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {edge.edge_type}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400">
          No connections yet. Add edges from person detail pages.
        </p>
      )}
    </div>
  );
}
