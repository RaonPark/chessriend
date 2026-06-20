#!/bin/bash
# 프론트엔드 타입체크 (턴 종료 시 1회).
# Stop 이벤트에서 동작: 변경된 프론트 .ts/.tsx 가 있을 때만 tsc 로 프로젝트 전체 타입 검사.
# 타입 에러가 있으면 exit 2 로 stderr 를 Claude 에 돌려 턴을 멈추지 않고 수정하게 함.
# ESLint 가 못 잡는 타입 에러를 매 편집이 아닌 턴 끝에 한 번만 검사 → 중복 오버헤드 제거.
set -euo pipefail

input=$(cat)

# Stop 훅 재진입(무한 루프) 방지: 이미 stop-hook 처리 중이면 통과
active=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("stop_hook_active", False))' 2>/dev/null || echo False)
[[ "$active" == "True" ]] && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
frontend_dir="$project_dir/frontend"
[[ -d "$frontend_dir" ]] || exit 0

# 변경(스테이지/언스테이지/untracked)된 프론트 ts/tsx 가 없으면 검사 생략
changed=$(cd "$project_dir" && git status --porcelain 2>/dev/null | grep -E 'frontend/.*\.(ts|tsx)$' || true)
[[ -z "$changed" ]] && exit 0

output=$(cd "$frontend_dir" && pnpm exec tsc -b --noEmit 2>&1) || {
  {
    echo "TypeScript 타입 에러 (변경된 프론트 파일에 대한 프로젝트 전체 검사):"
    echo ""
    echo "$output"
    echo ""
    echo "타입 에러를 수정한 뒤 마무리하세요."
  } >&2
  exit 2
}
exit 0
