# VoicePost

A TypeScript monorepo: Hono API + React/Mantine frontend + shared validators, with Kokoro TTS + Ollama for AI-powered voice ad generation.

## Project Structure

```
├── backend/             Hono API server (Kysely + Postgres)
│   ├── src/routes/      API routes (ttsRouter)
│   ├── src/services/    TTS (kokoro), audio processing (ffmpeg), video processing (ffmpeg + captions)
│   ├── src/db/          Kysely client + schema.generated.ts + schema.override.ts
│   ├── migrations/      node-pg-migrate .ts files
│   └── storage/         Runtime: audio/, video/, thumbnails/, bgm/ (gitignored except bgm)
├── frontend/            Vite + React 19 + Mantine 9
│   ├── src/pages/       ScriptStudio
│   ├── src/queries/     Axios instance + React Query hooks (tts.ts)
│   └── src/components/  AppRedirect, ErrorBoundary, VideoPositionZone
├── shared/              @app/shared — ArkType validators + shared types
├── kokoro-service/      Python FastAPI TTS service (Kokoro KPipeline)
├── docs/                Project memory and documentation
├── run.sh               Starts Kokoro + Ollama + backend together
├── biome.json           Linter/formatter (2-space indent, noUnusedImports)
└── opencode.json        MCP config (docs-search)
```

## Key Commands

| Command | Location | Purpose |
|---|---|---|
| `./run.sh` | root | Start Kokoro + Ollama + backend (dev mode) |
| `pnpm dev` | root | Start backend + frontend concurrently |
| `pnpm dev` | backend | Hono dev server on :8080 (via dotenv + tsx watch) |
| `pnpm dev` | frontend | Vite dev server (proxies /api → :8080) |
| `pnpm test` | backend | Vitest run |
| `pnpm test:changed` | backend | Vitest run for changed files only (fast) |
| `pnpm typecheck` | backend/frontend | `tsc --noEmit` |
| `pnpm format` | root | `biome check --write --unsafe` |
| `pnpm migrate:up` | backend | Apply pending migrations |
| `pnpm migrate:create <name>` | backend | Create new migration |
| `pnpm gen` | backend | Regenerate Kysely types from DB |

## Architecture

- **API**: Hono, routes in `backend/src/routes/`, mounted in `backend/src/app.ts`
- **TTS routes**: `ttsRouter` — public (voices, bgm, generate, rewrite-script, projects CRUD, generate-video, audio/video/srt serving)
- **DB**: Kysely with Postgres. Schema = `schema.generated.ts` (auto) + `schema.override.ts`
- **Validation**: ArkType schemas in `shared/src/validators/tts.ts`
- **Shared types**: API response types in `shared/src/types.ts`. Never define inline — import from `@app/shared`
- **Error handling**: Throw `HttpError` subclasses, caught by global `app.onError`
- **Responses**: `okResponse(c, data, message?)` for 200, `createResponse(c, data, message?)` for 201

### External Services

- **Kokoro TTS** (`:8888`): Python FastAPI, POST `/tts` with `{ text, voice_id, speed }`
- **Ollama** (`:11434`): Local LLM (qwen3:1.7b) for script rewriting
- **PostgreSQL** (`:5432`): Configured via `DATABASE_URL` env var

### Video/Audio Pipeline

- Audio processing: `backend/src/services/audio/processor.ts` (BGM mixing, normalization via ffmpeg)
- Audio mastering: `backend/src/services/audio/mastering.ts` (high-pass, EQ, loudness normalization, limiter)
- Video generation: `backend/src/services/video/processor.ts` (thumbnail + waveform + captions)
- Caption algorithm: `backend/src/services/video/captions.ts` — word-level timing using direct Kokoro token timestamps
- Thumbnail analysis: `backend/src/services/video/thumbnailAnalysis.ts` — brightness detection for caption border styling

## Source Files by Concern

