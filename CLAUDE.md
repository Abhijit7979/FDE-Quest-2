# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

`PRD_claude.md` is the product spec. Read it before any non-trivial change — user stories (§3), routes (§9), data model (§5), API surface (§6), and the LangGraph pipeline (§7) are all defined there. Treat the PRD as authoritative when it disagrees with this file.

## Current state

Three sibling trees at the repo root — do not nest them or fold one into another:

- `supabase/` — migrations, RLS, the private `sketches` Storage bucket. Linked project `hlytpioigxvqxwmedqhn` (org `hyhuwiexdovwcauqyqfh`, name "sketch-to-form"); see `supabase/.temp/linked-project.json`.
- `frontend/` — Next.js 16 App Router app (not `apps/web/` as originally planned). Auth flow, sidebar shell, and home/forms placeholder pages are wired up against Supabase.
- `backend/` — FastAPI + LangGraph service (Python 3.12, `uv`-managed). The sketch-to-form pipeline, JWT verification, `/api/v1/*` routes, and the LangGraph graph all live here.

## Supabase workflow

Migrations are timestamped SQL files in `supabase/migrations/` and are intended to be applied with the Supabase CLI:

```bash
supabase migration new <name>        # scaffold a new timestamped migration
supabase db push                     # apply local migrations to the linked remote project
supabase db reset                    # rebuild local DB from migrations + seed
supabase start                       # bring up the local stack (Postgres :54322, API :54321, Studio :54323)
supabase gen types typescript --linked > frontend/src/types/supabase.ts   # regenerate DB types after schema changes
```

When adding tables or columns: write a new migration file — never edit a migration that has already been pushed to remote. After altering schema, regenerate TypeScript types.

## Database architecture

Four user tables plus one view: `profiles`, `forms`, `form_responses`, `generation_jobs`, and the `public_forms` view. Key invariants set up across the three migrations:

- **Profile auto-provisioning**: an `AFTER INSERT` trigger on `auth.users` (`handle_new_user`, `SECURITY DEFINER`) inserts the matching `profiles` row. Never insert into `profiles` from the client.
- **Public read isolation**: respondents never read `forms` directly. The `public_forms` view (security_invoker) projects only `id, public_slug, title, description, definition` for `status = 'published'`. `anon` has `SELECT` on the view; RLS on `forms` blocks anon entirely. If you add a column that respondents need, extend the view explicitly — do not loosen `forms` RLS.
- **Response submission**: `form_responses` accepts `INSERT` from `anon` only when the parent form's `status = 'published'` (subquery in the policy). SELECT/DELETE on responses is owner-only.
- **Forms invariant**: `forms_published_requires_slug` CHECK enforces `public_slug IS NOT NULL` whenever `status = 'published'`. Generate slugs with `nanoid(12)` at publish time (per PRD §10), not earlier.
- **updated_at**: maintained by the `forms_set_updated_at` BEFORE UPDATE trigger; do not set it from app code.

## Storage layout

Private bucket `sketches`, 10 MB cap, MIME-restricted to `image/jpeg|png|webp`. The RLS policies on `storage.objects` require the first path segment to equal `auth.uid()::text`:

```
sketches/{auth.uid()}/{form_id_or_filename}.{ext}
```

Browser uploads must follow that layout or RLS will reject. FastAPI reads sketches with the service role key, which bypasses RLS — no separate read policy exists for the backend.

A second private bucket `response-uploads` (10 MB, `image/jpeg|png|webp` + `application/pdf`) holds files submitted by **respondents** through `file_upload` fields:

```
response-uploads/{form_id}/{uuid}.{ext}
```

Its RLS differs from `sketches`: the INSERT policy is granted to `anon` (respondents are unauthenticated) and gates on the `public_forms` view, so uploads are allowed only into a *published* form's folder. SELECT/DELETE are owner-only (`forms.owner_id = auth.uid()`). The form owner views submitted files via short-lived signed URLs. Helpers live in `frontend/src/lib/storage/response-uploads.ts`; the answer stored in `form_responses.answers` for an upload field is `{ path, name, size, mime }`.

## Runtime topology (per PRD §4)

