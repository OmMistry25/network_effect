# Conflux MVP Build Plan (Granular Tasks)

Principles:
- Each task is small, single-purpose, and testable.
- Each task has an explicit start and end state.
- After each task, you should be able to run the app and verify behavior.
- Prefer incremental vertical slices, but keep infrastructure tasks minimal.

Assumptions:
- Next.js App Router + TypeScript in `src/`
- Supabase project created (cloud) with Postgres, Auth, Storage
- Deployment later; MVP runs locally first

Notation:
- Output artifacts are file paths.
- "Test" describes a quick manual verification step.


## Phase 0: Repo and local boot

### 0.1 Initialize Next.js project
- Start: no project folder
- Steps:
  1. Create Next.js app with TypeScript and App Router.
  2. Enable `src/` directory.
- End: `package.json` exists; `src/app/page.tsx` renders.
- Output: `package.json`, `src/app/*`
- Test: `npm run dev` loads default page.

### 0.2 Add formatting and lint baseline
- Start: project runs
- Steps:
  1. Add ESLint config if not present.
  2. Add Prettier with basic rules.
  3. Add scripts: `lint`, `format`.
- End: `npm run lint` passes.
- Output: `.eslintrc.*`, `.prettierrc`, `package.json` scripts
- Test: run `npm run lint` and `npm run format`.

### 0.3 Add environment template
- Start: repo exists
- Steps:
  1. Create `.env.example` with required keys.
  2. Ensure `.env.local` is gitignored.
- End: new dev can copy `.env.example`.
- Output: `.env.example`, `.gitignore`
- Test: confirm `.env.local` not tracked.

### 0.4 Add basic app shell scaffolding
- Start: default page exists
- Steps:
  1. Create `src/components/layout/AppShell.tsx`.
  2. Create placeholder `Sidebar` and `Topbar`.
  3. Update `src/app/(app)/layout.tsx` to use AppShell.
- End: authenticated route group renders shell layout (even if auth not wired).
- Output: `src/components/layout/*`, `src/app/(app)/layout.tsx`
- Test: create temporary page under `(app)` and confirm layout renders.


## Phase 1: Supabase wiring (auth + clients)

### 1.1 Create Supabase project and capture keys
- Start: no Supabase project
- Steps:
  1. Create a Supabase project.
  2. Copy project URL and anon key into `.env.local`.