| Concern | File(s) |
|---|---|
| DB schema | `backend/src/db/schema.generated.ts` + `schema.override.ts` |
| Shared validators | `shared/src/validators/tts.ts` |
| Shared types | `shared/src/types.ts` |
| Shared layout | `shared/src/videoLayout.ts` |
| API routes | `backend/src/routes/ttsRouter.ts`, mounted in `backend/src/app.ts` |
| Error classes | `backend/src/lib/http/errorHandler.ts` |
| Response helpers | `backend/src/lib/http/response.ts` |
| Frontend routes | `frontend/src/App.tsx` |
| React Query hooks | `frontend/src/queries/tts.ts` |
| Axios instance | `frontend/src/queries/axios.ts` |
| TTS service | `backend/src/services/tts/kokoro.ts` |
| TTS metadata | `backend/src/services/tts/metadata.ts` |
| SRT generation | `backend/src/services/tts/srt.ts` |
| Video processor | `backend/src/services/video/processor.ts` |
| Caption timing | `backend/src/services/video/captions.ts` |
| Thumbnail analysis | `backend/src/services/video/thumbnailAnalysis.ts` |
| Audio processor | `backend/src/services/audio/processor.ts` |
| Audio mastering | `backend/src/services/audio/mastering.ts` |
| Script rewriter | `backend/src/services/script/rewriter.ts` |
| Mantine theme | `frontend/src/theme.ts` |
| Frontend Zustand store | `frontend/src/store.ts` (generic global); feature stores in `frontend/src/stores/<feature>Store.ts` |

## Frontend Architecture

- **Routing**: `App.tsx`. Three routes: `/` redirects to `/app`, `/app` renders `AppRedirect` (project list/creation), `/app/:id` renders `ScriptStudio`.
- **State**: React Query for server state (`queries/tts.ts`), Zustand for UI (`frontend/src/stores/<feature>Store.ts`).
- **API layer**: `axiosInstance` in `queries/axios.ts` — `withCredentials: true`.
- **Forms**: Mantine `useForm` for form state.
- **CSS**: CSS Modules for components, global CSS for third-party overrides.
- **Theming**: `theme.ts` — indigo brand, Inter font, per-component overrides.

## Creating Enums

Don't use `enum` — use constant objects. PascalCase name, SCREAMING_SNAKE_CASE key+value. Export both.

```typescript
export const Status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const
export type Status = (typeof Status)[keyof typeof Status]
```

Shared enums go in `shared/src/enum.ts`.

## Migrations

Files in `backend/migrations/`, TypeScript (`-j ts`). To pass flags like `--all`:

```bash
pnpm exec dotenv -e .env -- node-pg-migrate down --all -j ts
```

`pnpm migrate:down -- --all` does **not** work (script already contains `--` from dotenv).

## Reusable Validators

One file per resource in `shared/src/validators/`. Error messages must be human-consumable (used in frontend forms):

```typescript
export const Password = type.string.narrow((s, ctx) => {
  if (s.length < 8) return ctx.reject("Must be at least 8 characters")
  return true
})
```

## Gotchas

- **Sub-router root route**: Use `""` not `"/"`. `"/"` creates trailing-slash mismatch.
- **Kysely updates**: Always set `updated_at: new Date()` manually — no DB triggers.
- **Kysely inserts**: Use `.returningAll()` — don't do a separate SELECT after insert.
- **ArkType validation**: Use `.assert()` — throws on invalid input, caught by `app.onError`. Call result `input`.
- **Response.json is single-use**: `.clone()` if data needed in two places.
- **Pre-commit hook**: `lefthook` runs `biome check --write --no-errors-on-unmatched` on staged `.ts/.tsx/.json/.js/.jsx/.jsonc` files.
- **Caption timing**: Uses direct Kokoro token timestamps — no voice profile calibration needed.
- **Path aliases**: `@src/*` → `src/*` in backend and frontend (not in shared — uses relative paths).

## Workflow Conventions

- **Post-change**: Run `pnpm format` and `pnpm test` in parallel — both must pass.
- **Iterative dev**: Use `pnpm test:changed` (much faster than `pnpm test`).
- **Multi-file changes**: Present full list of files + what changes in each, get confirmation before executing.
- **Before structural changes**: `grep` for ALL import references first. Build complete edit list in one pass.
- **Type narrowing**: Update all downstream types in one batch before editing — don't wait for typechecker.
- **Package management**: Prefer well-known npm packages. Ask before installing new ones.
- **Ask before deep-diving**: If intent is unclear, ask one clarifying question first.
- **API sync**: When modifying frontend API call parameters (in `queries/*.ts`), grep the corresponding backend routes (`backend/src/routes/`) for the same parameter to check if it's still expected. Frontend and backend evolve together — changing one side without checking the other risks silent runtime failures.

