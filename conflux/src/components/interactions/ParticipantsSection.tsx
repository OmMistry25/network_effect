'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import type { Person } from '@/types/domain';

interface ParticipantWithPerson {
  person_id: string;
  person: { id: string; full_name: string };
}

interface Props {
  interactionId: string;
  workspaceId: string;
}

export function ParticipantsSection({ interactionId, workspaceId }: Props) {
  const [participants, setParticipants] = useState<ParticipantWithPerson[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const supabase = getSupabaseBrowserClient();

      const [participantsRes, peopleRes] = await Promise.all([
        supabase
          .from('interaction_participants')
          .select('person_id, person:people(id, full_name)')
          .eq('interaction_id', interactionId),
        supabase
          .from('people')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('full_name'),
      ]);

      if (cancelled) return;

      if (participantsRes.data) {
        setParticipants(participantsRes.data as unknown as ParticipantWithPerson[]);
      }
      if (peopleRes.data) {
        setPeople(peopleRes.data as Person[]);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [interactionId, workspaceId, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPersonId) return;

    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    await supabase.from('interaction_participants').insert({
      interaction_id: interactionId,
      person_id: selectedPersonId,
    });

    setSelectedPersonId('');
    setShowForm(false);
    setLoading(false);
    refresh();
    router.refresh();
  }

  async function handleRemove(personId: string) {
    const supabase = getSupabaseBrowserClient();
    await supabase
      .from('interaction_participants')
      .delete()
      .eq('interaction_id', interactionId)
      .eq('person_id', personId);
    refresh();
    router.refresh();
  }

  const participantIds = new Set(participants.map((p) => p.person_id));
  const availablePeople = people.filter((p) => !participantIds.has(p.id));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Participants</h2>
        {!showForm && availablePeople.length > 0 && (
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
            <label htmlFor="person" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Person
            </label>
            <select
              id="person"
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            >
              <option value="">Select person...</option>
              {availablePeople.map((person) => (
                <option key={person.id} value={person.id}>{person.full_name}</option>
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

      {participants.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {participants.map((p) => (
            <li key={p.person_id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <Link
                href={`/people/${p.person.id}`}
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {p.person.full_name}
              </Link>
              <button
                onClick={() => handleRemove(p.person_id)}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !showForm && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No participants yet.</p>
      )}
    </div>
  );
}
