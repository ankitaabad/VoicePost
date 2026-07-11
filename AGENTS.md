# VoiceAds

A TypeScript monorepo: Hono API + React/Mantine frontend + shared validators, with Kokoro TTS + Ollama for AI-powered voice ad generation.

## Project Structure

```
├── backend/             Hono API server (Kysely + Postgres, PASETO auth)
│   ├── src/routes/      API routes (publicAuthRouter, protectedAuthRouter, profileRouter, ttsRouter)
│   ├── src/services/    TTS (kokoro), audio processing (ffmpeg), video processing (ffmpeg + captions)
│   ├── src/db/          Kysely client + schema.generated.ts + schema.override.ts
│   ├── migrations/      node-pg-migrate .ts files
│   └── storage/         Runtime: audio/, video/, thumbnails/, bgm/ (gitignored except bgm)
├── frontend/            Vite + React 19 + Mantine 9
│   ├── src/pages/       LoginPage, RegisterPage, ScriptStudio, etc.
│   ├── src/queries/     Axios instance + React Query hooks (auth.ts, tts.ts)
│   └── src/components/  AuthGuard, CustomLoader, ErrorBoundary, etc.
├── shared/              @app/shared — ArkType validators + shared types/enums
├── kokoro-service/      Python FastAPI TTS service (Kokoro KPipeline)
├── docker-compose.yaml  PostgreSQL 17, Ollama, Kokoro
├── run.sh               Starts Kokoro + Ollama + backend together
├── biome.json           Linter/formatter (2-space indent, noUnusedImports)
└── opencode.json        MCP config (docs-search)
```

## Key Commands

| Command | Location | Purpose |
|---|---|---|
| `docker compose up -d` | root | Start Postgres, Ollama, Kokoro |
| `./run.sh` | root | Start Kokoro + Ollama + backend (dev mode) |
| `pnpm dev` | root | Start backend + frontend concurrently |
| `pnpm dev` | backend | Hono dev server on :8080 (via dotenv + tsx watch) |
| `pnpm dev` | frontend | Vite dev server (proxies /api → :8080) |
| `pnpm test` | backend | Vitest run (requires Postgres for auth tests) |
| `pnpm test:changed` | backend | Vitest run for changed files only (fast) |
| `pnpm typecheck` | backend/frontend | `tsc --noEmit` |
| `pnpm format` | root | `biome check --write --unsafe` |
| `pnpm migrate:up` | backend | Apply pending migrations |
| `pnpm migrate:create <name>` | backend | Create new migration |
| `pnpm gen` | backend | Regenerate Kysely types from DB |
| `pnpm seed` | backend | Clean DB tables |
| `pnpm pasetoKeys` | backend | Generate PASETO Ed25519 keys |

## Architecture

- **API**: Hono, routes in `backend/src/routes/`, mounted on `app.route("/api/v1", ...)`
- **Auth routes**: `publicAuthRouter` (register, login, logout, refresh, forgot/reset password, verify email) — **no auth required**
- **TTS routes**: `ttsRouter` — **public** (voices, bgm, generate, rewrite-script, generate-video, audio/video serving)
- **Protected routes**: `protectedAuthRouter` (GET /me), `profileRouter` (PUT /profile) — require access token + CSRF
- **DB**: Kysely with Postgres. Schema = `schema.generated.ts` (auto) + `schema.override.ts` (shared enums)
- **Validation**: ArkType schemas in `shared/src/validators/`, one file per domain
- **Shared types**: API response types in `shared/src/types.ts`. Never define inline — import from `@app/shared`
- **Error handling**: Throw `HttpError` subclasses, caught by global `app.onError`
- **Responses**: `okResponse(c, data, message?)` for 200, `createResponse(c, data, message?)` for 201

### External Services

- **Kokoro TTS** (`:8888`): Python FastAPI, POST `/tts` with `{ text, voice_id, speed }`
- **Ollama** (`:11434`): Local LLM (qwen3:1.7b) for script rewriting
- **PostgreSQL** (`:5432`): postgres/postgres/postgres

### Video/Audio Pipeline

- Audio processing: `backend/src/services/audio/processor.ts` (BGM mixing, normalization via ffmpeg)
- Video generation: `backend/src/services/video/processor.ts` (thumbnail + waveform + captions)
- Caption algorithm: `backend/src/services/video/captions.ts` — word-level timing using per-voice pause calibration
- Voice profiles: `backend/src/services/video/voiceProfiles.ts` — calibrated timing for af_heart, af_sarah, am_adam, am_liam

