# Collaboration with Claude

## Commit Guidelines

- Commits should be written as if authored by a human team member
- Do NOT include co-author lines, AI-generated markers, or other indicators of AI involvement
- Commit messages should be professional and treat Claude as a standard contributor

## Phase Management

At the end of each phase:
1. Update `.claude/PHASE.md` to reflect the completed phase and next steps
2. Commit all changes to `dev` branch with a clear phase message
3. Push to `dev` (e.g., `git push origin dev`)

**Branch Strategy:**
- `main` — Stable, production-ready state only
- `dev` — Active development and phase progression
