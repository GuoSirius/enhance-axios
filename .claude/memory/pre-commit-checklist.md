---
name: pre-commit-checklist
description: Before every commit, run typecheck + tests + lint
metadata:
  type: feedback
---

Before every `git commit`, always run all three checks at once:
```bash
npx tsc --noEmit && npx vitest run && npx eslint src/ scripts/
```
**Why:** User is tired of finding broken commits. Pre-commit hook now enforces this.
**How to apply:** Run the command before commit, or let the .husky/pre-commit hook catch it.
