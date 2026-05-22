---
name: auto-commit-after-phase
description: After completing each implementation phase, auto-commit with a structured message
metadata:
  type: feedback
---

After every implementation phase or major change, commit immediately with a structured conventional-commit message. Do not wait for the user to ask.

**Why:** User stated "每做完一个阶段你就自己提交" — they want each phase captured as a discrete commit without reminders.

**How to apply:** After completing a coherent set of changes (feature, fix, refactor), immediately:
1. Review `git diff --stat` to confirm scope
2. Check `git log --oneline -5` for commit style consistency
3. Stage relevant files (never `.claude/settings.local.json`)
4. Commit with a conventional-commit message (feat:/fix:/refactor:/docs:) summarizing the WHY