## Configuration Files

Never modify AGENTS.md, opencode.json, skill files, or other config files unless the user explicitly asks.

## Behavioral Unit Identification and Testing

- Continuously look for opportunities to extract stable, long-lived business logic into well-defined functions. Prioritize logic that provides high regression value, is deterministic, can be executed quickly without external dependencies, and is likely to remain stable as the project evolves. Avoid extracting code solely for the sake of smaller functions; only extract logic that represents a meaningful, reusable operation with a clear responsibility.

- Pay particular attention to logic that is expected to undergo experimentation or iterative tuning. When an algorithm, heuristic, configuration, or transformation is likely to be adjusted repeatedly, structure it as a well-defined, isolated unit with clear inputs and outputs. This enables rapid iteration, makes behavioral changes easier to evaluate, and provides a stable point for regression testing as the implementation evolves.

- Once a behaviorally significant unit has been identified and isolated, evaluate whether it warrants unit tests. Prioritize tests for logic that has a high risk of regression, encapsulates important business rules or algorithms, or is expected to evolve through experimentation. Unit tests should execute quickly, be deterministic, and validate externally observable behavior rather than implementation details. Avoid writing tests for trivial logic, simple orchestration, thin wrappers around external libraries, or code whose behavior is better validated through integration or end-to-end tests.
  
## Project Memory

Treat docs/project-memory.md as the project's long-term engineering memory. Review it before making significant architectural or behavioral changes, and update it whenever your work introduces or changes important project context, constraints, assumptions, design rationale, or trade-offs that are not obvious from the code. Also preserve significant engineering decisions and experiments—including approaches that were evaluated, rejected, or later reversed—along with the reasoning and lessons learned, so future contributors and agent sessions can understand past decisions and avoid repeating unsuccessful approaches. Do not duplicate implementation details that are already evident from the codebase; document the why, not the how.


## State Ownership & Lifecycle

Always think in terms of state ownership and lifecycle, not individual variables. Whenever introducing or modifying state, caches, refs, shared data, or asynchronous operations, audit their complete lifecycle: initialization, updates, invalidation, cleanup, and persistence. When the owning context (request, project, route, user, document, job, etc.) changes, ensure all related state transitions together and no stale data or async result can leak across contexts. Review reset paths, dependency chains, and concurrent execution to prevent race conditions and inconsistent state. Before considering the task complete, ask: "Can any state or side effect outlive its intended owner?" If yes or uncertain, fix it first.

## Cheap Consistency Checks

Perform inexpensive sanity checks after every non-trivial change. Examples include:

Search for references to any renamed or modified symbol.
Verify frontend and backend contracts remain synchronized.
Check that related types, schemas, and generated artifacts are consistent.
Review nearby code for similar logic that may require the same change.
Ask: "What else depends on what I just changed?" Update those locations if necessary.


## Component Size

React components should generally be between 100–300 lines.

When a component exceeds 300 lines, treat it as a signal to refactor.

Prefer extracting:
- Complete UI sections (VoiceSelector, ProjectDrawer, ThumbnailEditor)
- Independent workflows (useAudioPlayback, useThumbnailUpload)
- Business logic into services

Avoid extracting:
- Tiny JSX fragments
- Stateless wrappers
- Hooks that only move useState/useEffect without encapsulating behavior

Do not create components with fewer than ~30 lines unless they are reused, exported as part of the public UI library, or encapsulate meaningful behavior.

## State Management

**Default rule: avoid props for sharing state. Use a store or query instead.**

- **If two or more components need the same state, it MUST live in a store (Zustand) or a query (TanStack Query) — not be passed via props.** Prop drilling is discouraged. The only acceptable uses of props for state are controlled components (inputs, comboboxes, etc.) and reusable UI primitives that explicitly expose a controlled API by design.

- **Server state (data fetched from the API, cached responses, mutations)** → TanStack Query only. Never mirror it into Zustand or `useState`.

