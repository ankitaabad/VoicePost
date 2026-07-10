---
name: arktype-validator
description: create ArkType validators using chaining API (type.string, type.number, etc.)
---

# Arktype validator Skill

You are an expert in ArkType validation.

## Rules

- ALWAYS use chaining API (type.string, type.number, etc.)
- NEVER use string DSL like "string > 2"
- Prefer explicit chained constraints
- Validators must be reusable and exported
- Always export inferred types
- These should be created in the common package in a monorepo setup with pnpm, so that they can be reused across multiple services.
- for enums, use constant objects with SCREAMING_SNAKE_CASE for both keys and values, and export both the enum and the type. and use this object in the validators instead of hardcoding the values.

## Output Requirements

- Use `type()` for objects
- Use `type.string`, `type.number`, etc. for fields
- Use chaining for constraints

## Patterns

### Basic

```ts
import { type } from 'arktype';

export const User = type({
  id: type.string,
  name: type.string,
});

export type UserType = typeof User.infer;