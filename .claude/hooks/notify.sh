#!/bin/bash
# Desktop notification hook (macOS).
# Wired to:
#   - Notification : Claude 가 사용자 입력/권한을 기다릴 때
#   - Stop         : Claude 가 응답(작업)을 마쳤을 때
# Reads the hook JSON on stdin to pick a message, then shows a native notification.

set -euo pipefail

input=$(cat)

event=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("hook_event_name",""))')

case "$event" in
  Notification)
    title="Claude Code — 입력 필요"
    body=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("message","") or "확인이 필요해요")')
    sound="Funk"
    ;;
  Stop)
    title="Claude Code — 작업 완료"
    body="응답을 마쳤어요"
    sound="Glass"
    ;;
  *)
    title="Claude Code"
    body="$event"
    sound="Glass"
    ;;
esac

# osascript 에 argv 로 전달해 따옴표/특수문자 인젝션 방지
osascript - "$title" "$body" "$sound" <<'APPLESCRIPT' >/dev/null 2>&1 || true
on run argv
  display notification (item 2 of argv) with title (item 1 of argv) sound name (item 3 of argv)
end run
APPLESCRIPT

exit 0
