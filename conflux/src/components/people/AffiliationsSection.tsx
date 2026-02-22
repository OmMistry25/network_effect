'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import type { Organization } from '@/types/domain';

interface AffiliationWithOrg {
  id: string;
  organization_id: string;
  role_title: string | null;
  is_primary: boolean;
  organization: { name: string };
}

interface Props {
  personId: string;
  workspaceId: string;
}

export function AffiliationsSection({ personId, workspaceId }: Props) {
  const [affiliations, setAffiliations] = useState<AffiliationWithOrg[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    
    async function fetchData() {
      const supabase = getSupabaseBrowserClient();

      const [affiliationsRes, orgsRes] = await Promise.all([
        supabase
          .from('affiliations')
          .select('id, organization_id, role_title, is_primary, organization:organizations(name)')
          .eq('person_id', personId),
        supabase
          .from('organizations')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('name'),
      ]);

      if (cancelled) return;

      if (affiliationsRes.data) {
        setAffiliations(affiliationsRes.data as unknown as AffiliationWithOrg[]);
      }
      if (orgsRes.data) {
        setOrganizations(orgsRes.data as Organization[]);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [personId, workspaceId, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgId) return;

    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    await supabase.from('affiliations').insert({
      workspace_id: workspaceId,
      person_id: personId,
      organization_id: selectedOrgId,
      role_title: roleTitle.trim() || null,
      is_primary: affiliations.length === 0,
    });

    setSelectedOrgId('');
    setRoleTitle('');
    setShowForm(false);
    setLoading(false);
    refresh();
    router.refresh();
  }

  async function handleRemove(affiliationId: string) {
    const supabase = getSupabaseBrowserClient();
    await supabase.from('affiliations').delete().eq('id', affiliationId);
    refresh();
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Affiliations</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            + Add
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mt-3 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <div>
            <label htmlFor="org" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Organization
            </label>
            <select
              id="org"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            >
              <option value="">Select organization...</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Role/Title
            </label>
            <input
              id="role"
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
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

      {affiliations.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {affiliations.map((aff) => (
            <li key={aff.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{aff.organization.name}</p>
                {aff.role_title && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{aff.role_title}</p>
                )}
              </div>
              <button
                onClick={() => handleRemove(aff.id)}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !showForm && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No affiliations yet.</p>
      )}
    </div>
  );
}
