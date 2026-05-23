# feat/multi-improvements 작업내역

> 작업일: 2026-05-23

여러 프론트엔드 개선을 한 번에 묶은 브랜치.

---

## 1. 게임 가져오기 중단 즉시 반영

**What**: SSE EventSource 기반 import에서 "중단" 버튼을 눌렀을 때 UI가 즉시 멈추지 않고 잔여 게임이 계속 들어오던 문제 수정.

**Why**: `EventSource.close()`는 향후 fetch만 중단하고, 이미 브라우저 큐에 파싱되어 쌓인 SSE 이벤트의 디스패치는 막지 못한다. Lichess/chess.com 응답이 NDJSON으로 다량 버퍼링되는 환경에서 close 직후에도 onmessage가 한동안 계속 호출됨.

**해결**: `useGameImport.ts`에 generation 카운터 도입. 각 import 세션이 고유 generation을 가지고, cancelImport가 호출되면 generation을 증가시켜 이후 들어오는 모든 핸들러(onmessage, onerror, complete)가 stale 체크 후 무시.

**수정 파일**:
- `frontend/src/features/game/hooks/useGameImport.ts` — generationRef 추가, 각 핸들러에 isStale 가드, cancelImport에서 ref nullify

**백엔드**: 변경 없음. `es.close()` → Spring reactive cancel → WebClient TCP close까지 이미 잘 전파됨 (`ImportGameService.kt:34`, `LichessClient.kt:54` 주석에 명시).

---

## 2. 분석 결과 요약 — 백/흑 분리 + 닉네임 표시

**What**: `AnalysisSummary`에서 brilliant/blunder/mistake/inaccuracy를 합쳐서 보여주던 것을 제거하고, 백/흑 각각 카운트를 비교 가능한 표 형태로 표시. "백"/"흑" 라벨 대신 실제 플레이어 닉네임 사용.

**Why**: 합계 카운트만으로는 누가 실수를 더 많이 했는지 알 수 없음. 닉네임을 직접 보여주면 누구의 게임인지 즉시 식별 가능.

**해결**:
- 합계 row 제거
- 3열 그리드 (분류 / ♔ 백 / ♚ 흑)로 한눈 비교
- 약어("!!", "B", "M", "I")는 정식 레이블(Brilliant/Blunder/Mistake/Inaccuracy)로 변경
- `whiteName`/`blackName` props를 GameDetailPage → GameViewer → AnalysisSummary로 전달
- 긴 닉네임은 `truncate` + `title` 속성으로 처리

**수정 파일**:
- `frontend/src/features/game/components/AnalysisSummary.tsx` — 레이아웃 재구성, props 추가
- `frontend/src/features/game/components/GameViewer.tsx` — blackName prop 추가, AnalysisSummary로 전달
- `frontend/src/features/game/components/GameDetailPage.tsx` — `game.black.name` 전달

---

## 3. 체크메이트 시 EvalBar에 게임 결과 표시

**What**: 체크메이트 도달 시 "M0"이 아니라 "1-0" 또는 "0-1"로 표시. 그래프도 승자 쪽으로 100% 채워짐 (이전엔 백 승에도 흑으로 꽉 차는 버그가 있었음).

**Why**: UCI의 `mate 0`은 side-to-move가 메이트당한 상태를 의미하는데, `useStockfish.ts:57`의 `mate * flip`이 `0 * flip = 0`이라 부호가 사라져서 누가 이겼는지 알 수 없었음. 그 결과 `evalToWhitePercent`에서 `mate > 0 ? 100 : 0` 분기가 항상 0(흑)을 반환.

**해결**: `EvalResult`에 `mateWinner: 'white' | 'black' | null` 필드 추가. Stockfish가 `mate 0`을 보낼 때 FEN의 side-to-move를 보고 승자를 명시적으로 기록. EvalBar의 세 곳(`evalToWhitePercent`, `formatEval`, `isWhiteAdvantage`)에서 mateWinner 우선 참조.

**수정 파일**:
- `frontend/src/features/game/hooks/useStockfish.ts` — `EvalResult` 확장, mate=0 시 mateWinner 계산
- `frontend/src/features/game/components/EvalBar.tsx` — mateWinner 분기 추가

**남은 이슈**: `useBatchAnalysis.ts:75`에도 동일한 mate=0 부호 손실이 있음. classification에 영향. `docs/backend_tasks.md` ★ 5번에 기록.

---

## 4. GameListItem 체크박스 인터랙션 (기존 변경)

**What**: 체크박스 클릭 시 `e.preventDefault() + readOnly` 대신 `e.stopPropagation() + onChange` 사용.

**Why**: `readOnly` checkbox는 접근성 문제(키보드 토글 안 됨)와 onClick에서 preventDefault로 인한 상태 동기화 깜빡임이 있었음. onChange로 정상 처리하고, 부모 링크로의 이벤트 버블링만 막음.

**수정 파일**:
- `frontend/src/features/game/components/GameListItem.tsx`

---

## 5. Claude Code 하네스 — 헥사고날 의존 가드 훅

