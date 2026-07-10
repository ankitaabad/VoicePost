# fs-template

A TypeScript monorepo with pnpm workspaces (backend + frontend + shared).

## Project Structure

```
├── backend/        Hono API server (PostgreSQL via Kysely, PASETO auth)
├── frontend/       Vite + React + Mantine UI
│   ├── components/ Reusable UI (AuthGuard, CenterCard, CustomLoader, CustomModal, ErrorBoundary)
│   ├── pages/      Route pages (Login, Register, Home, ForgotPassword, ResetPassword, VerifyEmail, Profile)
│   ├── lib/        ArkType form resolver
│   ├── queries/    Axios instance + React Query hooks
│   ├── layouts/    AppLayout (sidebar + header + Outlet)
│   ├── css/        CSS Modules & global styles
│   └── theme.ts    Mantine theme configuration
├── shared/         @app/shared — enums, arktype validators
├── docker-compose.yaml    PostgreSQL 17
├── biome.json             Linting & formatting
└── opencode.json          MCP config
```

## Key Commands

| Command | Location | Purpose |
|---|---|---|
| `docker compose up -d` | root | Start PostgreSQL |
| `pnpm dev` | backend | Start Hono dev server (port 8080) |
| `pnpm dev` | frontend | Start Vite dev server |
| `pnpm migrate:up` | backend | Apply pending migrations |
| `pnpm migrate:down` | backend | Rollback last migration |
| `pnpm migrate:create <name>` | backend | Create a new migration |
| `pnpm gen` | backend | Regenerate kysely types from DB |
| `pnpm typecheck` | backend | TypeScript check (--noEmit, incremental) |
| `pnpm test` | backend | Run all vitest tests |
| `pnpm test:changed` | backend | Run vitest tests for changed files only |
| `pnpm format` | root | Biome check --write --unsafe (2-space indentation) |

## Architecture

- **API**: Hono, routes in `backend/src/routes/`, mounted on `app.route("/api/v1", ...)`
- **DB**: Kysely with Postgres, schema split into `schema.generated.ts` (auto) + `schema.override.ts` (typed overrides with shared enums)
- **Auth**: PASETO v4 tokens (access/refresh/CSRF), Argon2 password hashing
- **Validation**: ArkType schemas in `shared/src/validators/`, one validator file per resource (e.g. `auth.ts` for auth routes)
- **Shared types**: API response types used by both frontend and backend live in `shared/src/types.ts` (e.g. `UserResponse`). Never define an API response type inline in frontend queries or backend routes — import from `@app/shared` instead.
- **Error handling**: Throw `HttpError` subclasses (BadRequest, Conflict, etc.), caught by global `app.onError` handler
- **Responses**: `okResponse()` (200) / `createResponse()` (201) from `lib/http/response.ts`

## Check authoritative files before agents

When any question can be answered by reading files in the "Source files by concern" table, read those files directly with parallel `Read` calls — do not launch a task/explore agent.

Only use task agents when the answer's location is genuinely uncertain or requires broad exploration across unknown files.

## Task agent discipline

Before launching a task/explore agent, ask: "Can I answer this by reading ≤3 files directly?"

If yes: read them directly (parallel if possible).
If no: launch the agent with a precise prompt that specifies exactly where to search (paths, patterns, and what to return).

Cues that signal a task agent likely isn't needed:
- The answer lives in a single package (`shared/`, `backend/`, `frontend/`)
- AGENTS.md has a "Source files by concern" table entry for the question
- The question is about a single file's contents
- The answer requires reading types/exports from one package's entry point

## Source files by concern

| Concern | Authoritative file(s) |
|---|---|
| DB schema | `backend/src/db/schema.generated.ts` + `schema.override.ts` |
| Shared validators | `shared/src/validators/*.ts` |
| Shared types | `shared/src/types.ts` |
| API endpoints | `backend/src/routes/*.ts` and `backend/src/app.ts` |
| Shared enums | `shared/src/enum.ts` |
| Auth token config | `backend/src/lib/core/constants.ts` |
| Cookie config | `backend/src/lib/auth/cookie.ts` |
| Error classes | `backend/src/lib/http/errorHandler.ts` |
| Response helpers | `backend/src/lib/http/response.ts` |
| Frontend routes | `frontend/src/App.tsx` |
| React Query hooks | `frontend/src/queries/auth.ts` |
| Axios instance | `frontend/src/queries/axios.ts` |
| Test seed data | `backend/src/__tests__/globalSetup.ts` |
| Mantine theme | `frontend/src/theme.ts` |
| ArkType resolver | `frontend/src/lib/arkResolver.ts` |

## Frontend Architecture

### Dependencies