- **Application state (UI state shared across components, feature-level flags, cross-route selections, workflow state)** → Zustand store, one per feature.

- **Transient UI state (input values, modal/popover visibility, hover/focus, drag state, accordion open/closed)** → `useState` is fine **if it is local to a single component**. The moment a second component needs it, lift it to a Zustand store.

- Before adding a new `useState`, determine if the value can be derived from existing state, store, query data, route params, or other computed values. If so, do not store it.

- Never duplicate the same state in multiple places. Maintain a single source of truth and derive everything else.

- Do not copy server data into Zustand or local state. TanStack Query owns server state. Zustand owns application state.

- If a component grows beyond **10 `useState` hooks** or **5 `useEffect` hooks**, stop and evaluate whether the state belongs in a feature-specific Zustand store or whether some state can be derived instead.

- Do not introduce `useEffect` solely to synchronize one piece of state with another. Prefer derived state or perform updates directly inside the event handler.

- For zustand: **one feature = one store**. Co-locate the store with the feature it serves (e.g. `frontend/src/stores/projectStore.ts`).

### Decision flowchart

1. Is it data from the server? → **TanStack Query**
2. Is it used by two or more components? → **Zustand store**
3. Is it transient and local to one component? → **`useState`**
4. Is it a controlled input or UI primitive with an explicit controlled API? → **props are acceptable**

## useEffect

- Treat `useEffect` as a last resort.
- Use it only to synchronize with external systems (API, DOM, timers, subscriptions, browser APIs).
- Never use `useEffect` to derive state.
- Before adding a `useEffect`, verify the logic cannot be implemented using:
  - derived values,
  - event handlers,
  - `useMemo`,
  - or store actions.

### Dependency arrays are mandatory

- **`useEffect(fn)` with no dependency array runs after every render** and is almost always a bug. If you think you need to read from a ref on every render, you want `useLayoutEffect` with explicit deps — not `useEffect` without them.
- **State setters with new object/array references always trigger a re-render**, even when the values are identical (React's `Object.is` bail-out only works on identical references). If an effect or handler may set the same value more than once, use a functional updater with a shallow equality check:
  ```tsx
  setImageDims((prev) =>
    prev && prev.width === next.width && prev.height === next.height
      ? prev
      : next
  );
  ```
- **For DOM measurement, prefer `useLayoutEffect`** over `useEffect` — it runs synchronously after the commit but before paint, avoiding a visible flash of an unmeasured state.
- A missing or empty dep array is a red flag in code review. Catch it before merge.

## State Ownership

Every piece of state should have exactly one owner.

Server data → TanStack Query

Application state → Zustand

Form state → Mantine Form

Transient UI → useState

Shared between 2+ components → store or query, **never props**

## Component Extraction

When extracting a component, extract ownership—not just JSX.

handlers, and rendering. If the parent still owns most of the state and passes it through as props, lift that state into a Zustand store (or read it from a query) instead, then reconsider the extraction boundary.

If multiple components share the same outer structure and lifecycle but differ only in content, extract the shared structure into a reusable UI primitive and provide the varying content through props or children.

Exception: Controlled components and reusable UI primitives may intentionally receive their state and behavior via props. This is the only sanctioned use of props for state — see the [decision flowchart](#decision-flowchart).

## Verify Against Authoritative Sources

When implementation attempts fail or behavior differs from your expectations, assume your knowledge may be incomplete, outdated, or version-specific. After two unsuccessful attempts, stop guessing and verify the current API or behavior using authoritative sources such as the project's existing code, installed type definitions (`.d.ts`), package source, generated schemas, or official documentation before continuing. Prefer evidence from the current project over memory.

## Chrome DevTools MCP for Debugging

When a bug cannot be understood confidently by reading the code, use the Chrome DevTools MCP instead of repeatedly inspecting files or searching the codebase.

Do not spend excessive time grepping or tracing code when the issue can be observed directly in a running application.

There is a dedicated debugging skill for this workflow. Always load and follow that skill before starting browser-based debugging.

## Frontend Observability

Write frontend code with sufficient logging and observability from the start. Add meaningful logs around key state changes, user actions, and API interactions so issues can be diagnosed without modifying the code later. Avoid noisy logs, but don't wait until a bug is reported to add them.