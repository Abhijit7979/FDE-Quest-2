# Product Requirements Document

## Project: Sketch-to-Form Builder

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Draft |
| **Date** | 2026-05-19 |
| **Author** | Engineering |

---

## 1. Overview

### 1.1 Vision

A web application that lets users transform a hand-drawn paper sketch of a form into a fully functional, shareable digital form. An AI agent interprets the sketch, generates a structured form, allows user refinement, and exposes a public URL for collecting responses.

### 1.2 Problem statement

Form builders today require users to manually drag-and-drop every field. People often start by sketching forms on paper (workshops, planning sessions, onsite design). Recreating that sketch digitally is repetitive and slow.

### 1.3 Solution

An authenticated workspace where the user:
1. Logs in via Supabase auth.
2. Uploads a photo of a paper sketch.
3. An LLM agent (orchestrated via LangGraph) extracts fields and produces a structured form schema.
4. The user edits the generated form in a visual editor.
5. The user publishes a public share URL to collect responses.
6. The user views responses in a dashboard.

### 1.4 Success metrics

| Metric | Target |
|--------|--------|
| Time from sketch upload to editable draft (p50) | < 45s |
| Time from sketch upload to editable draft (p95) | < 120s |
| Field-extraction accuracy (manual eval, 50 sketches) | ≥ 80% fields correct without edit |
| Successful publish → first response (median) | < 5 min |

### 1.5 Out of scope (v1)

- Team workspaces / collaborative editing
- Conditional logic, multi-page forms, page branching
- Payments and quotas
- Native mobile apps
- White-label / custom domains
- Webhooks and third-party integrations (Zapier, Sheets, etc.)

---

## 2. Users

| Persona | Description | Goals |
|---------|-------------|-------|
| **Creator** | Authenticated user (teacher, organizer, small business owner) | Quickly turn a paper draft into a live form and collect answers |
| **Respondent** | Anonymous visitor with a share link | Fill the form quickly on any device |

---

## 3. User stories

### 3.1 Authentication

| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| A-1 | Sign up with email + password | Supabase Auth flow; verification email; clear error states |
| A-2 | Log in | Persistent SSR session via `@supabase/ssr`; redirect to `/home` |
| A-3 | Log out | Session invalidated; protected routes redirect to `/login` |
| A-4 | Forgot password | Supabase reset email; UI confirmation |

### 3.2 App shell

| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| S-1 | Persistent sidebar after login | Items: **Home**, **Create Forms**, **Forms Responses**; active route highlighted |
| S-2 | Sidebar collapses on mobile | Hamburger toggle below md breakpoint |
| S-3 | User menu | Shows email; **Log out** action |

### 3.3 Home

| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| H-1 | Overview cards | Total forms, total responses, recent activity |
| H-2 | Quick actions | "Create new form" CTA → `/forms/create` |
| H-3 | Recent forms list | Title, status, response count, edit + share buttons |

### 3.4 Create Forms (sketch → AI → editor)

| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| C-1 | Upload sketch | Accepts JPEG, PNG, WebP; max 10 MB; drag-and-drop + file picker; client-side preview |
| C-2 | Trigger generation | Progress states: uploading → analyzing → building; cancel supported |
| C-3 | Review generated form | Editor shows inferred fields: label, type, required, options |
| C-4 | Edit form | Add/remove/reorder fields; change types; edit labels, placeholders, validation; live preview |
| C-5 | Save draft | Auto-save every 5s when changes pending; explicit save also works |
| C-6 | Publish | Sets `status = published`, generates stable `public_slug`, surfaces share URL |
| C-7 | Regenerate | Re-run AI on a new sketch with confirmation (overwrites draft) |
| C-8 | Manual start | "Start blank" option bypasses sketch upload |

**Supported field types (v1)**

- Short text, long text
- Email, number, phone
- Single choice (radio), multiple choice (checkbox), dropdown
- Date
- Yes/No

### 3.5 Share and respond

| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| SH-1 | Copy share link | Format `{APP_URL}/f/{public_slug}`; one-click copy with toast |
| SH-2 | Public page | Renders without auth; 404 for unknown / unpublished slugs |
| SH-3 | Submit response | Client + server validation; success thank-you screen |
| SH-4 | Mobile-friendly | Single-column layout, large tap targets |

