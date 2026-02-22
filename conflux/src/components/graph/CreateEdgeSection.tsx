'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import type { Person, Organization } from '@/types/domain';

interface Props {
  personId: string;
  workspaceId: string;
}

const EDGE_TYPES = [
  'met',
  'works_with',
  'introduced_by',
  'invested_in',
  'teammate',
  'advisor',
  'friend',
  'knows',
];

export function CreateEdgeSection({ personId, workspaceId }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [targetType, setTargetType] = useState<'person' | 'organization'>('person');
  const [targetId, setTargetId] = useState('');
  const [edgeType, setEdgeType] = useState('knows');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();

      const [peopleRes, orgsRes] = await Promise.all([
        supabase.from('people').select('*').eq('workspace_id', workspaceId).order('full_name'),
        supabase.from('organizations').select('*').eq('workspace_id', workspaceId).order('name'),
      ]);

      if (peopleRes.data) setPeople(peopleRes.data.filter((p) => p.id !== personId) as Person[]);
      if (orgsRes.data) setOrganizations(orgsRes.data as Organization[]);
    }
    load();
  }, [personId, workspaceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) return;

    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    await supabase.from('graph_edges').insert({
      workspace_id: workspaceId,
      src_type: 'person',
      src_id: personId,
      dst_type: targetType,
      dst_id: targetId,
      edge_type: edgeType,
    });

    setTargetId('');
    setShowForm(false);
    setLoading(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Connections</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            + Add connection
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Connect to
            </label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => { setTargetType('person'); setTargetId(''); }}
                className={`rounded-md px-3 py-1 text-sm ${
                  targetType === 'person'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300'
                }`}
              >
                Person
              </button>
              <button
                type="button"
                onClick={() => { setTargetType('organization'); setTargetId(''); }}
                className={`rounded-md px-3 py-1 text-sm ${
                  targetType === 'organization'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300'
                }`}
              >
                Organization
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="target" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {targetType === 'person' ? 'Person' : 'Organization'}
            </label>
            <select
              id="target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            >
              <option value="">Select...</option>
              {targetType === 'person'
                ? people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)
                : organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)
              }
            </select>
          </div>

          <div>
            <label htmlFor="edgeType" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Relationship
            </label>
            <select
              id="edgeType"
              value={edgeType}
              onChange={(e) => setEdgeType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            >
              {EDGE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        View all connections on the Graph page.
      </p>
    </div>
  );
}
