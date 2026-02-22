'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import { matchEntities, type MatchResult } from '@/lib/ai/entityMatcher';
import type { Person, Organization } from '@/types/domain';

type CaptureStep = 'record' | 'processing' | 'review' | 'saving';

interface EntityDecision {
  matchResult: MatchResult;
  action: 'link' | 'create' | 'skip';
  linkedId?: string;
  newName?: string;
  updateTitle?: boolean;
  createAffiliation?: boolean;
}

export default function SmartCapturePage() {
  const [step, setStep] = useState<CaptureStep>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [entityDecisions, setEntityDecisions] = useState<EntityDecision[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadExistingEntities();
  }, []);

  async function loadExistingEntities() {
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
    setWorkspaceId(membership.workspace_id);

    const [peopleRes, orgsRes] = await Promise.all([
      supabase.from('people').select('*').eq('workspace_id', membership.workspace_id),
      supabase.from('organizations').select('*').eq('workspace_id', membership.workspace_id),
    ]);

    if (peopleRes.data) setPeople(peopleRes.data as Person[]);
    if (orgsRes.data) setOrganizations(orgsRes.data as Organization[]);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Could not access microphone. Please grant permission.');
      console.error(err);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function processAudio() {
    if (!audioBlob) return;
    setStep('processing');
    setError(null);

    try {
      // Transcribe
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeRes.ok) throw new Error('Transcription failed');
      const { text } = await transcribeRes.json();
      setTranscript(text);

      await extractAndMatch(text);
    } catch (err) {
      setError('Processing failed. Please try again.');
      setStep('record');
      console.error(err);
    }
  }

  async function processText() {
    if (!transcript.trim()) return;
    setStep('processing');
    setError(null);

    try {
      await extractAndMatch(transcript);
    } catch (err) {
      setError('Processing failed. Please try again.');
      setStep('record');
      console.error(err);
    }
  }

  async function extractAndMatch(text: string) {
    const extractRes = await fetch('/api/extract-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        existingPeople: people.map((p) => ({ full_name: p.full_name, title: p.title })),
        existingOrgs: organizations.map((o) => ({ name: o.name })),
      }),
    });

    if (!extractRes.ok) throw new Error('Entity extraction failed');
    const { entities, summary: extractedSummary } = await extractRes.json();

    setSummary(extractedSummary || '');

    const matchResults = matchEntities(entities, people, organizations);
    const decisions: EntityDecision[] = matchResults.map((mr) => ({
      matchResult: mr,
      action: mr.suggestedAction === 'link' ? 'link' : mr.suggestedAction === 'create' ? 'create' : 'skip',
      linkedId: mr.match.existingId,
      newName: mr.extractedName,
      updateTitle: mr.match.type !== 'new' && !!mr.title,
      createAffiliation: !!mr.organizationName,
    }));

    setEntityDecisions(decisions);
    setStep('review');
  }

  function updateDecision(index: number, updates: Partial<EntityDecision>) {
    setEntityDecisions((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...updates } : d))
    );
  }

  async function saveInteraction() {
    if (!workspaceId) return;
    setStep('saving');

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const participantIds: string[] = [];

      // First pass: create any new organizations so we have their IDs
      const newOrgIds = new Map<string, string>();
      for (const decision of entityDecisions) {
        if (decision.action === 'skip') continue;
        if (decision.matchResult.type === 'organization' && decision.action === 'create') {
          const { data: newOrg } = await supabase
            .from('organizations')
            .insert({
              workspace_id: workspaceId,
              name: decision.newName || decision.matchResult.extractedName,
              notes: `Auto-created from interaction. Context: ${decision.matchResult.context}`,
            })
            .select()
            .single();
          if (newOrg) {
            newOrgIds.set(decision.matchResult.extractedName.toLowerCase(), newOrg.id);
          }
        }
      }

      // Second pass: process people
      for (const decision of entityDecisions) {
        if (decision.action === 'skip') continue;
        if (decision.matchResult.type !== 'person') continue;

        let personId: string | undefined;

        if (decision.action === 'link' && decision.linkedId) {
          personId = decision.linkedId;
          participantIds.push(personId);

          // Update title if requested
          if (decision.updateTitle && decision.matchResult.title) {
            await supabase
              .from('people')
              .update({ title: decision.matchResult.title })
              .eq('id', personId);
          }
        } else if (decision.action === 'create') {
          const { data: newPerson } = await supabase
            .from('people')
            .insert({
              workspace_id: workspaceId,
              full_name: decision.newName || decision.matchResult.extractedName,
              title: decision.matchResult.title || null,
              notes: `Auto-created from interaction. Context: ${decision.matchResult.context}`,
            })
            .select()
            .single();

          if (newPerson) {
            personId = newPerson.id;
            participantIds.push(personId);
          }
        }

        // Create affiliation if person has org association
        if (personId && decision.createAffiliation && decision.matchResult.organizationName) {
          let orgId = decision.matchResult.organizationId;
          
          // Check if org was just created
          if (!orgId) {
            orgId = newOrgIds.get(decision.matchResult.organizationName.toLowerCase());
          }

          if (orgId) {
            // Check if affiliation already exists
            const { data: existingAff } = await supabase
              .from('affiliations')
              .select('id')
              .eq('person_id', personId)
              .eq('organization_id', orgId)
              .limit(1);

            if (!existingAff || existingAff.length === 0) {
              await supabase.from('affiliations').insert({
                workspace_id: workspaceId,
                person_id: personId,
                organization_id: orgId,
                role_title: decision.matchResult.title || null,
                is_primary: true,
              });
            }
          }
        }
      }

      // Create interaction
      const { data: interaction } = await supabase
        .from('interactions')
        .insert({
          workspace_id: workspaceId,
          title: summary.slice(0, 100) || 'Voice note',
          raw_text: transcript,
          summary: summary,
          occurred_at: new Date().toISOString(),
          interaction_type: 'note',
          created_by: user.id,
          source: 'manual',
        })
        .select()
        .single();

      if (interaction && participantIds.length > 0) {
        await supabase.from('interaction_participants').insert(
          participantIds.map((personId) => ({
            interaction_id: interaction.id,
            person_id: personId,
          }))
        );
      }

      router.push(`/interactions/${interaction?.id}`);
    } catch (err) {
      setError('Failed to save. Please try again.');
      setStep('review');
      console.error(err);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/interactions" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Back to interactions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Smart Capture</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Record or type your notes - we&apos;ll automatically detect people and organizations.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {step === 'record' && (
        <div className="space-y-6">
          {/* Voice Recording */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">Voice Recording</h2>
            <div className="flex flex-col items-center gap-4">
              {!audioBlob ? (
                <>
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex h-20 w-20 items-center justify-center rounded-full text-white transition-all ${
                      isRecording
                        ? 'animate-pulse bg-red-500 hover:bg-red-600'
                        : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900'
                    }`}
                  >
                    {isRecording ? (
                      <span className="h-6 w-6 rounded bg-white" />
                    ) : (
                      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    )}
                  </button>
                  <p className="text-sm text-zinc-500">
                    {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
                  </p>
                </>
              ) : (
                <>
                  <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAudioBlob(null)}
                      className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
                    >
                      Re-record
                    </button>
                    <button
                      onClick={processAudio}
                      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Process Recording
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Or Text Input */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-zinc-500 dark:bg-zinc-950">or type notes</span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste or type your meeting notes here..."
              rows={6}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
            <button
              onClick={processText}
              disabled={!transcript.trim()}
              className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Process Text
            </button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Analyzing your notes...</p>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Summary</h2>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Transcript */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Transcript</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">{transcript}</p>
          </div>

          {/* Detected Entities */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <h2 className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Detected Entities ({entityDecisions.length})
            </h2>

            {entityDecisions.length === 0 ? (
              <p className="text-sm text-zinc-500">No entities detected.</p>
            ) : (
              <div className="space-y-3">
                {entityDecisions.map((decision, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-zinc-200 p-3 dark:border-zinc-600"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                            decision.matchResult.type === 'person'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          }`}>
                            {decision.matchResult.type}
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {decision.matchResult.extractedName}
                          </span>
                          {decision.matchResult.title && (
                            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                              {decision.matchResult.title}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">{decision.matchResult.context}</p>
                        {decision.matchResult.organizationName && (
                          <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                            📍 Associated with: {decision.matchResult.organizationName}
                          </p>
                        )}
                        {decision.matchResult.match.type === 'partial' && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            Possible match: {decision.matchResult.match.existingName} ({Math.round(decision.matchResult.match.score * 100)}% confident)
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        {Math.round(decision.matchResult.confidence * 100)}%
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {decision.matchResult.match.existingId && (
                        <button
                          onClick={() => updateDecision(index, { action: 'link', linkedId: decision.matchResult.match.existingId })}
                          className={`rounded-md px-3 py-1 text-sm ${
                            decision.action === 'link'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                              : 'border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          Link to {decision.matchResult.match.existingName}
                        </button>
                      )}
                      <button
                        onClick={() => updateDecision(index, { action: 'create' })}
                        className={`rounded-md px-3 py-1 text-sm ${
                          decision.action === 'create'
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        Create New
                      </button>
                      <button
                        onClick={() => updateDecision(index, { action: 'skip' })}
                        className={`rounded-md px-3 py-1 text-sm ${
                          decision.action === 'skip'
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        Skip
                      </button>
                    </div>

                    {/* Additional options for people with context */}
                    {decision.matchResult.type === 'person' && decision.action !== 'skip' && (
                      <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-700">
                        {decision.action === 'link' && decision.matchResult.title && (
                          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={decision.updateTitle ?? true}
                              onChange={(e) => updateDecision(index, { updateTitle: e.target.checked })}
                              className="rounded border-zinc-300"
                            />
                            Update title to &quot;{decision.matchResult.title}&quot;
                          </label>
                        )}
                        {decision.matchResult.organizationName && (
                          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={decision.createAffiliation ?? true}
                              onChange={(e) => updateDecision(index, { createAffiliation: e.target.checked })}
                              className="rounded border-zinc-300"
                            />
                            {decision.action === 'link' ? 'Add' : 'Create'} affiliation with {decision.matchResult.organizationName}
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveInteraction}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save Interaction
            </button>
            <button
              onClick={() => setStep('record')}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">Saving...</p>
        </div>
      )}
    </div>
  );
}
