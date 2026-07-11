# Documentation Rules

- Write/update work logs in `docs/` for every task
- Filename: `{type}_{name}_작업내역.md` — 브랜치명 기반이되 `/`는 `_`로 (실제 `docs/` 관례)
  - 예: `feat_game-import_작업내역.md`, `fix_chesscom-import-latest-first_작업내역.md`, `chore_mcp-playwright-setup_작업내역.md`
  - type: `feat`/`feature`, `fix`/`bugfix`, `chore`, `update` 등
- Each entry must include:
  - **What** was changed
  - **Why** (decision rationale)
  - Key modified files
- Frontend work: document in detail (component descriptions, usage)
- Architecture changes: also update `docs/architecture.md`
