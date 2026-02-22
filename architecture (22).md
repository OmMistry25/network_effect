# Conflux (Personal Network OS) Architecture

Stack:
- Frontend: Next.js (App Router, TypeScript)
- Backend: Supabase (Postgres + Row Level Security, Auth, Storage, Realtime, Edge Functions)
- Deployment: Vercel (Next.js) + Supabase managed project
- Optional add-ons (keep modular): pgvector for embeddings, background job runner (Supabase scheduled triggers or external worker)

Goals:
- Lightweight UI for fast capture and retrieval
- Single source of truth in Postgres
- Knowledge graph representation of people, organizations, and relationships
- Ingestion of meeting notes, voice notes, screenshots, and freeform notes
- Privacy-first multi-tenant by default (one user per tenant), with optional team workspaces later


## High-level system view

### Components
1. **Next.js Web App**
   - Capture flows (notes, uploads)
   - Search and browse (people, companies, interactions)
   - Graph view (people and org network)
   - Settings, integrations, exports

2. **Supabase**
   - **Auth**: email magic link, OAuth (Google), passkeys optional
   - **Postgres**: core entities, interactions, graph edges, extracted entities, tasks
   - **Storage**: raw files (audio, images, PDFs), derived artifacts (transcripts, thumbnails)
   - **Edge Functions**: ingestion and enrichment endpoints
   - **Realtime**: optional live updates for graph changes

3. **Ingestion and enrichment pipeline**
   - Upload file or text
   - Store raw asset and metadata
   - Create an ingestion job record
   - Process (transcribe, extract entities, link to graph)
   - Persist derived data and update search indexes

Light by default: you can run without transcription or entity extraction, then enable enrichments later.


## Data model (Postgres)

This is a minimal, scalable schema. Use UUID primary keys and strict RLS by `workspace_id` and `user_id`.

### Core tables

#### workspaces
- `id (uuid)`
- `name`
- `created_at`

#### workspace_members
- `workspace_id`
- `user_id`
- `role` (owner, member)
- Composite primary key `(workspace_id, user_id)`

#### people
- `id`
- `workspace_id`
- `full_name`
- `primary_email` (nullable)
- `phone` (nullable)
- `title` (nullable)
- `headline` (nullable)
- `notes` (nullable)
- `created_at`, `updated_at`

#### organizations
- `id`
- `workspace_id`
- `name`
- `domain` (nullable)
- `industry` (nullable)
- `notes` (nullable)
- `created_at`, `updated_at`

#### affiliations
Represents a person's relationship to an organization.
- `id`
- `workspace_id`
- `person_id`
- `organization_id`
- `role_title` (nullable)
- `start_date` (nullable)
- `end_date` (nullable)
- `is_primary` (bool)

#### interactions
Your interactions with a person or group.
- `id`
- `workspace_id`
- `occurred_at` (timestamp)
- `interaction_type` (meeting, call, email, conference, note)
- `title` (nullable)
- `summary` (nullable)
- `raw_text` (nullable)
- `created_by` (user_id)
- `source` (manual, import, integration)
- `created_at`, `updated_at`

#### interaction_participants
- `interaction_id`
- `person_id`
- Primary key `(interaction_id, person_id)`

#### assets
Stored files (audio, images, pdf, etc).
- `id`
- `workspace_id`
- `storage_bucket`
- `storage_path`
- `mime_type`
- `bytes`
- `sha256` (optional for dedupe)
- `original_filename`
- `created_by`
- `created_at`

#### interaction_assets
- `interaction_id`
- `asset_id`
- Primary key `(interaction_id, asset_id)`

### Knowledge graph tables

You can model a graph using explicit edges. This supports person-person, person-org, org-org, and custom entities later.

#### graph_nodes
Optional normalization layer if you want a unified node table.
- `id`
- `workspace_id`
- `node_type` (person, organization, topic, custom)
- `ref_id` (uuid referencing people/orgs/topics)
- `label` (denormalized)
- `created_at`

If you want to keep it simpler initially, skip `graph_nodes` and infer nodes from people/orgs.

#### graph_edges
- `id`
- `workspace_id`
- `src_type` (person, organization, topic, custom)
- `src_id` (uuid)
- `dst_type`
- `dst_id`
- `edge_type` (met, works_at, introduced_by, invested_in, teammate, advisor, friend, custom)
- `weight` (float, default 1.0)
- `evidence_interaction_id` (nullable)
- `properties` (jsonb)
- `created_at`, `updated_at`

### Enrichment tables (optional but recommended)

#### ingestion_jobs
- `id`
- `workspace_id`
- `created_by`
- `input_type` (text, audio, image, pdf)
- `interaction_id` (nullable, if tied to an interaction)
- `asset_id` (nullable)
- `status` (queued, processing, succeeded, failed)
- `error` (nullable)
- `created_at`, `updated_at`

#### transcripts
- `id`
- `workspace_id`
- `asset_id`
- `text`
- `provider` (optional)
- `created_at`