- **Next.js (App Router) + shadcn/ui** — in `frontend/`. Owns auth (via `@supabase/ssr` httpOnly cookies), the editor, and all direct Supabase reads/writes that RLS already covers.
- **FastAPI + LangGraph** — in `backend/`. Owns the sketch-to-form pipeline. Routes mounted under `/api/v1`: `GET /health`, `GET /me`, `POST /forms/generate`, `GET /forms/generate/{job_id}`, `POST /forms/validate`.
- **LangGraph nodes** (`backend/app/pipeline/nodes/`): `preprocess → vision_extract → structure → validate → (repair → vision_extract)? → persist`. `MAX_REPAIRS = 1` in `pipeline/graph.py`; the conditional edge after `validate` loops back through `vision_extract` once with the validator's error, then forces `persist` even if validation still fails (warnings carry the failure forward). `definition` JSON is the contract — see PRD §5.2 for the schema and the `needs_review` flag convention.

The web app calls `POST /forms/generate` with `Authorization: Bearer <jwt>` and a JSON body of `{ storage_path, form_id? }`. The API never receives image bytes directly — it pulls the sketch from Storage using the service role (the only thing that role is used for; see [Backend](#backend-backend)).

## Frontend (`frontend/`)

**Read `frontend/AGENTS.md` before writing Next.js code.** This is Next.js 16 — APIs, conventions, and file layout differ from older versions. Consult `frontend/node_modules/next/dist/docs/` for the canonical reference and respect deprecation notices.

Concrete gotchas already in the tree:

- **Middleware lives at `src/proxy.ts` and exports `proxy`** (not `middleware.ts` / `middleware`). It calls `updateSession` from `src/lib/supabase/proxy.ts`, which refreshes the Supabase session cookie and redirects unauthenticated users to `/login` (preserving the original path as `?redirect=`). Public paths: `/`, `/login`, `/signup`, `/forgot-password`, `/auth/callback`, `/f/*`, plus `_next/*`.
- **Route groups**: `src/app/(auth)/` for login/signup/forgot-password, `src/app/(app)/` for the authed shell (sidebar layout, home, forms). `src/app/auth/callback/route.ts` handles the Supabase code exchange.
- **Auth state mutations are Server Actions** in `src/app/(auth)/actions.ts` (`signIn`, `signUp`, `signOut`, `requestPasswordReset`). Do not duplicate this logic on the client.
- **Supabase client helpers**: `src/lib/supabase/{client,server,proxy}.ts`. Use `createSupabaseBrowserClient()` in Client Components, `createSupabaseServerClient()` (async — `await cookies()`) in Server Components, Route Handlers, and Server Actions.
- **UI**: shadcn configured with the `base-nova` style on top of `@base-ui/react` primitives (Tailwind v4, neutral base, lucide icons). Existing primitives in `src/components/ui/` (Button, Card, Sidebar, DropdownMenu, etc.) use the Base UI `render={...}` slot pattern — match it when adding components rather than reverting to children-as-element.

## Backend (`backend/`)

Python 3.12, dependencies in `pyproject.toml`, locked with `uv` (`uv.lock`). `backend/.env.example` is the source of truth for required vars.

```bash
cd backend
uv sync                                    # install/update deps from uv.lock
uv run uvicorn app.main:app --reload       # dev server on :8000
uv run python -c "from app.main import app" # smoke-import the FastAPI app
```

Module layout under `backend/app/`:

- `main.py` — `create_app()` wires CORS (origins from settings), mounts routers under `/api/v1`, sets logging on lifespan startup.
- `config.py` — `Settings` (pydantic-settings) reads `backend/.env`. `get_settings()` is `@lru_cache`d — never construct `Settings()` directly elsewhere; depend on it via `Depends(get_settings)` or call `get_settings()`.
- `security.py` — `get_current_user` verifies the bearer token. **Primary path is asymmetric (ES256/RS256) via the Supabase JWKS endpoint** (`/auth/v1/.well-known/jwks.json`, cached by `PyJWKClient`); HS256 with `SUPABASE_JWT_SECRET` is a legacy fallback only used if JWKS verification fails *and* the secret is set. Use the `CurrentUser` type alias on routes — do not reimplement.
- `supabase_client.py` — two factories, and the distinction matters:
  - `get_user_client(jwt)` — anon-key client with `postgrest.auth(jwt)` so PostgREST sees `auth.uid()` and RLS applies. **All `forms` / `generation_jobs` writes go through this.** Constructed per-request (not cached).
  - `get_service_client()` — service-role client, bypasses RLS. The *only* sanctioned use is reading the private `sketches` bucket (no read policy exists for the backend). Don't use it for table writes.
- `jobs.py` — `run_generation_job` is the job entrypoint. It updates `generation_jobs.status` through the `pending → processing → completed|failed` lifecycle, skips a job already `completed` (redelivery guard), and swallows exceptions into the `failed` state with `error = "{ExcType}: {msg}"[:1000]`. The job runs under the caller's JWT so RLS applies inside the graph. `routers/forms.py` dispatches it one of two ways per the `JOB_DISPATCH_MODE` setting: `background` (FastAPI BackgroundTasks — local dev) or `lambda` (`dispatch_to_lambda` async-invokes the worker Lambda — see `lambda_handlers.py`).
- `lambda_handlers.py` — AWS Lambda entrypoints (one zip artifact, two functions): `api_handler` wraps the FastAPI app via Mangum; `worker_handler` runs `run_generation_job`. Used only when deployed to Lambda — see `backend/DEPLOY_LAMBDA.md`. Local `uvicorn` runs ignore this module entirely.
- `pipeline/` — `state.py` defines the `PipelineState` TypedDict (inputs `job_id`, `form_id`, `owner_id`, `user_jwt`, `storage_path`; progressively populated keys for image bytes, raw extraction, definition, validation_error, warnings, repair_count). `graph.py` compiles the LangGraph (`@lru_cache`d). `prompts.py` holds `SYSTEM_PROMPT` and `REPAIR_INSTRUCTION`. Add a node by dropping it into `pipeline/nodes/` and wiring it in `build_graph()`.
- `schemas/` — `definition.py` is the canonical `Definition` Pydantic model (the contract written into `forms.definition`). `api.py` holds request/response shapes for the routers. The `/forms/validate` endpoint just runs `Definition.model_validate(payload.definition)` and reshapes Pydantic errors.
- `routers/forms.py` — note `_ensure_path_owned_by` defense-in-depth: storage RLS already requires the first path segment to be the caller's `auth.uid()`, but because the *download* uses the service role (which bypasses RLS), the router re-checks before queueing the job.

Backend conventions:

- New routes go in `backend/app/routers/<name>.py` with a module-level `router = APIRouter(...)`, then registered in `main.create_app()` with `prefix="/api/v1"`.
- Use the `CurrentUser` annotated dependency for authenticated routes; use `_require_jwt` (or an equivalent local helper) only when you also need the raw token string to forward to `get_user_client(jwt)`.
- Never insert into `profiles` from the backend either — the `auth.users` trigger handles it.
- LangGraph nodes return a (partial) `PipelineState`. Errors that should fail the job: raise. Errors that should soft-fail with a flagged definition: write to `state["warnings"]` and let the graph continue.

## Environment

- Root `.env` — Supabase URL + anon + service role keys. Shared during local dev.
- `frontend/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus server-side `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Next.js reads from here.
- `backend/.env` — see `backend/.env.example`. Always set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SKETCHES_BUCKET=sketches`, `LLM_PROVIDER` + provider creds (`OPENAI_API_KEY` and/or `GITHUB_TOKEN` + `GITHUB_MODELS_ENDPOINT` + `GITHUB_MODEL`), `CORS_ORIGINS` (JSON list, e.g. `["http://localhost:3000"]`), `LOG_LEVEL`. `SUPABASE_JWT_SECRET` is optional — only needed for legacy HS256 projects; modern Supabase projects verify via JWKS without it. `JOB_DISPATCH_MODE` defaults to `background` (in-process) and only needs `lambda` + `WORKER_FUNCTION_NAME` when deployed to Lambda.

Keep `NEXT_PUBLIC_`* confined to `frontend/`. The service role key must never reach the browser.

## Frontend dev commands

From `frontend/`:

```bash
npm run dev      # next dev (port 3000)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

No tests are wired up in `package.json` — don't invent a `test` script; ask the user before adding one.

## Conventions worth carrying forward

- Field IDs in `definition.fields[]` are stable string slugs (`f_1`, `f_2`, …). Response `answers` keys must match these IDs, not labels — labels can change without invalidating prior responses.
- AI-generated fields that are low-confidence get `needs_review: true`; the editor surfaces these to the user. Do not strip the flag on save.
- `public_slug` is unguessable (`nanoid(12)`). Never expose the internal `id` on the public form page.



