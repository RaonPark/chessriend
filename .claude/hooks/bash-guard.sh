#!/usr/bin/python3
# PreToolUse 가드: 위험한 Bash 명령을 차단(deny)하거나 확인(ask)한다.
#   - deny : rm -rf, git reset --hard, .env 읽기/출력, 디스크 덮어쓰기 등
#   - ask  : 일반 파일 삭제(rm), 원격 스크립트 파이프 실행 등 (사용자 확인 후 진행)
# PreToolUse 는 JSON 으로 permissionDecision 을 돌려주면 그대로 적용된다.
import sys, json, re

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool = data.get("tool_name", "")
cmd = (data.get("tool_input", {}) or {}).get("command", "") or ""

# Bash 명령에만 적용
if tool != "Bash" or not cmd.strip():
    sys.exit(0)


def decide(decision, reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


# (regex, 사유) — 위에서부터 먼저 매치되는 규칙 적용
DENY = [
    (r'\brm\s+(-\S*[rR]\S*|--recursive)', "재귀적 rm (rm -rf 등) — 디렉터리 전체가 복구 불가하게 삭제됨"),
    (r'\bgit\s+reset\s+--hard\b', "git reset --hard — 커밋·작업 내용이 복구 불가하게 손실됨"),
    (r'\bgit\s+clean\s+-\S*f', "git clean -f — 추적되지 않은 파일이 영구 삭제됨"),
    (r'\bgit\s+push\b[^\n]*(--force(?!-with-lease)\b|\s-f\b)', "git push --force — 원격 히스토리를 덮어씀 (--force-with-lease 권장)"),
    (r'(cat|less|more|head|tail|bat|nl|xxd|od|strings|cp|scp|mv|vi|vim|nano|code|open)\b[^\n]*\.env(?!\.example|\.sample|\.template)\b',
     ".env 파일 접근 — 시크릿이 노출될 수 있음 (필요하면 직접 확인)"),
    (r'\bdd\b[^\n]*\bof=/dev/', "dd of=/dev/* — 디스크를 직접 덮어씀"),
    (r'\bmkfs\b', "mkfs — 파일시스템 포맷"),
    (r'>\s*/dev/(sd|disk|nvme|hd)', "블록 디바이스 덮어쓰기"),
    (r':\s*\(\s*\)\s*\{.*\}\s*;\s*:', "fork bomb 의심"),
    (r'\bchmod\s+-R\s+777\s+/', "chmod -R 777 / — 시스템 전역 권한 파괴"),
]

ASK = [
    (r'\brm\b', "파일 삭제(rm) — 실행 전 확인이 필요함"),
    (r'(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(ba)?sh\b', "원격 스크립트를 셸로 파이프 실행 — RCE 위험, 확인 필요"),
    (r'\bgit\s+checkout\s+(--\s+)?\.(\s|$)', "git checkout . — 로컬 변경 사항이 폐기됨"),
    (r'\bsudo\b', "sudo 권한 상승 — 확인 필요"),
]

for pat, reason in DENY:
    if re.search(pat, cmd):
        decide("deny", reason)

for pat, reason in ASK:
    if re.search(pat, cmd):
        decide("ask", reason)

# 매치 없음 → 결정 출력 없이 통과 (기존 권한 규칙대로 진행)
sys.exit(0)