### 3.6 Forms Responses

| ID | Story | Acceptance criteria |
|----|-------|---------------------|
| R-1 | List responses per form | Sortable by submitted_at; pagination |
| R-2 | View single response | All answers keyed by field label |
| R-3 | Delete response | Confirm dialog; owner only |
| R-4 | Response count badge | Live or near-live count on form list |

---

## 4. Architecture

```
+----------------------+        +--------------------------+
|  Next.js (App Router)| <----> | FastAPI (AI orchestration)|
|  shadcn/ui           |        | LangChain + LangGraph     |
+----------+-----------+        +-------------+------------+
           |                                  |
           v                                  v
   +-------+-------+                  +-------+-------+
   | Supabase Auth |                  | LLM provider  |
   | Postgres + RLS|                  | (OpenAI/Anth.) |
   | Storage       |                  +---------------+
   +---------------+
```

### 4.1 Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Next.js** | UI, routing, auth session (SSR cookies), direct Supabase reads where RLS suffices, form editor, public form page |
| **FastAPI** | Sketch-to-form AI pipeline, server-side schema validation, rate limiting |
| **Supabase** | Auth, Postgres (forms, responses), Storage (sketches), RLS enforcement |
| **LangGraph** | Stateful agent graph: image ingest → vision extract → normalize → validate → repair → persist |

### 4.2 Communication

- **Browser → Supabase**: auth, CRUD on forms / responses where RLS applies, sketch upload to Storage.
- **Browser → FastAPI**: `Authorization: Bearer <jwt>`; passes `storage_path` of uploaded sketch.
- **FastAPI → Supabase**: uses user JWT (preferred) for writes; service role only where strictly needed.

---

## 5. Data model

### 5.1 Tables

**`profiles`** — extends `auth.users`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | FK → `auth.users.id` |
| email | text | denormalized |
| display_name | text | optional |
| created_at | timestamptz | |

**`forms`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| owner_id | uuid FK | → `profiles.id` |
| title | text | |
| description | text | optional |
| status | enum | `draft`, `published`, `archived` |
| public_slug | text UNIQUE | nullable until published |
| definition | jsonb | field schema (see §5.2) |
| sketch_path | text | Storage path |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| published_at | timestamptz | nullable |

**`form_responses`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| form_id | uuid FK | → `forms.id` (ON DELETE CASCADE) |
| answers | jsonb | `{ fieldId: value }` |
| submitted_at | timestamptz | |
| respondent_meta | jsonb | UA + hashed IP |

**`generation_jobs`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| form_id | uuid FK | |
| owner_id | uuid FK | |
| status | enum | `pending`, `processing`, `completed`, `failed` |
| error | text | |
| created_at, completed_at | timestamptz | |

### 5.2 `definition` JSON shape

```json
{
  "version": 1,
  "fields": [
    {
      "id": "f_1",
      "type": "short_text",
      "label": "Full name",
      "required": true,
      "placeholder": "",
      "needs_review": false
    },
    {
      "id": "f_2",
      "type": "single_choice",
      "label": "Department",
      "required": true,
      "options": ["Sales", "Engineering", "HR"],
      "needs_review": true
    }
  ]
}
```

### 5.3 RLS policies

- `forms`: all CRUD where `owner_id = auth.uid()`.
- `forms` public read: dedicated `public_forms` view returning only `public_slug`, `title`, `description`, `definition` for `status = 'published'`.
- `form_responses`: anonymous INSERT only when parent form is published (via `EXISTS` subquery); SELECT/DELETE only by form owner.

---

## 6. API (FastAPI)

