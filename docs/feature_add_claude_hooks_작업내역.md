# feature/add_claude_hooks 작업 내역

## What
Claude Code 훅 2종을 추가했다.

1. **ESLint 린트 훅** (`PostToolUse` / `Edit|Write`)
   - `.claude/hooks/eslint-check.sh`
   - Edit/Write 직후, 변경된 파일이 `frontend/`의 `.ts/.tsx/.js/.jsx`이면 해당 파일 1개에 대해 `pnpm exec eslint` 실행
   - lint 에러가 있으면 exit 2로 stderr를 Claude에 되돌려 수정 유도
   - Kotlin/백엔드 파일은 린터가 없어 그냥 통과(exit 0)

2. **데스크톱 알림 훅** (`Notification`, `Stop`)
   - `.claude/hooks/notify.sh`
   - `Notification`: Claude가 사용자 입력/권한을 기다릴 때 → "입력 필요" 알림 (Funk 사운드)
   - `Stop`: Claude가 응답을 마쳤을 때 → "작업 완료" 알림 (Glass 사운드)
   - macOS `osascript display notification` 사용, argv로 전달해 따옴표/특수문자 인젝션 방지

3. **Bash 보안 가드 훅** (`PreToolUse` / `Bash`)
   - `.claude/hooks/bash-guard.sh` (python3)
   - Bash 명령 실행 *전*에 검사해 `permissionDecision`(JSON)으로 차단/확인 분기
   - **deny(차단)**: `rm -rf`(재귀 삭제), `git reset --hard`, `git clean -f`, `git push --force`(단 `--force-with-lease`는 허용), `.env` 파일 읽기/출력(`.env.example` 등은 허용), `dd of=/dev/*`, `mkfs`, 블록 디바이스 덮어쓰기, fork bomb, `chmod -R 777 /`
   - **ask(확인)**: 일반 `rm`(비재귀 삭제), `curl|wget ... | sh`(원격 스크립트 실행), `git checkout .`, `sudo`
   - 그 외 명령은 출력 없이 통과 → 기존 권한 규칙대로 진행

## Why
- 린트: 프론트엔드 코드 품질을 편집 시점에 자동 검증. 백엔드는 ktlint/detekt 미설정이라 대상에서 제외.
- 알림: 긴 작업 중 자리를 비워도 입력 대기/완료 시점을 데스크톱에서 즉시 인지.
- Bash 가드: 복구 불가능한 파괴적 명령과 시크릿 노출을 실행 전에 차단. 애매한 삭제/권한 상승은 막지 않고 사용자 확인(ask)으로 위임해 과차단 방지.

4. **Flyway 마이그레이션 가드** (`PreToolUse` + `PostToolUse` / `Edit|Write`)
   - `.claude/hooks/flyway-guard.sh`
   - `PreToolUse`: `db/migration/V*__*.sql` 중 `main`(또는 `origin/main`)에 **이미 병합된** 파일 수정을 deny (Flyway 체크섬 불일치로 기동 실패 방지) → 새 버전 파일을 만들도록 유도. 현재 브랜치에서 새로 만든 마이그레이션은 허용.
   - `PostToolUse`: 마이그레이션 변경 시 `additionalContext`로 `./gradlew generateJooq` 재생성을 환기 (database.md 규칙).

5. **Kotlin 컨벤션 가드** (`PostToolUse` / `Edit|Write`)
   - `.claude/hooks/kotlin-conventions.sh` — `domain-deps-check`와 동일한 grep 방식, `src/main/kotlin`의 `.kt`만 대상(테스트/생성코드 제외)
   - kotlin.md/spring.md에서 금지로 명시된 패턴 검출 시 exit 2: `.block()`, `GlobalScope`, 필드 `@Autowired`, `ResponseEntity`, `Mono<` 반환, `!!`(non-null assertion)
   - 구분자는 `@@@`(정규식 `|`와 충돌 방지), `!!`는 `([A-Za-z0-9_)]|\])!!`로 매칭(bracket 이스케이프 회피)

6. **TypeScript 타입체크** (`Stop` / 턴 종료 시 1회)
   - `.claude/hooks/tsc-check.sh` — 매 편집이 아니라 턴이 끝날 때 한 번만 실행. tsc는 프로젝트 전체를 검사하므로 파일별로 돌릴 이유가 없음 → 중복 오버헤드 제거.
   - 동작: `git status`로 변경된 프론트 `.ts/.tsx`가 있을 때만 `pnpm exec tsc -b --noEmit` 실행. 타입 에러 시 exit 2로 Claude에 피드백.
   - 무한 루프 방지: `stop_hook_active`가 true면 재검사 생략.
   - 증분 빌드 캐시로 보통 1~2초.

## 설정 위치
- 이 레포는 `.claude/settings.json`이 gitignore되고 `.claude/settings.local.json`이 커밋되는 구조 → 훅 설정은 기존 컨벤션대로 `settings.local.json`에 추가.
- ESLint 훅은 기존 `domain-deps-check.sh`와 같은 `PostToolUse Edit|Write` matcher의 hooks 배열에 나란히 추가.

## Key Files
- `.claude/hooks/eslint-check.sh` (신규)
- `.claude/hooks/notify.sh` (신규)
- `.claude/settings.local.json` (PostToolUse에 eslint 추가, Notification/Stop 훅 추가)

## 검증
- `settings.local.json` JSON 유효성 OK
- `notify.sh`: Stop / Notification 페이로드로 알림 정상 발생 (exit 0)
- `eslint-check.sh`: `frontend/src/App.tsx` 대상 eslint 실행 → 통과(exit 0), 비프론트 파일(`build.gradle.kts`)은 skip(exit 0)