| Category | Packages |
|---|---|
| UI | `@mantine/core`, `@mantine/form`, `@mantine/hooks`, `@mantine/notifications`, `@mantine/charts`, `@mantine/dates`, `@mantine/dropzone`, `mantine-datatable`, `@tabler/icons-react`, `recharts`, `react-pro-sidebar` |
| State | `@tanstack/react-query`, `zustand` |
| Routing | `react-router-dom` |
| HTTP | `axios` |
| Utils | `date-fns`, `clsx`, `uuid` |

### Routing

Routes are defined in `App.tsx`. Unauthenticated pages (Login, Register, ForgotPassword, ResetPassword, VerifyEmail) are top-level `<Route>` elements. Authenticated pages are nested under a parent route wrapped in `<AuthGuard>` + `<AppLayout>`, which provides a sidebar and header via `react-pro-sidebar`.

### State management

- **Server state** — React Query in `queries/auth.ts` for session fetching and auth mutations (login, logout, register).
- **Client state** — Zustand store in `store.ts` for UI state.

### API layer

The session user is accessed via `useSession()` (React Query), which is called in `AuthGuard` and any page component that needs the current user. Mutations (`useLogin`, `useLogout`, `useUpdateProfile`) write to the React Query cache directly via `queryClient.setQueryData`.

The `axiosInstance` (`queries/axios.ts`) is a pre-configured Axios client with `withCredentials: true` and a request interceptor that attaches the `X-CSRF-Token` header from the `CSRF_TOKEN` cookie. It is consumed by hooks in `queries/`.

### Form validation

Mantine `useForm` uses `arkResolver()` from `lib/resolvers.ts` to bridge ArkType validator errors into Mantine's `FormErrors` format. Error messages come directly from the shared ArkType validators in `@app/shared`.

### Theming

`theme.ts` defines a custom Mantine theme with a brand color palette (indigo), custom font family (Inter), heading sizes, shadow scale, and per-component overrides for Button, TextInput, PasswordInput, Text, Anchor, and Paper.

### CSS strategy

- **CSS Modules** — component-specific styles (e.g., `loader.module.css`).
- **Global CSS** — third-party overrides and layout resets (e.g., `datatableLayout.css`).

## Context Harness MCP (docs-search)

An MCP server `docs-search` is configured at `opencode.json`. It indexes docs repos
for major npm packages used in this project. Use `sources()` to see what's available.

### Tools

- `search(query, limit, mode, filters)` — full-text search across indexed docs
- `get(id)` — retrieve full document by UUID
- `sources()` — list indexed sources and their health

### Search parameters

```
search({
  query: "<descriptive keywords>",
  mode: "hybrid",
  limit: 8,
  filters: { source: "git:<lib>" }
})
```

- **Mode**: Always use `hybrid` (keyword + semantic combined). `keyword` is too
  literal, `semantic` produces noisy rankings.
- **Source filter**: Always restrict with `filters: { source: "git:<lib>" }` when
  querying a specific library. Without it, results mix across all indexed repos.
- **Query style**: Use descriptive keywords/terms (e.g. `"Button loading loaderProps"`),
  not full natural language questions. Search by component name (e.g. `"Button"`)
  to find component API pages (named like `core/button.mdx`).
- **FTS5 quirks**: Avoid hyphens and dots in queries — they can trigger
  `"no such column"` or `"fts5: syntax error"` errors. Use spaces instead
  (e.g. `"type safe"` not `"type-safe"`, `"app route"` not `"app.route"`).
- **One-shot pattern**: `search()` finds the right page, then `get()` retrieves
  the full doc with code examples, option tables, and edge cases. Don't stop at
  snippets — the complete content is what makes this MCP valuable.
- **Explore mode**: When unfamiliar with a library, search a bare component/hook
  name (e.g. `"useLoaderData"`, `"createTable"`, `"persist"`) to discover what
  pages exist before narrowing down.
- **Limit**: 8 is sufficient; higher limits increase noise.



### When to use MCP vs node_modules types

| Need | Tool |
|---|---|
| Conceptual docs, usage guides, best practices | `docs-search` MCP |
| Exact prop types, interfaces, import paths | `node_modules` `.d.ts` files |

### Efficiency rules

1. **One precise search + optionally one get** — Avoid exploratory chains.
2. **Batch related queries** — Combine multiple questions about the same library
   into a single search call.
3. **Consult MCP first** for any code example, query, or schema involving an
   indexed library. Training knowledge is secondary.
4. **If docs contradict training, trust the docs** — Update your answer accordingly.

## Creating Enums

Don't use `enum` to create enums, instead use a constant object.
Use PascalCase for the enum name.
Both the key and value should be in SCREAMING_SNAKE_CASE.
Export both the enum and the type.