Base path: `/api/v1`

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/forms/generate` | JWT | Body: `storage_path`, optional `form_id`. Returns `job_id` (async) or `definition` (sync). |
| GET | `/forms/generate/{job_id}` | JWT | Poll job status + result |
| POST | `/forms/validate` | JWT | Validate definition JSON server-side |
| GET | `/health` | none | Health check |

**Sample response**

```json
{
  "form_id": "uuid",
  "status": "completed",
  "definition": { "version": 1, "fields": [] },
  "warnings": ["Field 'Date of birth' inferred as text; please confirm."]
}
```

---

## 7. AI / LangGraph pipeline

### 7.1 Nodes

1. **preprocess** — resize/normalize image, EXIF strip.
2. **vision_extract** — multimodal LLM extracts visual blocks: labels, input lines, checkboxes, radio circles, dropdown arrows, section headers.
3. **structure** — map extracted blocks to internal field schema (type, label, options, required hint).
4. **validate** — JSON schema validation against internal contract.
5. **repair** — on validation failure, one retry with the error message provided to the LLM.
6. **persist** — write `definition` to `forms`, mark `generation_jobs` complete.

### 7.2 Provider abstraction

- LangChain chat model interface, configurable via env: `LLM_PROVIDER`, model name, API key.
- Default: a vision-capable model (e.g. GPT-4o or Claude Sonnet vision class).
- Logs prompts and responses with PII redaction.

### 7.3 Prompting rules

- Output **only** JSON matching internal schema.
- Mark `needs_review: true` for low-confidence or ambiguous fields.
- Preserve label wording verbatim where legible.

---

## 8. UI / UX (shadcn/ui)

| Area | Components |
|------|------------|
| Auth | `Card`, `Form`, `Input`, `Button`, `Toast` |
| Sidebar | `Sidebar` shell with `lucide-react` icons |
| Create flow | Stepper: Upload → Generating → Edit → Publish |
| Editor | Field list (drag-and-drop), property panel, live preview |
| Public form | Centered card, mobile-first, accessible labels |
| Responses | `DataTable` with pagination + detail `Sheet` |

**Accessibility**: WCAG 2.1 AA for public forms — labeled inputs, focus order, error announcement.

---

## 9. Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/login`, `/signup`, `/forgot-password` | public | Auth |
| `/home` | private | Dashboard |
| `/forms/create` | private | Sketch → AI → editor |
| `/forms/[id]/edit` | private | Edit existing form |
| `/forms/responses` | private | Responses across forms |
| `/forms/[id]/responses` | private | Responses for one form |
| `/f/[slug]` | public | Respondent view |

---

## 10. Security

| Topic | Requirement |
|-------|-------------|
| Auth | Supabase Auth; httpOnly cookies via `@supabase/ssr` |
| Authorization | RLS on all tables; FastAPI verifies JWT via `SUPABASE_JWT_SECRET` |
| Sketch storage | Private bucket; signed URLs for backend reads only |
| Public slug | `nanoid(12)` → unguessable |
| Rate limiting | Per-IP and per-slug on submit; per-user on `/forms/generate` |
| Secrets | LLM provider keys server-side only |

---

## 11. Non-functional requirements

| Category | Target |
|----------|--------|
| Public form TTFB | < 2s |
| Generation p95 | < 90s |
| Availability | 99.5% |
| Observability | Structured logs + Sentry; generation success rate metric |
| i18n | English only v1 |

---

## 12. Environment variables

**Next.js**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

**FastAPI**

- `SUPABASE_URL`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` (if required)
- `LLM_PROVIDER`, `OPENAI_API_KEY` (or equivalent)

---

## 13. Milestones

| Phase | Scope | Duration |
|-------|-------|----------|
| **P1 — Foundation** | Repo scaffold (Next.js + FastAPI), Supabase project, auth, sidebar shell, Home placeholder | 2 weeks |
| **P2 — Manual builder** | Editor, draft/publish, public slug page, response submit + list | 2 weeks |
| **P3 — AI pipeline** | Sketch upload, FastAPI + LangGraph generate, editor hydration, `needs_review` UX | 3 weeks |
| **P4 — Polish** | Error states, loading skeletons, rate limits, monitoring | 1 week |

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| Bad sketch quality → bad schema | Manual editor + retry + photo tips |
| LLM cost / latency | Async jobs, image size cap, caching by image hash |
| Public URL abuse | Rate limit; CAPTCHA in v1.1 |
| RLS misconfiguration | Policy review + integration tests for each table |

---

## 15. Open questions

1. Sync vs async generation in v1 — block UI for 60s or always async?
2. Email + password vs magic link as default sign-in?
3. File upload field in v1 or deferred (needs storage policy work)?
4. Monorepo (`apps/web`, `apps/api`) or two repos?
5. Show "Powered by" footer on public forms?

---

*End of document*
