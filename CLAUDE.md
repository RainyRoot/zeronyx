# Collaboration with Claude

## Commit Guidelines

- Commits should be written as if authored by a human team member
- Do NOT include co-author lines, AI-generated markers, or other indicators of AI involvement
- Commit messages should be professional and treat Claude as a standard contributor

## Phase Management

At the end of each task:
1. Update `.claude/PHASE.md`: mark task as ✅, set next task, update progress counter and date
2. Append a new entry to `PROGRESS.md` (see format below) — never overwrite existing entries
3. Commit all changes to `dev` branch with a clear task message
4. Push to `dev` (e.g., `git push origin dev`)

**Branch Strategy:**
- `main` — Stable, production-ready state only
- `dev` — Active development and phase progression

## PROGRESS.md Format

When a task is complete, append the following block to `PROGRESS.md`:

```markdown
### ✅ Task X.Y — <Task Name>
**Datum:** YYYY-MM-DD | **Branch:** `dev`

| Datei | Zweck |
|---|---|
| [path/to/file.ts](path/to/file.ts) | What it does |
| ... | ... |

---
```

Rules:
- Use relative markdown links so they work on GitHub
- One row per file that was **created or significantly changed**
- Keep descriptions short (one line)
- Always append — never edit previous entries