#### extracted_entities
Stores entity extraction results from text or transcript.
- `id`
- `workspace_id`
- `source_type` (interaction, transcript)
- `source_id`
- `entity_type` (person, organization, topic)
- `entity_value` (string)
- `confidence` (float)
- `linked_person_id` (nullable)
- `linked_organization_id` (nullable)
- `created_at`

#### embeddings (optional, pgvector)
- `id`
- `workspace_id`
- `source_type` (person, organization, interaction)
- `source_id`
- `content_hash`
- `embedding` (vector)
- `created_at`

Use this to power semantic search when you want it.


## Security model

### Auth
- Supabase Auth for users.
- Default to one workspace per user, created at signup.
- Optional team workspaces via `workspace_members`.

### Row Level Security (RLS)
Enable RLS on all tables. Policy pattern:
- A row is visible if `workspace_id` is in the set of workspaces where `auth.uid()` is a member.
- Writes require membership with appropriate role.

Example policy intent (conceptual):
- `SELECT`: `exists(select 1 from workspace_members wm where wm.workspace_id = table.workspace_id and wm.user_id = auth.uid())`
- `INSERT/UPDATE/DELETE`: same plus role checks where relevant.

### Storage access
- Storage buckets are private by default.
- Access via signed URLs or through server routes.
- Store `workspace_id` in object metadata or encode it in `storage_path` for policy checks.


## Next.js app architecture

### Rendering strategy
- Use Server Components for data-heavy pages where possible.
- Use Client Components for interactive views (graph, editors, capture forms).
- Keep all secrets on the server:
  - Use Supabase server client with service role only in Edge Functions or server-only API routes.
  - Use user-scoped Supabase client in the browser for normal CRUD under RLS.

### State strategy
- **Source of truth**: Supabase Postgres.
- **Server state caching**: React Query (TanStack Query) or Next.js `fetch` caching (pick one, do not mix heavily).
- **Client UI state**: Zustand for graph UI, filters, modals, selection, unsaved drafts.
- **Form state**: React Hook Form + Zod.

A clean split:
- Persistent data: database
- Shared app state: query cache
- Ephemeral UI state: local component state or Zustand
- Draft text: local until saved, then persisted as `interactions.raw_text` and `interactions.summary`


## Service connections and data flow

### Typical flow: capture meeting note
1. User opens `/capture/note`.
2. Client submits form to a server action or API route.
3. Server creates `interaction` and `interaction_participants`.
4. UI navigates to interaction detail.
5. Optional: create `ingestion_job` to extract entities and propose edges.
6. When job finishes, UI refreshes via query invalidation or Realtime.

### Typical flow: upload audio note
1. Client uploads file to Supabase Storage using signed upload URL (generated server-side).
2. Create `asset` row referencing storage path.
3. Create `interaction` (type `note` or `meeting`) and link `interaction_assets`.
4. Create `ingestion_job` with `asset_id`.
5. Edge Function:
   - downloads asset
   - transcribes to `transcripts`
   - updates `interactions.raw_text` with transcript
   - runs entity extraction and writes `extracted_entities`
   - optionally suggests `graph_edges` with `evidence_interaction_id`

### Query flow: find someone before a meeting
1. `/people` list uses Postgres full-text search or simple `ilike`.
2. `/people/[id]` fetches person, affiliations, last N interactions.
3. Graph view fetches neighborhood edges with limits:
   - nodes: person + 1-hop edges
   - edges: `graph_edges` filtered by src or dst

Keep graph queries bounded to avoid heavy payloads.


## Folder and file structure (Next.js App Router)

This structure assumes:
- `src/` enabled
- Route groups for separation of concerns
- Feature folders for people, orgs, interactions, graph

```
conflux/
  README.md
  architecture.md
  package.json
  tsconfig.json
  next.config.js
  .env.example

  supabase/
    migrations/
      0001_init.sql
      0002_rls_policies.sql
      0003_indexes.sql
      0004_pgvector_optional.sql
    seed.sql
    types/
      database.ts

  src/
    app/
      (auth)/
        login/
          page.tsx
        signup/
          page.tsx
        callback/
          route.ts
      (app)/
        layout.tsx
        page.tsx

        capture/
          note/
            page.tsx
          upload/
            page.tsx

        people/
          page.tsx
          new/
            page.tsx
          [personId]/
            page.tsx
            edit/
              page.tsx

        organizations/
          page.tsx
          new/
            page.tsx
          [orgId]/
            page.tsx

        interactions/
          page.tsx
          [interactionId]/
            page.tsx

        graph/
          page.tsx

        settings/
          page.tsx
          integrations/
            page.tsx
          export/
            page.tsx

      api/
        upload/
          route.ts
        ingestion/
          route.ts
        webhooks/
          route.ts

      globals.css
      favicon.ico

    components/
      ui/
        Button.tsx
        Input.tsx
        Modal.tsx
      layout/
        AppShell.tsx
        Sidebar.tsx
        Topbar.tsx
      capture/
        InteractionForm.tsx
        ParticipantPicker.tsx
        AssetUploader.tsx
      graph/
        GraphCanvas.tsx
        GraphControls.tsx
      people/
        PersonCard.tsx
        PersonForm.tsx
      organizations/
        OrganizationForm.tsx
      interactions/
        InteractionCard.tsx
        InteractionTimeline.tsx

    features/
      people/
        queries.ts
        mutations.ts
        validators.ts
      organizations/
        queries.ts
        mutations.ts
        validators.ts
      interactions/
        queries.ts
        mutations.ts
        validators.ts
      graph/
        queries.ts
        mutations.ts
        layout.ts

    lib/
      supabase/
        browserClient.ts
        serverClient.ts
        adminClient.ts
        auth.ts
      db/
        indexes.ts
      ingestion/
        entityExtraction.ts
        edgeSuggestion.ts
      utils/
        dates.ts
        text.ts
        hash.ts
        guard.ts

    store/
      useUIStore.ts
      useGraphStore.ts

    types/
      domain.ts
      enums.ts

    middleware.ts

  functions/
    ingest/
      index.ts
    transcribe/
      index.ts
    extract_entities/
      index.ts

  scripts/
    backfill_embeddings.ts
    backfill_nodes.ts
    export_workspace.ts

  public/
    images/
```

