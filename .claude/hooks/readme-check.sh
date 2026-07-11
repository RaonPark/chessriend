#!/bin/bash
# README freshness nudge (advisory only — never blocks).
#
# PostToolUse(Edit|Write)에서 동작. 백엔드 레이어 패키지나 프론트 소스를 편집했는데
# 1) 해당 패키지에 README.md 가 없거나
# 2) 루트 README.md 가 비어 있으면(<10줄)
# 권고 메시지를 stderr 로 돌려준다. PostToolUse 라 편집은 이미 끝났으므로 차단하지 않는다.
#
# 활성화: .claude/settings.local.json 의 PostToolUse(matcher "Edit|Write") 배열에 추가
#   { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/readme-check.sh", "timeout": 10 }

set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path","") or "")')

[[ -z "$file_path" ]] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
notes=()

# 루트 README 존재/내용 점검 (비어 있거나 10줄 미만이면 권고)
root_readme="$root/README.md"
if [[ ! -f "$root_readme" ]]; then
  notes+=("루트 README.md 가 없습니다. 프로젝트 개요/실행법을 담은 README 를 만들어 주세요.")
elif [[ "$(wc -l < "$root_readme" | tr -d ' ')" -lt 10 ]]; then
  notes+=("루트 README.md 가 너무 짧습니다(<10줄). 기능/스택/실행법이 최신인지 확인해 주세요.")
fi

# 백엔드 레이어 패키지 README 점검
#   game/{domain,application,port,adapter}/**, shared/**  →  각 레이어 루트에 README.md 권고
backend_layer=""
case "$file_path" in
  */src/main/kotlin/*/game/domain/*)      backend_layer="game/domain" ;;
  */src/main/kotlin/*/game/application/*) backend_layer="game/application" ;;
  */src/main/kotlin/*/game/port/*)        backend_layer="game/port" ;;
  */src/main/kotlin/*/game/adapter/*)     backend_layer="game/adapter" ;;
  */src/main/kotlin/*/shared/*)           backend_layer="shared" ;;
esac

if [[ -n "$backend_layer" ]]; then
  # 편집 파일 경로에서 레이어 루트 디렉터리를 복원 (.../<base>/game/... 또는 .../<base>/shared/...)
  base="${file_path%%/game/*}"
  base="${base%%/shared/*}"
  layer_dir="$base/$backend_layer"
  if [[ -d "$layer_dir" && ! -f "$layer_dir/README.md" ]]; then
    notes+=("$backend_layer/ 패키지에 README.md 가 없습니다. 레이어 역할/주요 클래스/주의사항을 문서화해 주세요.")
  fi
fi

# 프론트 소스 변경 시 frontend/README 점검
case "$file_path" in
  */frontend/src/*.ts|*/frontend/src/*.tsx)
    fe_readme="$root/frontend/README.md"
    if [[ ! -f "$fe_readme" ]] || grep -q "React + TypeScript + Vite" "$fe_readme" 2>/dev/null; then
      notes+=("frontend/README.md 가 없거나 Vite 기본 템플릿입니다. 프로젝트 실제 구조로 갱신해 주세요.")
    fi
    ;;
esac

if [[ ${#notes[@]} -gt 0 ]]; then
  {
    echo "📝 README 점검 (권고 — 편집은 차단되지 않음):"
    for n in "${notes[@]}"; do echo "  - $n"; done
    echo ""
    echo "문서 규칙: .claude/rules/docs.md · 패키지 README 기준: 루트 README.md"
  } >&2
  exit 2
fi

exit 0
