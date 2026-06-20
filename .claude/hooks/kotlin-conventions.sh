#!/bin/bash
# Kotlin 컨벤션 가드: kotlin.md / spring.md 에서 "금지"로 명시된 패턴을 편집 시점에 차단.
# PostToolUse(Edit|Write) 대상, src/main/kotlin 의 .kt 만 검사(테스트/생성코드 제외).
# 위반 시 exit 2 로 stderr 를 Claude 에 되돌림.
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; print((json.load(sys.stdin).get("tool_input",{}) or {}).get("file_path","") or "")')

[[ -z "$file_path" ]] && exit 0
[[ "$file_path" == *"/src/main/kotlin/"*.kt ]] || exit 0
[[ -f "$file_path" ]] || exit 0

# 구분자는 @@@ (정규식의 | 와 충돌 방지). 명백한 위반 패턴만 좁게 매칭.
declare -a checks=(
  '\.(block|blockFirst|blockLast)[[:space:]]*\(@@@.block() 금지 — non-blocking 위반 (awaitBody/awaitSingle 사용)'
  '\bGlobalScope\b@@@GlobalScope 금지 — 구조적 동시성 위반 (coroutineScope/주입된 scope 사용)'
  '@Autowired@@@@Autowired 필드 주입 금지 — 생성자 주입 사용'
  '\bResponseEntity\b@@@ResponseEntity 래핑 금지 — suspend fun 이 DTO 를 직접 반환'
  ':[[:space:]]*Mono<@@@Mono<> 반환 금지 — suspend fun + Coroutines 사용'
  '([A-Za-z0-9_)]|\])!!@@@!! (non-null assertion) 금지 — requireNotNull() 또는 ?.let 사용'
)

violations=""
for entry in "${checks[@]}"; do
  pat=${entry%%@@@*}
  msg=${entry#*@@@}
  found=$(grep -nE "$pat" "$file_path" || true)
  if [[ -n "$found" ]]; then
    violations+="• $msg"$'\n'
    violations+=$(printf '%s\n' "$found" | sed 's/^/    /')$'\n'
  fi
done

if [[ -n "$violations" ]]; then
  {
    echo "Kotlin 컨벤션 위반: $file_path"
    echo ""
    printf '%s' "$violations"
    echo "위 패턴은 kotlin.md / spring.md 에서 금지로 명시되어 코드 리뷰에서 리젝됩니다."
  } >&2
  exit 2
fi
exit 0
