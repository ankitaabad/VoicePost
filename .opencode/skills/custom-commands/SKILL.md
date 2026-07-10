---
name: custom-commands
description: "Use when the user asks about creating or editing opencode custom commands — `/command` definitions, command files, or the `.opencode/commands/` directory"
---

# Custom Commands

Custom commands can be defined inline in `opencode.json` under the `command` key, or
as files in `.opencode/commands/<name>.md`. Prefer the file-based approach — it keeps
`opencode.json` clean and the command prompt is easier to maintain.

## File format

```markdown
---
description: One-line description of what the command does
---

The prompt body — instructions for the AI when this command is invoked.
```
