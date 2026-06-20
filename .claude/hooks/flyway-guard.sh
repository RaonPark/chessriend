#!/bin/bash
# Flyway 마이그레이션 가드.
#   - PreToolUse  : 이미 main(또는 origin/main)에 병합된 V*__*.sql 수정 차단.
#                   Flyway 는 체크섬을 검증하므로 적용된 마이그레이션을 고치면 기동 실패.
#                   → 새 버전 파일(Vn+1__...) 을 만들도록 deny.
#   - PostToolUse : 마이그레이션이 추가/변경되면 ./gradlew generateJooq 재생성을 Claude 에 환기.
set -euo pipefail

input=$(cat)
event=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("hook_event_name",""))')
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; print((json.load(sys.stdin).get("tool_input",{}) or {}).get("file_path","") or "")')

[[ -z "$file_path" ]] && exit 0
# db/migration/ 아래 .sql 만 대상
[[ "$file_path" == *"/db/migration/"*.sql ]] || exit 0

emit() { # decision reason  (PreToolUse 전용)
  /usr/bin/python3 - "$1" "$2" <<'PY'
import sys, json
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": sys.argv[1],
    "permissionDecisionReason": sys.argv[2],
}}))
PY
}

case "$event" in
  PreToolUse)
    repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
    rel=${file_path#"$repo_root"/}
    base=""
    for b in main origin/main; do
      if git rev-parse --verify "$b" >/dev/null 2>&1; then base="$b"; break; fi
    done
    [[ -z "$base" ]] && exit 0
    # base 브랜치에 이미 존재하면 = 병합된 마이그레이션 → 불변
    if git cat-file -e "$base:$rel" 2>/dev/null; then
      emit deny "이미 '$base'에 병합된 Flyway 마이그레이션($rel)입니다. 수정하면 체크섬 불일치로 기동이 실패합니다. 대신 새 버전 파일(V<다음번호>__...sql)을 추가하세요."
    fi
    exit 0
    ;;
  PostToolUse)
    /usr/bin/python3 <<'PY'
import json
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Flyway 마이그레이션이 변경되었습니다. 스키마가 바뀌었다면 './gradlew generateJooq'로 jOOQ 생성 코드를 재생성하세요 (database.md 규칙).",
}}))
PY
    exit 0
    ;;
esac
exit 0