### What each major area does

#### `src/app/(auth)`
- Auth pages and callback route.
- Uses Supabase Auth helpers.
- Keeps auth isolated from app shell.

#### `src/app/(app)`
- Authenticated application routes.
- `layout.tsx` contains navigation and loads workspace context.
- Pages load data via server components or client queries.

#### `src/app/api/*`
- Minimal server routes for:
  - issuing signed upload URLs
  - triggering ingestion jobs
  - receiving external webhooks (optional integrations)

Prefer Edge Functions for heavy processing so the Next.js app stays fast.

#### `src/components/*`
- Presentational and interactive components.
- `graph/` is the heaviest interactive surface and should be client-only.

#### `src/features/*`
- Feature modules that define:
  - query keys and fetchers
  - mutations
  - Zod validators and input shapes
This keeps data access logic out of UI components.

#### `src/lib/supabase/*`
- `browserClient.ts`: user-scoped client for client components.
- `serverClient.ts`: server-scoped client using cookies for SSR.
- `adminClient.ts`: service role client, server-only. Use sparingly.

#### `functions/*` (Supabase Edge Functions)
- `ingest`: creates jobs, validates inputs, and orchestrates processing
- `transcribe`: pulls audio assets and writes transcripts
- `extract_entities`: extracts people, org, topic mentions and writes `extracted_entities`

Edge Functions are the right place to run network calls to third-party services and to keep keys off the client.

#### `supabase/migrations/*`
- SQL migrations for tables, indexes, and policies.
- Keep policies versioned.

#### `scripts/*`
- One-off operational scripts for backfills and exports.


## Key pages and UX primitives

### Capture
- Fast capture is core.
- `/capture/note`: single text box + participant picker + date.
- `/capture/upload`: upload first, then attach to an interaction.
- Keyboard-first UX, minimal friction.

### Person profile
- Show:
  - contact info
  - current affiliation
  - last interactions timeline
  - suggested follow-ups (optional feature)
- Add quick action: "log interaction" prefilled with that person.

### Graph
- Start with 1-hop neighborhood to keep it fast.
- Controls:
  - filter edge types
  - time window (last 30/90/365 days)
  - search node and jump
- Store graph UI state in `useGraphStore.ts`.


## Search

### Phase 1 (simple)
- Postgres `ilike` on `people.full_name`, `organizations.name`, `interactions.title`.
- Add indexes: `gin` for `to_tsvector` if you want basic full-text.

### Phase 2 (semantic, optional)
- Add `embeddings` table with pgvector.
- Write embeddings on interaction save or ingestion job success.
- Query with vector similarity and rerank.

Keep semantic search optional to preserve simplicity.


## Observability and quality

### Logging
- Edge Functions: structured logs with job id and workspace id.
- Next.js: server logs for API routes only.

### Error handling
- Ingestion jobs store `status` and `error`.
- UI shows job status on interaction detail page.

### Rate limits
- Limit ingestion concurrency per workspace:
  - enforce in Edge Function by checking active job count
  - reject or queue new jobs


## Deployment and environments

### Environments
- `development`: local Next.js, Supabase project or local supabase
- `staging`: separate Supabase project
- `production`: separate Supabase project

### Secrets
- Client: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Server-only: `SUPABASE_SERVICE_ROLE_KEY`, third-party provider keys
- Never expose service role to the browser.


## Performance notes

- Graph queries must be bounded (limit nodes and edges).
- Use pagination for interactions.
- Prefer server-side fetching for list pages to reduce client waterfalls.
- Upload with signed URLs directly to Storage to keep latency low.
- Run enrichment async so capture stays instant.


## Minimal build plan (MVP)

1. Auth + workspace
2. People CRUD
3. Organizations CRUD + affiliations
4. Interactions CRUD + participants
5. Asset upload and attach
6. Graph edges manual create + 1-hop graph view
7. Optional: ingestion jobs and transcript storage

This yields value without needing heavy AI infrastructure.