## Source Files by Concern

| Concern | File(s) |
|---|---|
| DB schema | `backend/src/db/schema.generated.ts` + `schema.override.ts` |
| Shared validators | `shared/src/validators/*.ts` (auth.ts, profile.ts, tts.ts) |
| Shared types | `shared/src/types.ts` |
| API routes | `backend/src/routes/*.ts`, mounted in `backend/src/app.ts` |
| Shared enums | `shared/src/enum.ts` |
| Auth token config | `backend/src/lib/core/constants.ts` |
| Cookie config | `backend/src/lib/auth/cookie.ts` |
| Error classes | `backend/src/lib/http/errorHandler.ts` |
| Response helpers | `backend/src/lib/http/response.ts` |
| Frontend routes | `frontend/src/App.tsx` |
| React Query hooks | `frontend/src/queries/auth.ts`, `frontend/src/queries/tts.ts` |
| Axios instance | `frontend/src/queries/axios.ts` |
| TTS service | `backend/src/services/tts/kokoro.ts` |
| Video processor | `backend/src/services/video/processor.ts` |
| Caption timing | `backend/src/services/video/captions.ts` |
| Voice profiles | `backend/src/services/video/voiceProfiles.ts` |
| Audio processor | `backend/src/services/audio/processor.ts` |
| Test seed data | `backend/src/__tests__/globalSetup.ts` |
| Mantine theme | `frontend/src/theme.ts` |
| ArkType resolver | `frontend/src/lib/arkResolver.ts` |

## Frontend Architecture

- **Routing**: `App.tsx`. Public pages (Login, Register, ForgotPassword, ResetPassword, VerifyEmail) are top-level `<Route>`. Authenticated pages nest under `<AuthGuard>` + `<AppLayout>` (sidebar + header).
- **State**: React Query for server state (`queries/auth.ts`, `queries/tts.ts`), Zustand for UI (`store.ts`).
- **API layer**: `axiosInstance` in `queries/axios.ts` — `withCredentials: true`, auto-attaches CSRF token from cookie. 401 interceptor queues requests and refreshes token.
- **Forms**: Mantine `useForm` + `arkResolver()` bridges ArkType errors to `FormErrors`.
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
- **`queryClient.clear()`**: Never call when observers are mounted (triggers cascading 401s). Use `setQueryData(["session"], null)` instead.
- **Response.json is single-use**: `.clone()` if data needed in two places.
- **Pre-commit hook**: `lefthook` runs `biome check --write` on staged `.ts/.tsx/.json` files.
- **`.env` is committed**: Contains PASETO keys and DB URL.
- **Test seed data**: `globalSetup.ts` creates `seeded@test.com` / `SeedP@ss1`. Tests skip DB seeding if Postgres is unreachable.
- **Caption timing**: Voice profiles in `voiceProfiles.ts` are calibrated from real TTS silence detection. Don't adjust pause values without re-running the calibration analysis.
- **Path aliases**: `@src/*` → `src/*` in backend and frontend (not in shared — uses relative paths).

## Workflow Conventions

- **Post-change**: Run `pnpm format` and `pnpm test` in parallel — both must pass.
- **Iterative dev**: Use `pnpm test:changed` (much faster than `pnpm test`).
- **Multi-file changes**: Present full list of files + what changes in each, get confirmation before executing.
- **Before structural changes**: `grep` for ALL import references first. Build complete edit list in one pass.
- **Type narrowing**: Update all downstream types in one batch before editing — don't wait for typechecker.
- **Package management**: Prefer well-known npm packages. Ask before installing new ones.
- **Ask before deep-diving**: If intent is unclear, ask one clarifying question first.
- **Test data**: Use deterministic passwords (e.g. `TestPassword123!@#`). Avoid random generation.
- **API sync**: When modifying frontend API call parameters (in `queries/*.ts`), grep the corresponding backend routes (`backend/src/routes/`) for the same parameter to check if it's still expected. Frontend and backend evolve together — changing one side without checking the other risks silent runtime failures.

## Configuration Files

Never modify AGENTS.md, opencode.json, skill files, or other config files unless the user explicitly asks.