```typescript
export const Status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const

export type Status = (typeof Status)[keyof typeof Status]
```

In monorepos setup with pnpm, these enums if used both in frontend and backend should be created in common package.

## Running node-pg-migrate

Migration files are in `.ts` format. All migrate scripts include `-j ts` to match.

To pass flags like `--all` to node-pg-migrate, use `pnpm exec` directly:
```bash
pnpm exec dotenv -e .env -- node-pg-migrate down --all -j ts
```
The `pnpm migrate:down -- --all` pattern does not work because the script already contains `--` from `dotenv`.

## Reusable validators

File structure: one validator file per resource (e.g. `auth.ts` for auth routes, matching the backend route file name).

Validator should be reusable in frontend so that error messages are human consumable in forms. 
Example:

```typescript
export const Password = type.string.narrow((s, ctx) => {
  if (s.length < 8) return ctx.reject("Must be at least 8 characters")
  if (!/[A-Z]/.test(s)) return ctx.reject("Must contain an uppercase letter")
  if (!/[a-z]/.test(s)) return ctx.reject("Must contain a lowercase letter")
  if (!/[0-9]/.test(s)) return ctx.reject("Must contain a number")
  if (!/[^A-Za-z0-9]/.test(s)) return ctx.reject("Must contain a special character")
  return true
})
```

Error messages are field-level and frontend-consumable. Iterate the `ArkErrors` to map `err.path` → `err.message` for form validation.

## Package management

Prefer using well-known npm packages (like `dotenv`, `radash`, or anything else that you think is useful etc.) rather than writing custom code for common tasks. If a package is not already in the project's dependencies, ask the user before installing it.

## Multi-file changes

Before making changes that touch 3+ files (renames, refactors, etc.), present the full list of changes and get explicit confirmation before executing. Example: "I'll rename X → Y in file1.ts, file2.ts, file3.ts — confirm?"

## Find all references before structural changes

Before deleting, renaming, or moving a file, grep for ALL import references to it first. Do not rely on files you've happened to read or already know about. Build the complete list of files to update in one pass before making any edits.

```bash
# do this FIRST:
grep -r "from.*lib/auth" frontend/src
# THEN plan all edits
```

## Type narrowing — one-pass dependency audit

When narrowing a type (e.g. changing `status: string` to `status: SomeEnum`), identify ALL dependent types downstream in the same batch BEFORE editing:

1. Find all places that construct or assign to the changed field
2. Find all places that consume the changed type
3. Update every type that propagates the field in one pass

Example: if you change a field in a shared API response type, update its consumers (route response objects, middleware user types, token payload types, frontend query types) all in the same batch. Don't wait for the typechecker to catch stragglers — predict the full propagation chain upfront.

## Edit precision — oldString discipline

When constructing `oldString` for the edit tool:

1. Copy the exact text from the Read output (after the `N: ` prefix), not from memory
2. If batch-editing the same file multiple times, read the file's current state between batches — earlier edits shift line content
3. Use `replaceAll` when renaming an identifier that appears in multiple places within the same file

## Post-change lint & test in parallel

Run `pnpm format` and backend tests in parallel — they're independent and both must pass.

During iterative development, use `pnpm test:changed` instead of `pnpm test` — it only runs tests related to files changed since the last commit, which is much faster. 

## Ask clarifying questions before researching

If you're unsure what the user wants, ask a clarifying question. Don't deep-dive into files you may not need. A single question can save 5–10 reads down the wrong path.

## Batch exploration

When starting a cross-cutting feature (e.g. frontend auth with a backend), explore ALL relevant areas — frontend, backend, shared, config — in a single parallel agent batch before writing any code.

## Feature wiring workflow

When adding a new feature that touches the full stack:

1. **Validator** — create/edit `shared/src/validators/<domain>.ts`
2. **Migration** — `pnpm migrate:create <name>` in backend, then `pnpm migrate:up`
3. **Route** — create/edit `backend/src/routes/<domain>Router.ts`, mount in `app.ts`
4. **DB gen** — `pnpm gen` to update `schema.generated.ts`
5. **React Query hook** — add to `frontend/src/queries/auth.ts` (or new file in `queries/`)
6. **Page** — create in `frontend/src/pages/`, add route in `App.tsx`
7. **Auth guard** — wrap in `<AuthGuard><AppLayout>` if authenticated, top-level `<Route>` if public
8. **Tests** — add to `backend/src/__tests__/`, test the endpoint you modify

## Env validation

Environment variables are validated at startup using an ArkType schema in `backend/src/env.ts`. When adding a new environment variable, add it to the `EnvSchema` object there:

