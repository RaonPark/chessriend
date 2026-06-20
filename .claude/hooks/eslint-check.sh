#!/bin/bash
# Frontend lint guard: run ESLint on edited frontend files.
# Triggered on PostToolUse for Edit/Write. Exit 2 sends stderr back to Claude.
# Kotlin/backend files are skipped (no linter configured for them).

set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path","") or "")')

[[ -z "$file_path" ]] && exit 0
# 프론트엔드 소스 파일만 대상 (eslint.config.js 가 있는 frontend/)
[[ "$file_path" == *"/frontend/"*.ts || "$file_path" == *"/frontend/"*.tsx \
   || "$file_path" == *"/frontend/"*.js || "$file_path" == *"/frontend/"*.jsx ]] || exit 0
[[ -f "$file_path" ]] || exit 0

frontend_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}/frontend"
[[ -d "$frontend_dir" ]] || exit 0

# 변경된 파일 1개에 대해서만 eslint 실행 (빠름)
output=$(cd "$frontend_dir" && pnpm exec eslint "$file_path" 2>&1) || {
  {
    echo "ESLint found issues in $file_path"
    echo ""
    echo "$output"
    echo ""
    echo "Fix the lint errors above before continuing."
  } >&2
  exit 2
}

exit 0
