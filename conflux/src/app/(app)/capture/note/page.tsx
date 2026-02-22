'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import type { Person } from '@/types/domain';

export default function CaptureNotePage() {
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [interactionType, setInteractionType] = useState<string>('note');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function loadPeople() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) return;

      const { data: peopleData } = await supabase
        .from('people')
        .select('*')
        .eq('workspace_id', membership.workspace_id)
        .order('full_name');

      if (peopleData) {
        setPeople(peopleData as Person[]);
      }

      const preselectedPersonId = searchParams.get('personId');
      if (preselectedPersonId) {
        setSelectedParticipants([preselectedPersonId]);
      }
    }
    loadPeople();
  }, [searchParams]);

  function toggleParticipant(personId: string) {
    setSelectedParticipants((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      setError('No workspace found');
      setLoading(false);
      return;
    }

    const { data: interaction, error: insertError } = await supabase
      .from('interactions')
      .insert({
        workspace_id: membership.workspace_id,
        title: title.trim() || null,
        raw_text: rawText.trim(),
        occurred_at: new Date(occurredAt).toISOString(),
        interaction_type: interactionType,
        created_by: user.id,
        source: 'manual',
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    if (selectedParticipants.length > 0) {
      await supabase.from('interaction_participants').insert(
        selectedParticipants.map((personId) => ({
          interaction_id: interaction.id,
          person_id: personId,
        }))
      );
    }

    router.push(`/interactions/${interaction.id}`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Link href="/interactions" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back to interactions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Log interaction</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Type
          </label>
          <select
            id="type"
            value={interactionType}
            onChange={(e) => setInteractionType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="note">Note</option>
            <option value="meeting">Meeting</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="conference">Conference</option>
          </select>
        </div>

        <div>
          <label htmlFor="occurredAt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            When
          </label>
          <input
            id="occurredAt"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Title (optional)
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="rawText" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notes *
          </label>
          <textarea
            id="rawText"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            required
            rows={6}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Participants
          </label>
          {people.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => toggleParticipant(person.id)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    selectedParticipants.includes(person.id)
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {person.full_name}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              No people yet.{' '}
              <Link href="/people/new" className="underline">Add someone first</Link>.
            </p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? 'Saving...' : 'Save interaction'}
          </button>
          <Link
            href="/interactions"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
