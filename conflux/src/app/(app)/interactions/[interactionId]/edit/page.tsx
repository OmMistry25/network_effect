'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import type { Interaction } from '@/types/domain';

export default function EditInteractionPage() {
  const { interactionId } = useParams<{ interactionId: string }>();
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [summary, setSummary] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('interactions')
        .select('*')
        .eq('id', interactionId)
        .single();

      if (data) {
        const i = data as Interaction;
        setInteraction(i);
        setTitle(i.title || '');
        setRawText(i.raw_text || '');
        setSummary(i.summary || '');
        setOccurredAt(new Date(i.occurred_at).toISOString().slice(0, 16));
      }
    }
    load();
  }, [interactionId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();

    const { error: updateError } = await supabase
      .from('interactions')
      .update({
        title: title.trim() || null,
        raw_text: rawText.trim() || null,
        summary: summary.trim() || null,
        occurred_at: new Date(occurredAt).toISOString(),
      })
      .eq('id', interactionId);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push(`/interactions/${interactionId}`);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this interaction?')) return;

    setDeleting(true);
    const supabase = getSupabaseBrowserClient();

    await supabase
      .from('interaction_participants')
      .delete()
      .eq('interaction_id', interactionId);

    await supabase
      .from('interaction_assets')
      .delete()
      .eq('interaction_id', interactionId);

    const { error: deleteError } = await supabase
      .from('interactions')
      .delete()
      .eq('id', interactionId);

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }

    router.push('/interactions');
  }

  if (!interaction) {
    return <div className="text-zinc-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Link href={`/interactions/${interactionId}`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back to interaction
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Edit interaction</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            Title
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
            Notes
          </label>
          <textarea
            id="rawText"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={6}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="summary" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Summary
          </label>
          <textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
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
            {loading ? 'Saving...' : 'Save changes'}
          </button>
          <Link
            href={`/interactions/${interactionId}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Danger zone</h2>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete interaction'}
        </button>
      </div>
    </div>
  );
}
