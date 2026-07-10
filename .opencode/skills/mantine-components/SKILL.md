---
name: mantine-components
description: create React components using Mantine with clean structure and best practices
---

# Mantine Component Generator

## Goal

Generate clean, reusable React components using Mantine with proper separation of UI, logic, and data fetching.

---

## Context

* Frontend: React
* UI Library: Mantine
* Data fetching: React Query (or custom hooks)
* Architecture: feature-based structure

---

## Core Rules

### 1. Separate UI and logic

* UI components must NOT contain:

  * API calls
  * business logic
* Use hooks for logic
* use mantine forms for form handling
* You should generally use types and validators from the common package, and not create new ones in the component itself, unless it's something very specific to that component. The common package should be the source of truth for types and validation rules.

---

### 2. Use Mantine components (no raw HTML unless needed)

Prefer:

```tsx
import { Button, TextInput, Stack, Group } from "@mantine/core"
```

Avoid:

```tsx
<div>...</div>
```

---



---

### 4. Consistent layout using Mantine primitives

Use:

* `Stack` for vertical layout
* `Group` for horizontal layout
* `Container`, `Card`, `Paper` for structure

---

### 5. No inline fetch calls

❌ DO NOT:

```tsx
useEffect(() => {
  fetch("/api/users")
}, [])
```

✅ Use hooks:

```tsx
const { data } = useUsers()
```

---

### 6. Keep components small and focused

* One responsibility per component
* Split large components into smaller ones

---

## Folder Structure

```txt
features/user/
  components/
    user-form.tsx
    user-list.tsx
  hooks/
    use-users.ts
  api/
    user.api.ts
```

---

## Patterns

---

### 🧩 Basic Component

```tsx
import { Card, Text, Stack } from "@mantine/core"

type Props = {
  title: string
  description?: string
}

export function InfoCard({ title, description }: Props) {
  return (
    <Card withBorder>
      <Stack gap="xs">
        <Text fw={500}>{title}</Text>
        {description && <Text c="dimmed">{description}</Text>}
      </Stack>
    </Card>
  )
}
```

---

### 🧾 Form Component

```tsx
import { useState } from "react"
import { TextInput, Button, Stack } from "@mantine/core"

type Props = {
  onSubmit: (data: { email: string }) => void
  loading?: boolean
}

export function UserForm({ onSubmit, loading }: Props) {
  const [email, setEmail] = useState("")

  return (
    <Stack>
      <TextInput
        label="Email"
        placeholder="Enter email"
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
      />

      <Button
        onClick={() => onSubmit({ email })}
        loading={loading}
      >
        Create User
      </Button>
    </Stack>
  )
}
```

---

### 🔗 Component with Hook

```tsx
import { Card, Text, Stack, Loader } from "@mantine/core"
import { useUsers } from "../hooks/use-users"

export function UserList() {
  const { data, isLoading } = useUsers()

  if (isLoading) return <Loader />

  return (
    <Stack>
      {data?.map((user) => (
        <Card key={user.id} withBorder>
          <Text>{user.email}</Text>
        </Card>
      ))}
    </Stack>
  )
}
```

---

## UX Guidelines

* Show loading states (`Loader`, `Skeleton`)
* Show empty states
* Disable buttons during loading
* Use meaningful labels and placeholders

---

## Anti-Patterns (DO NOT DO)

❌ Fetching data inside components
❌ Mixing UI and business logic
❌ Giant components
❌ Inline styles instead of Mantine props
❌ Using raw `<div>` for layout when Mantine alternatives exist

---

## Output Requirements

* Fully typed props
* Functional components only
* Clean, readable structure
* Uses Mantine primitives for layout
* No unnecessary complexity

---

## Optional Enhancements

* Add validation (if form)
* Add loading/empty states
* Extract reusable subcomponents

---

## Mental Model

Components should be:

* reusable
* predictable
* UI-focused
* independent from data layer