- End: `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Output: `.env.local`
- Test: none (setup only).

### 1.2 Generate typed DB definitions placeholder
- Start: no types
- Steps:
  1. Create `supabase/types/database.ts` with placeholder `Database` type.
- End: app compiles referencing `Database` type.
- Output: `supabase/types/database.ts`
- Test: `npm run dev` compiles.

### 1.3 Add Supabase browser client helper
- Start: no supabase client helpers
- Steps:
  1. Install `@supabase/supabase-js`.
  2. Create `src/lib/supabase/browserClient.ts`.
  3. Export a function that returns a singleton client.
- End: client can call `supabase.auth.getSession()` from browser.
- Output: `src/lib/supabase/browserClient.ts`
- Test: on a simple page, log session to console without crash.

### 1.4 Add Supabase server client helper
- Start: no server client
- Steps:
  1. Install `@supabase/ssr` (or equivalent official helper for App Router).
  2. Create `src/lib/supabase/serverClient.ts` using cookies.
- End: server components can read session.
- Output: `src/lib/supabase/serverClient.ts`
- Test: create server page that renders "logged in" vs "logged out" based on session.

### 1.5 Add auth route group pages
- Start: no auth UI
- Steps:
  1. Create `src/app/(auth)/login/page.tsx` with email login.
  2. Create `src/app/(auth)/signup/page.tsx` with email signup.
  3. Create `src/app/(auth)/callback/route.ts` to complete OAuth or magic link.
- End: user can sign up and sign in.
- Output: `src/app/(auth)/*`
- Test:
  - Signup with email and confirm you can log in.
  - After login, confirm session exists in server page.

### 1.6 Add middleware to protect app routes
- Start: `(app)` routes accessible without login
- Steps:
  1. Create `src/middleware.ts` that checks session.
  2. Redirect unauthenticated users to `/login`.
- End: all `(app)` pages require auth.
- Output: `src/middleware.ts`
- Test: visit `(app)` page logged out; confirm redirect to login.


## Phase 2: Database schema v1 (workspaces, people, orgs, interactions)

### 2.1 Create initial migration: core tables
- Start: no migrations
- Steps:
  1. Create `supabase/migrations/0001_init.sql`.
  2. Add tables: `workspaces`, `workspace_members`, `people`, `organizations`, `affiliations`, `interactions`, `interaction_participants`, `assets`, `interaction_assets`, `graph_edges`, `ingestion_jobs` (jobs can be empty for now).
  3. Add basic foreign keys and timestamps.
- End: migration runs successfully.
- Output: `supabase/migrations/0001_init.sql`
- Test: apply migration in Supabase SQL editor; verify tables exist.

### 2.2 Add indexes migration
- Start: tables exist
- Steps:
  1. Create `supabase/migrations/0003_indexes.sql`.
  2. Add indexes on:
     - `people(workspace_id, full_name)`
     - `organizations(workspace_id, name)`
     - `interactions(workspace_id, occurred_at desc)`
     - `interaction_participants(interaction_id)`
     - `graph_edges(workspace_id, src_id)`, `graph_edges(workspace_id, dst_id)`
- End: indexes created.
- Output: `supabase/migrations/0003_indexes.sql`
- Test: run migration; confirm no errors.

### 2.3 Enable RLS and basic policies migration
- Start: tables exist without RLS
- Steps:
  1. Create `supabase/migrations/0002_rls_policies.sql`.
  2. Enable RLS on all MVP tables.
  3. Add policies:
     - Select allowed for workspace members.
     - Insert allowed for workspace members.
     - Update and delete allowed for workspace members.
- End: RLS enabled; anon queries fail; authenticated member queries succeed.
- Output: `supabase/migrations/0002_rls_policies.sql`
- Test:
  - In Supabase SQL editor, confirm RLS enabled.
  - In app, confirm user can insert after workspace membership exists.

### 2.4 Create workspace-on-signup flow
- Start: users can sign up; no workspace membership
- Steps:
  1. Create a DB function `handle_new_user()` that:
     - creates a workspace
     - inserts workspace_members row for the user as owner
  2. Create an auth trigger on `auth.users` to run the function.
- End: every new user automatically gets a workspace and membership row.
- Output: add SQL to `0001_init.sql` or new migration `0005_workspace_trigger.sql`
- Test:
  - Create a new user.
  - Query `workspaces` and `workspace_members`; confirm created automatically.

### 2.5 Add helper query to get current workspace id
- Start: no shared workspace accessor
- Steps:
  1. Create `src/lib/supabase/auth.ts`.
  2. Add function `getActiveWorkspaceId(serverClient)` that fetches the first workspace membership.
- End: server can reliably load `workspace_id`.
- Output: `src/lib/supabase/auth.ts`
- Test: server page prints workspace id for logged-in user.


## Phase 3: People CRUD (vertical slice)

### 3.1 Define domain types for People
- Start: no domain types
- Steps:
  1. Create `src/types/domain.ts` with `Person` type matching DB columns used in UI.
- End: Person type is used by people pages.
- Output: `src/types/domain.ts`
- Test: TypeScript compiles.

### 3.2 Create People list page skeleton
- Start: no people routes
- Steps:
  1. Create `src/app/(app)/people/page.tsx`.
  2. Render a placeholder list container and "New person" button.
- End: route exists behind auth.
- Output: `src/app/(app)/people/page.tsx`
- Test: navigate to `/people` after login.

### 3.3 Implement People list query (server component)
- Start: people list is placeholder
- Steps:
  1. In people page server component, fetch `people` rows for active workspace ordered by updated_at desc.
  2. Render names in a list.
- End: page shows DB data.
- Output: `src/app/(app)/people/page.tsx`
- Test: manually insert a person in DB and confirm it appears.

### 3.4 Create Person create page with form
- Start: no create UI
- Steps:
  1. Create `src/app/(app)/people/new/page.tsx`.
  2. Add simple form fields: full_name, primary_email, title.
  3. Submit calls a server action or API route to insert row.
- End: form creates person row and redirects to person detail.
- Output: `src/app/(app)/people/new/page.tsx`
- Test: create person via UI and confirm redirect.

### 3.5 Create Person detail page
- Start: no detail UI
- Steps:
  1. Create `src/app/(app)/people/[personId]/page.tsx`.
  2. Fetch person by id and workspace id.
  3. Render fields.
- End: detail page loads reliably.
- Output: `src/app/(app)/people/[personId]/page.tsx`
- Test: open a created person and confirm values match.

### 3.6 Add edit page for Person
- Start: no edit UI
- Steps:
  1. Create `src/app/(app)/people/[personId]/edit/page.tsx`.
  2. Prefill form with existing data.
  3. Submit updates person row.
- End: edit updates DB and returns to detail.
- Output: `src/app/(app)/people/[personId]/edit/page.tsx`
- Test: edit a field and confirm it persists.

### 3.7 Add delete action for Person (soft or hard)
- Start: no delete
- Steps:
  1. Add a delete button on edit page.
  2. Implement deletion:
     - option A: hard delete if no references
     - option B: add `deleted_at` column and soft delete
- End: deleted person no longer appears in list.
- Output: UI + optional migration if soft delete
- Test: delete person and confirm list updates.


## Phase 4: Organizations + Affiliations CRUD

### 4.1 Create Organizations list page
- Start: no org routes
- Steps:
  1. Create `src/app/(app)/organizations/page.tsx`.
  2. Fetch orgs for workspace and render list.
- End: organizations list displays.
- Output: `src/app/(app)/organizations/page.tsx`
- Test: insert org in DB and confirm it renders.

### 4.2 Create Organization create page
- Start: no create org UI
- Steps:
  1. Create `src/app/(app)/organizations/new/page.tsx`.
  2. Form fields: name, domain, industry.
  3. Insert org and redirect to detail.
- End: org can be created.
- Output: `src/app/(app)/organizations/new/page.tsx`
- Test: create org via UI.

### 4.3 Create Organization detail page
- Start: no org detail UI
- Steps:
  1. Create `src/app/(app)/organizations/[orgId]/page.tsx`.
  2. Fetch org and render fields.
- End: org detail page loads.
- Output: `src/app/(app)/organizations/[orgId]/page.tsx`
- Test: open org detail.

### 4.4 Add affiliations table UI on Person detail
- Start: person detail has no affiliation section
- Steps:
  1. On person detail page, fetch affiliations joined with organizations.
  2. Render list: org name, role_title, dates.
- End: person detail shows affiliations.
- Output: `src/app/(app)/people/[personId]/page.tsx`
- Test: create affiliation row in DB and confirm display.

### 4.5 Add "Add affiliation" form (person page)
- Start: affiliations are read-only
- Steps:
  1. Add a small form to select organization and role_title.
  2. Insert affiliation.
- End: form adds an affiliation and list refreshes.
- Output: person detail component updates
- Test: add affiliation in UI; confirm row exists.

### 4.6 Add "Remove affiliation" action
- Start: cannot remove
- Steps:
  1. Add remove button per affiliation row.
  2. Delete affiliation row.
- End: row removed from UI and DB.
- Output: updated person detail
- Test: remove an affiliation and verify in DB.


## Phase 5: Interactions CRUD + Participants

### 5.1 Create Interactions list page
- Start: no interactions routes
- Steps:
  1. Create `src/app/(app)/interactions/page.tsx`.
  2. Fetch interactions ordered by occurred_at desc.
  3. Render title and occurred_at.
- End: interactions list shows data.
- Output: `src/app/(app)/interactions/page.tsx`
- Test: create an interaction in DB and confirm it appears.

### 5.2 Create Interaction detail page
- Start: no interaction detail
- Steps:
  1. Create `src/app/(app)/interactions/[interactionId]/page.tsx`.
  2. Fetch interaction by id.
  3. Fetch participants via join table.
  4. Render raw_text and summary placeholders.
- End: detail page displays interaction and participants.
- Output: `src/app/(app)/interactions/[interactionId]/page.tsx`
- Test: open interaction detail.

### 5.3 Implement capture note page (text only)
- Start: no capture flow
- Steps:
  1. Create `src/app/(app)/capture/note/page.tsx`.
  2. Add fields:
     - occurred_at (default now)
     - title (optional)
     - raw_text (required)
  3. On submit, insert interaction row.
  4. Redirect to interaction detail.
- End: you can log a note interaction.
- Output: `src/app/(app)/capture/note/page.tsx`
- Test: create a note and confirm it appears in interactions list.

### 5.4 Add participant picker to capture note
- Start: capture note creates interaction without participants
- Steps:
  1. Add a participant selector that searches people by name.
  2. On submit, insert rows into `interaction_participants`.
- End: interaction has participants.
- Output: `src/components/capture/ParticipantPicker.tsx` and capture page updates
- Test: create a note with participants and confirm they render on detail page.

### 5.5 Add quick "Log interaction" action from Person detail
- Start: person detail has no quick logging
- Steps:
  1. Add a button on person detail to create interaction with this person preselected.
  2. Route to capture note with query param `personId`.
  3. Prefill participant picker with that person.
- End: 1 click flow from person to logging an interaction.
- Output: person detail UI changes + capture page param handling
- Test: click and confirm prefilled participant.

### 5.6 Add edit interaction page (text and metadata)
- Start: cannot edit interactions
- Steps:
  1. Create edit UI at `src/app/(app)/interactions/[interactionId]/edit` or reuse detail page with edit mode.
  2. Update fields: occurred_at, title, raw_text, summary.
- End: updates persist.
- Output: new page and update action
- Test: edit raw_text and confirm saves.

### 5.7 Add remove participant from interaction
- Start: participants cannot be removed
- Steps:
  1. Add remove button next to participant on interaction detail.
  2. Delete join row.
- End: participant removed.
- Output: interaction detail UI update
- Test: remove and refresh; confirm gone.

### 5.8 Add delete interaction
- Start: cannot delete interactions
- Steps:
  1. Add delete action on interaction edit page.
  2. Delete join rows first, then interaction row.
- End: interaction removed from list.
- Output: deletion mutation
- Test: delete and confirm list updates.


## Phase 6: Asset upload (Storage) and linking to interactions

### 6.1 Create Supabase Storage bucket
- Start: no bucket
- Steps:
  1. Create private bucket named `assets`.
- End: bucket exists.
- Output: Supabase bucket config
- Test: upload a test file from Supabase dashboard.

### 6.2 Add API route to create signed upload URL
- Start: no signed upload flow
- Steps:
  1. Create `src/app/api/upload/route.ts`.
  2. Input: filename, mime_type.
  3. Output: signed URL + storage path.
- End: endpoint returns a signed upload URL for authenticated user.
- Output: `src/app/api/upload/route.ts`
- Test: call endpoint from browser devtools and confirm response.

### 6.3 Build AssetUploader component
- Start: no uploader UI
- Steps:
  1. Create `src/components/capture/AssetUploader.tsx`.
  2. Select file.
  3. Request signed URL from API.
  4. Upload file directly to Storage via PUT.
- End: component uploads file successfully.
- Output: `src/components/capture/AssetUploader.tsx`
- Test: upload file and confirm it exists in Storage.

### 6.4 Create assets DB row after upload
- Start: file exists in storage but no DB record
- Steps:
  1. After upload, insert into `assets` table with storage path and metadata.
  2. Return asset id.
- End: DB has asset row for uploaded file.
- Output: uploader component update
- Test: after upload, query `assets` table and confirm row.

### 6.5 Add capture upload page to create interaction and attach asset
- Start: no upload capture flow
- Steps:
  1. Create `src/app/(app)/capture/upload/page.tsx`.
  2. Use AssetUploader to upload and create asset row.
  3. Create interaction row.
  4. Insert `interaction_assets` linking interaction and asset.
- End: uploaded asset is linked to interaction.
- Output: `src/app/(app)/capture/upload/page.tsx`
- Test: create upload interaction; confirm `interaction_assets` row exists.

### 6.6 Show assets on interaction detail page
- Start: interaction detail does not show assets
- Steps:
  1. Fetch linked assets for the interaction.
  2. Render list with filename and type.
  3. Provide "download" link using signed URL (server generated).
- End: user can download attached assets.
- Output: interaction detail page update
- Test: open interaction with asset and download successfully.


## Phase 7: Manual graph edges + simple graph view

### 7.1 Add "Create edge" minimal UI
- Start: no edge creation
- Steps:
  1. Add a small form on person detail:
     - destination person or organization select
     - edge_type select
  2. Insert `graph_edges` row.
- End: you can manually link people and orgs.
- Output: person detail updates
- Test: create edge and verify it exists in DB.

### 7.2 Create graph page skeleton
- Start: no graph route
- Steps:
  1. Create `src/app/(app)/graph/page.tsx`.
  2. Render placeholder and load initial person selection input.
- End: graph page renders.
- Output: `src/app/(app)/graph/page.tsx`
- Test: navigate to `/graph`.

### 7.3 Implement 1-hop graph query API
- Start: graph page has no data
- Steps:
  1. Create `src/features/graph/queries.ts` with function:
     - input: node type and id
     - fetch edges where src_id or dst_id matches within workspace
     - limit edges to a safe number (example 200)
  2. Return nodes derived from edges plus root node.
- End: graph query returns predictable payload.
- Output: `src/features/graph/queries.ts`
- Test: call query from page and log payload.

### 7.4 Render basic graph as lists (no canvas yet)
- Start: graph view is empty
- Steps:
  1. On `/graph`, display:
     - root node
     - list of connected nodes
     - list of edges
- End: graph is inspectable without complex UI.
- Output: `src/app/(app)/graph/page.tsx`
- Test: create a few edges and confirm they show.

### 7.5 Add interactive graph canvas (optional for MVP)
- Start: list-based graph exists
- Steps:
  1. Add `src/components/graph/GraphCanvas.tsx` that renders nodes and edges (basic).
  2. Use a lightweight library or a minimal SVG render.
- End: user can visually inspect relationships.
- Output: `src/components/graph/*`
- Test: confirm nodes render and you can pan or click a node.


## Phase 8: Polish and MVP stabilization

### 8.1 Add navigation links for all MVP pages
- Start: routes exist but not discoverable
- Steps:
  1. Update `Sidebar` with links: Capture Note, Capture Upload, People, Orgs, Interactions, Graph, Settings.
- End: all sections reachable from sidebar.
- Output: `src/components/layout/Sidebar.tsx`
- Test: click through each link.

### 8.2 Add empty state messaging
- Start: blank lists look broken
- Steps:
  1. Add "No people yet" and similar messages on list pages.
- End: empty state is clear.
- Output: list pages updated
- Test: fresh workspace shows helpful empty text.

### 8.3 Add basic validation on forms
- Start: forms accept empty values
- Steps:
  1. Add Zod schemas for create and update forms.
  2. Reject empty `full_name` for person, empty `name` for org, empty `raw_text` for interaction.
- End: invalid submissions show error and do not write to DB.
- Output: `src/features/*/validators.ts`
- Test: submit empty form and confirm error.

### 8.4 Add minimal toast notifications for success and errors
- Start: user gets no feedback
- Steps:
  1. Add a small toast system.
  2. Show toast on create, update, delete failure and success.
- End: all actions provide feedback.
- Output: `src/components/ui/*` or a toast provider
- Test: trigger success and error states.

### 8.5 Add basic settings page with workspace info
- Start: settings page empty
- Steps:
  1. Create `src/app/(app)/settings/page.tsx`.
  2. Display workspace name and user email.
- End: settings page shows core info.
- Output: settings page file
- Test: open settings and verify fields.

### 8.6 Add basic export script (optional MVP+)
- Start: no export
- Steps:
  1. Create a script that exports people, orgs, interactions to JSON for a workspace.
- End: can run export locally using service key.
- Output: `scripts/export_workspace.ts`
- Test: run script and inspect output file.


## MVP Definition of Done (DoD)

MVP is done when all are true:
- User can sign up and log in.
- User automatically has a workspace.
- User can create, view, edit, and delete:
  - People
  - Organizations
  - Interactions
- User can attach participants to an interaction.
- User can upload an asset and link it to an interaction, then download it later.
- User can create manual graph edges and view connections (list view is acceptable).
- All core routes are behind auth and RLS prevents cross-workspace reads.