```typescript
const EnvSchema = type({
  DATABASE_URL: "string",
  PASETO_PRIVATE_KEY: "string",
  PASETO_PUBLIC_KEY: "string",
  MY_NEW_VAR: "string",  // add here
});
```

`validateEnv()` is called before the server starts and exits with code 1 if any vars are missing. This prevents runtime surprises from missing configuration.

## Gotchas

- **Sub-router root route**: Use `""` not `"/"` (e.g. `router.put("", handler)`). Routes with explicit path segments (`/register`, `/login`) should still use `"/"` as normal.
  - ✅ `router.put("", handler)` — matches `PUT /api/profile`
  - ❌ `router.put("/", handler)` — matches `PUT /api/profile/` (trailing slash)

- **Kysely updates**: Always set `updated_at: new Date()` manually. There is no DB trigger — the application layer is responsible.
  ```ts
  await db.updateTable("users").set({ email, updated_at: new Date() }).where("id", "=", id).execute()
  ```

- **Kysely inserts**: Use `.returningAll()` or `.returning(...)` — don't write a separate SELECT after an insert.
  ```ts
  const user = await db.insertInto("users").values({ email }).returningAll().executeTakeFirstOrThrow()
  ```
  Avoid: inserting then querying in a separate call.

- **ArkType validation**: Use `.assert()` for validation — it throws on invalid input, so the global `app.onError` handler catches it naturally. Call the result `input`.
  ```ts
  const input = MySchema.assert(await c.req.json())
  ```

- **Remove declarations + references together**: When removing a variable, import, or component, remove its declaration and import statement in the same edit. Don't wait for the linter.
  ```ts
  // Not: leave import + declaration for a second pass
  // Do: delete usage, declaration, and import all in one edit
  ```

- **Avoid `queryClient.clear()` when observers are mounted**: `clear()` nukes all cached queries from React Query. If a component with an active observer (e.g. `useSession` in `AuthGuard`) is still mounted, React Query auto-refetches the query — which can trigger auth-interceptor cascades (401 → refresh → redirect clash). Prefer `setQueryData` to set stale data (e.g. `null`), or `invalidateQueries`/`removeQueries` with specific keys.
  ```ts
  // ❌ Don't:
  queryClient.setQueryData(["session"], null);
  queryClient.clear(); // triggers refetch → cascading 401s

  // ✅ Do:
  queryClient.setQueryData(["session"], null); // clean, no refetch
  ```

- **Response.json is single‑use**: Calling `.json()` consumes the Response body. If the data is needed in both a helper call and the return, `.clone()` first.
  ```ts
  const response = { id: user.id, email: user.email }
  return okResponse(c, response)
  await addAllTokensToCookie(c, false, response) // no clone needed because we extracted the object
  ```

## Avoid repeated object literals

Extract object literals used in multiple places to a variable immediately. Do not duplicate the same shape.

```typescript
// ❌ Don't:
return okResponse(c, { id: user.id, email: user.email, username: user.username })
await addAllTokensToCookie(c, false, { id: user.id, email: user.email, username: user.username })

// ✅ Do:
const response = { id: user.id, email: user.email, username: user.username }
return okResponse(c, response)
await addAllTokensToCookie(c, false, response)
```

## Parallel reads from node_modules

When checking a third-party library's API in node_modules, read ALL relevant .d.ts files in a single parallel tool call. One call, all reads at once.

## Test data principles

- **Passwords**: Use a deterministic known-valid password (e.g. `TestPassword123!@#`). Avoid random generation — it can fail ArkType constraint checks unpredictably.
- **Test what you touch**: When modifying an endpoint, add a test for it in the same change batch. Run tests before considering the change complete.

## PASETO key generation

Generate Ed25519 keys for PASETO v4 using the script:
```bash
pnpm pasetoKeys
```
This outputs `PASETO_PRIVATE_KEY` and `PASETO_PUBLIC_KEY` in the correct format for `.env`.

To regenerate keys, update `.env` with the new output and restart the dev server.

## Form input icons

All form inputs (`TextInput`, `PasswordInput`, etc.) should have a `leftSection` with a `@tabler/icons-react` icon matching the field's purpose. Use `size={16}` for the icon.

```tsx
<TextInput
  label="Email"
  placeholder="your@email.com"
  required
  leftSection={<IconMail size={16} />}
  {...form.getInputProps("email")}
/>
```

Common mappings: Email → `IconMail`, Password → `IconLock`, Username → `IconUser`, Avatar URL → `IconPhoto`.

## Code style

Use **2-space indentation** to match the Biome formatter config (`biome.json` has `indentStyle: space`, `indentWidth: 2`). Always run `pnpm format` before considering a change complete.

## Configuration files

Never modify AGENTS.md, opencode.json, skill files, or any configuration files unless the user explicitly asks you to edit that specific file.