**What**: `domain/` 패키지의 Kotlin 파일을 Edit/Write할 때마다 금지된 외부 프레임워크 import가 들어왔는지 자동 검사. 위반 발견 시 Claude에게 피드백을 돌려보내 즉시 수정하도록 유도.

**Why**: CLAUDE.md의 핵심 아키텍처 규칙 "Domain은 외부 의존성 zero, 의존 방향은 항상 바깥 → 안쪽"이 LLM이 작업할 때 종종 무시됨 (예: `@Component` 무심코 추가, `@JsonProperty` 도메인 객체에 부착). 사람이 PR 리뷰에서 잡는 대신, 작성 시점에 차단하는 게 비용/품질 모두 우위.

**해결**:
- `.claude/hooks/domain-deps-check.sh` 추가 — stdin의 PostToolUse JSON에서 `tool_input.file_path` 추출 (macOS 기본 `/usr/bin/python3`로 파싱, jq 의존성 없음). 경로가 `src/main/kotlin/**/domain/**.kt` 패턴일 때만 검사.
- 금지 import 정규식: `org.springframework`, `jakarta.`, `org.jooq`, `io.r2dbc`, `kotlinx.coroutines.reactor`, `org.flywaydb`, `reactor.core`, `com.fasterxml.jackson`
- 위반 시 exit 2 + stderr 출력 → Claude Code가 메시지를 다음 턴 컨텍스트에 주입
- `.claude/settings.local.json`의 `hooks.PostToolUse`에 `Edit|Write` 매처로 연결, `${CLAUDE_PROJECT_DIR}` 변수 사용

**검증 (4 케이스 파이프-테스트)**:
- 클린 도메인 파일 → exit 0
- 도메인 외부 파일 → exit 0 (스킵)
- 빈 입력 → exit 0
- 위반 시뮬레이션 (`org.springframework`, `com.fasterxml.jackson` 포함) → exit 2 + 상세 stderr 메시지

**수정 파일**:
- `.claude/hooks/domain-deps-check.sh` (신규, 실행권한 부여)
- `.claude/settings.local.json` — `hooks.PostToolUse` 블록 추가

**향후 확장 후보**:
- `application/`에서 `adapter/` import 차단 (의존 방향 한 단계 더)
- Stop 훅으로 `./gradlew compileKotlin` + `pnpm tsc --noEmit` 자동 검증

---

## 6. CI 실패 픽스 (PR #12)

**What**: PR #12에서 프론트/백엔드 CI 둘 다 실패한 것 해소.

### 6.1 프론트 — `BrilliantContext`에 `cheapestAttacker` 누락

**Why**: `detectBrilliant` 함수에 새 필드 `cheapestAttacker`가 추가됐는데, 기존 테스트들이 이를 전달하지 않아 TS2345 에러. 또 `extractMoveContext`에 안 쓰는 `const pieceValue` 변수가 남아 TS6133.

**해결**:
- `classification.test.ts` 12개 케이스에 `cheapestAttacker` 추가. brilliant=true 케이스는 `piece` 값보다 큰 값(주로 9 = 퀸, 퀸 자신은 `Number.POSITIVE_INFINITY`) 사용. brilliant=false 케이스는 다른 조건에서 먼저 false가 나오므로 어떤 값이든 무관.
- `classification.ts:115` 사용 안 하는 `const pieceValue` 제거.

**수정 파일**:
- `frontend/src/features/game/utils/classification.ts`
- `frontend/src/features/game/utils/__tests__/classification.test.ts`

### 6.2 백엔드 — jOOQ 생성 클래스 부재

**Why**: CI에서 `org.raonpark.chessriend.jooq.tables.references.GAMES` 미해결. `build/`는 gitignore이고 jOOQ 설정이 `localhost:5432` 실DB를 요구하는데 CI 잡에는 Postgres가 없음. `generateSchemaSourceOnCompilation = false`라 자동 생성도 안 됨.

**해결**:
- `build.gradle.kts`: Flyway Gradle 플러그인(11.16.0) 추가. Flyway 10+는 DB별 모듈이 분리되어 `flyway-database-postgresql`을 `buildscript.dependencies.classpath`에 넣어야 plugin이 인식.
- `flyway { url/user/password/locations }` 블록 + `tasks.named("generateJooq") { mustRunAfter(flywayMigrate) }` 설정.
- `.github/workflows/ci.yml`: backend job에 `postgres:16` services 컨테이너 추가 (5432 포트, healthcheck). `flywayMigrate → generateJooq → test` 순서 step.

**수정 파일**:
- `build.gradle.kts`
- `.github/workflows/ci.yml`

---

## 검증

- `pnpm tsc --noEmit` 통과
- `pnpm test --run` 통과 (141 테스트)
- `pnpm build` 통과 (PR #12 픽스 후)
- `./gradlew compileKotlin` 통과 (로컬에서 이미 jOOQ 생성됨)
- UI 동작 확인은 사용자가 `pnpm dev`로 직접 검증 필요
- CI에서 backend는 push 후 실제 실행 확인 필요
