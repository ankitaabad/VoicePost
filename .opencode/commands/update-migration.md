---
description: Prime the agent to follow the rework workflow when you later request a migration change
---

For the current or upcoming discussion: whenever I ask you to create or update a migration, follow this workflow first before writing any code:

1. **Down migration** — Run `pnpm migrate:down` (from `backend/`) to roll back the latest migration.
2. **Update migration** — Edit the most recent migration file in `backend/migrations/` according to what we discussed.
3. **Confirm** — Show me a summary of the changes and ask for confirmation before proceeding.
4. **Up migration** — Once confirmed, run `pnpm migrate:up`.
5. Run `pnpm gen` to regenerate `schema.generated.ts`
