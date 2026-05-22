---
name: claude-config-must-commit
description: .claude directory must always be committed to the repository
metadata:
  type: feedback
---

**Always commit `.claude/` directory.** It contains project-level Claude Code configuration (settings, memory, hooks) and is part of the project source.

**Why:** The user explicitly stated ".claude是必须要提交的" — it's project configuration, not transient artifacts.

**How to apply:** Always `git add .claude/` when committing. Never add `.claude/` to `.gitignore`.
