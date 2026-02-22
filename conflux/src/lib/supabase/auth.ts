import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../supabase/types/database';

export async function getActiveWorkspaceId(
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  return membership?.workspace_id ?? null;
}
