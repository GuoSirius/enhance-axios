---
name: plan-md-maintain
description: plan.md must be kept, updated incrementally with each implementation phase
metadata:
  type: feedback
---

**Never delete `plan.md`.** After each implementation phase, update it incrementally with new features, changed config types, updated test counts, and build output changes.

**Why:** User stated "plan.md要保持，不要删除，每次做计划时都要增量更新" — it serves as the living project specification.

**How to apply:** After significant changes, read plan.md, update relevant sections (features, config types, directory structure, test counts, example buttons, mock endpoints), and commit alongside the code changes.
