---
description: Session retrospective — identify suboptimal choices and suggest ways to use opencode more optimally
---

Run a full session retrospective. Scan the entire conversation history.
The goal: find patterns where we wasted time, took a roundabout route, or could have gotten what we wanted faster using opencode better.

For each issue you find, identify what type of improvement would help and produce a concrete recommendation:

1. **Issue** — what we did and why it was suboptimal (tool choice, command patterns, prompt phrasing, code approach, manual steps the AI could have automated, etc.)
2. **Better approach** — the faster/more efficient way
3. **Recommendation type & content** — suggest which lever to pull:
   - **AGENTS.md**: a copy-pasteable entry to add to AGENTS.md so I follow best practices automatically
   - **Skill**: a new skill with a description that would auto-trigger on relevant tasks, including full SKILL.md content
   - **Custom command**: a new opencode command with description + prompt to shortcut a repeated pattern
   - **Prompt tweak**: how the user could have phrased their request differently to get a better result faster
   - **User flow**: something the user should do differently on their side (e.g. next time, start by asking for a plan first)

## Metrics

Count and categorize every tool call used in the session:

- **Total tool calls**: X (read: Y, edit: Z, bash: W, search: V, task: U, webfetch: T, docs-search: S)
- **Sequential-to-parallel ratio**: How many independent steps ran sequentially vs in parallel. Flag cases where the AI could have batched reads, writes, or searches.
- **Re-reads**: Files read more than once unnecessarily. Note if the AI re-read files whose content was already in context from earlier reads or agent output.
- **AGENTS.md hits/misses**: Which existing rules were followed, which were broken, and whether the session surfaced new patterns that should become rules.

Use these metrics to guide the recommendations. A high sequential ratio or many re-reads is a concrete signal that a workflow/AI habit should change.

Be thorough and honest. Include everything, even small things. The goal is to get faster over time.

If nothing notable comes up, say so. At the end, output a concise summary section `## Action Items` listing the top changes to implement (AGENTS.md edits, new skills, new commands, or user habits to adopt) ordered by impact.
