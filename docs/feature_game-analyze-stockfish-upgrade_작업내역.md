# feature/game-analyze-stockfish-upgrade 작업 내역

게임 분석 정확도 개선 — 분석 depth 18 상향 + Brilliant 분류 정확화(킹 희생 회귀 수정 + Win% 손실 기반 전환).

발단: 경기 `284447503368060928`의 11.`Bxf7+`(chess.com Brilliant)가 우리 앱에서는 inaccuracy로 잘못 분류됨.

---

## 1. 분석 depth 16 → 18

### What
- 배치(최초) 분석 depth를 16에서 **18**로 상향.
- depth 상수를 한 곳에서 관리하도록 공유 상수 `ANALYSIS_DEPTH = 18` 신설. 배치 분석과 실시간 평가가 동일 상수를 참조.

### Why
- depth 16에서는 11.`Bxf7+`가 inaccuracy로 오분류됐으나, depth 18에서는 평가가 정확해짐(우위 유지).
- batch(별도 상수 16)와 live(하드코딩 18)로 갈라져 있던 depth를 단일 소스로 통일해 drift 방지.

### Key files
- `frontend/src/features/game/constants.ts` (신규): `export const ANALYSIS_DEPTH = 18`
- `frontend/src/features/game/hooks/useBatchAnalysis.ts`: 기존 브라우저 배치 분석 제거. 백엔드 Stockfish SSE 호출로 대체.
- `frontend/src/features/game/hooks/useStockfish.ts`: 기본 파라미터 `depth = ANALYSIS_DEPTH`
- `frontend/src/features/game/components/GameViewer.tsx`: `useStockfish(ANALYSIS_DEPTH)`

---

## 2. Brilliant(!!) 분류 정확화

`classification.ts`만 변경. 두 가지 원인을 수정.

### 2-1. 킹 희생 인식 복원 (회귀 버그 수정)

**What**: 목적지를 공격하는 적 기물에서 킹을 제외하던 로직을 제거하고, 킹을 가치 0(`KING_AS_ATTACKER_VALUE = 0`) 공격자로 복원. `isDefended`(아군 방어자 존재) 가드는 유지. `isAtRisk = !isDefended && cheapestAttacker < PIECE_VALUES[piece]`. `detectBrilliant`의 별도 `cheapestAttacker` 검사는 `isAtRisk`로 일원화하며 제거.

**Why**: 그릭 기프트형 `Bxf7+`는 f7 비숍을 **킹만 되잡을 수 있는**(Kxf7) 희생인데, 이전 코드(커밋 `0e24b2b`, 5/16)가 킹 공격자를 통째로 제외해 `isAtRisk=false`가 되어 brilliant 후보에서 탈락했다. 원본 설계(`6e2e28a`, 4/22)는 킹을 value 0으로 취급해 Bxf7+를 잡았으므로, 그 동작을 복원한 것. (`isDefended` 추가는 5/16의 옳은 개선이라 유지.)
- 결과: Bxf7+(킹 0 < 비숍 3, f7 미방어) → 희생 ✓ / Nxe5(나이트 3 < 3 거짓) → 비희생 ✓.

### 2-2. cpLoss → Win% 손실 기반 분류 (lichess 방식)

**What**: 절대 centipawn 손실 대신 기대 승률(Win%) 손실로 전 분류를 판정.
- `winPercent(cp) = 100 / (1 + exp(-0.00368208 * cp))` 추가 (lichess 식).
- `classifyMove(winLoss)`: Blunder ≥ 30%p / Mistake ≥ 20%p / Inaccuracy ≥ 10%p.
- Brilliant tolerance: `BRILLIANT_CP_TOLERANCE(20cp)` → `BRILLIANT_WIN_TOLERANCE = 2`(%p).
- `computeClassifications`: cpBefore/cpAfter를 winPercent로 변환해 `winLoss` 계산, 분류는 winLoss로. **`cpLoss`는 표시/디버그용으로 계속 저장**(`MoveEvaluation` 타입 불변).

**Why**: cpLoss 절대값은 국면에 따라 의미가 달라진다. `Bxf7+`는 +5.5 우세 국면에서 cpLoss 38이지만 **Win%로는 1.5%p**(거의 최선수)에 불과. 그래서 cpLoss 20 임계로는 brilliant가 안 됐지만, Win% 손실 1.5%p < 2%p 임계로 정확히 brilliant로 승격된다. (`+8.0→+7.5`는 미미, `+0.0→-0.5`는 치명적 — 승률이 이를 올바르게 반영.)

### Key files
- `frontend/src/features/game/utils/classification.ts`
- `frontend/src/features/game/utils/__tests__/classification.test.ts` (전체 갱신: Win% 임계 30/20/10, detectBrilliant winLoss 인자, Bxf7+ 케이스 brilliant로 전환 등)

---

## 검증

- 단위 테스트: `pnpm test` → **15 files, 145 tests passed**. `pnpm build`(tsc -b + vite) 통과.
- E2E(실제 경기 `284447503368060928` 재분석, Playwright):
  - depth 18로 분석됨.
  - 11.`Bxf7+` → **Brilliant(!!)** 표시 (MoveList `!!` 뱃지, AnalysisSummary Brilliant 백 1).
  - 저장된 `game_analyses.evaluations[20].classification == "brilliant"`, brilliant 총 1개(오탐 없음).
  - 증거: `docs/test-screenshots/bxf7-brilliant-depth18.png`

## 범위 밖 / 후속
- Win% 임계값 정밀 튜닝(다수 게임 표본).
- decoy(비싼 기물만 공격) type 3 희생 검출.

---

# 3. 백엔드 Stockfish 초기 분석 (A안: in-process 프로세스 풀)

게임 "최초(배치) 분석"을 브라우저 WASM 에서 **백엔드 Stockfish** 로 이전. 실시간 평가/변형선은 브라우저 `useStockfish`(depth 18) 그대로 유지.

설계 비교 후 A안(Kotlin in-process 프로세스 풀) 채택. 상용 SaaS 청사진(`docs/request/stockfish_backend_architecture.md`)의 Python 분리/Redis/큐/티어는 개인 앱엔 과설계라 제외하고 `docs/todo/stockfish-scalability-backlog.md` 로 분리.

## 3-1. 엔진 (in-process UCI 프로세스 풀)

### What / Why
- `port/out/ChessEngine`: `suspend fun evaluate(fen, depth): EvalScore`(백 관점). 추후 사이드카/원격 교체 대비 포트로 추상화.
- `adapter/out/engine/`:
  - `UciStockfishProcess`: `ProcessBuilder` 로 stockfish 실행 → UCI 핸드셰이크(`uci`/`uciok`, `setoption Threads/Hash`, `isready`/`readyok`) → `position fen`+`go depth N` → `bestmove` 까지 마지막 `info score` 파싱. **백 관점 정규화**(흑 차례면 부호 반전, useStockfish.ts 와 동일). 모든 blocking I/O 는 `Dispatchers.IO`. 타임아웃 워치독이 `stop` 을 보내 best-so-far 반환을 유도하고, 취소 시 프로세스를 종료해 블로킹 readLine 을 해제한다.
  - `StockfishEnginePool`: `Channel`(용량=poolSize) 로 프로세스 대여 — **채널 자체가 상호 배제**(한 프로세스 1탐색). **지연 초기화**라 stockfish 미설치 환경(테스트/CI)에서 앱 기동·컨텍스트 로드가 실패하지 않음. 대여 중 사망 시 반납 시점에 respawn. `DisposableBean` 로 종료 시 `quit`.
  - `StockfishEngineAdapter`: `ChessEngine` 구현, 풀에 위임. `@EnableConfigurationProperties(ChessEngineProperties)`.
  - `ChessEngineProperties`: `chess.engine.*`(path/depth/threads/hashMb/poolSize/perPositionTimeoutMs). depth=18 은 프론트 `ANALYSIS_DEPTH` 와 lockstep.
- `UciParser`(순수 객체): `info score cp|mate` 정규식 + flip — 프로세스 spawn 없이 단위 테스트 가능.

## 3-2. 분류 로직 Kotlin 도메인 포팅

### What / Why
프론트 `classification.ts` 를 Kotlin 도메인으로 1:1 포팅(백엔드가 분석 단일 진실원). 도메인은 외부 의존 zero 유지 — 체스 라이브러리는 어댑터에 격리.
- `domain/analysis/MoveClassifier`(순수): `evalToCp`, `winPercent`(계수 −0.00368208), `classifyMove`(blunder≥30/mistake≥20/inaccuracy≥10 %p), `detectBrilliant`(tolerance<2, isAtRisk, 포획 시 piece>captured). 기물 가치(킹=0) 포함.
- `domain/analysis/GameAnalyzer`(순수): `computeClassifications(positionEvals, moves, contexts)` — 백/흑 cpLoss·winLoss 부호 처리 동일, `cpLoss` 보존 저장, base==null 일 때만 brilliant 승격.
- `domain/analysis/PieceKind`, `MoveContext`: 도메인 전용 값 객체(라이브러리 무관).
- `port/out/ChessRules` + `adapter/out/chess/ChesslibAdapter`(**chesslib 1.3.6**, JitPack): SAN→FEN 재구성 + 희생 판정(`squareAttackedBy`/`bbToSquareList` 로 chess.js `attackers` 대응; 킹=0, isDefended 가드).

## 3-3. 유스케이스 / SSE API

### What / Why
- `port/in/RunGameAnalysisUseCase`: `fun runAnalysis(gameId): Flow<AnalysisProgress>`(sealed: `Progress(current,total)` / `Completed(analysis)`).
- `application/RunGameAnalysisService`: 게임 조회 → FEN 재구성(부분 재생 가능) → 포지션별 엔진 평가(`ensureActive()` + progress emit) → 희생 컨텍스트 + 분류 → **기존 `GameAnalysisRepository.save` 재사용** → complete emit.
- `adapter/in/web/GameAnalysisController`: `GET /api/games/{gameId}/analysis/run`(`text/event-stream`) — 기존 import SSE 패턴 재사용. `progress`/`complete` 이벤트. 기존 `POST/GET .../analysis` 보존.
- `shared/exception`: `EngineUnavailableException`(503), `EngineTimeoutException`(504) + 핸들러.

## 3-4. 프론트엔드

### What / Why
- `api/gameApi.ts`: `createAnalysisRunEventSource(gameId)`(EventSource).
- `hooks/useBatchAnalysis.ts`: WASM 구동 제거 → **SSE 소비**로 재작성. 반환 시그니처(isAnalyzing/progress/analysis/error/startAnalysis/cancelAnalysis) 유지, `startAnalysis(gameId)` 로 변경. import SSE 와 동일한 generation 무효화 패턴.
- `components/GameViewer.tsx`: `handleStartAnalysis(gameId)`; auto-POST/`useSubmitAnalysis` 제거(백엔드가 run 중 저장) → complete 수신분을 `setAnalysis` + `invalidateQueries(detail)`. `classification.ts`/`useStockfish`(실시간)는 불변.

## 3-5. 검증
- 백엔드 단위(Kotest, 실제 엔진 불필요): `UciParserTest`(파싱+flip), `MoveClassifierTest`·`GameAnalyzerTest`(classification.test.ts 패리티), `ChesslibAdapterTest`(**Bxf7+ isAtRisk** — chess.js 동등성 게이트), `RunGameAnalysisServiceTest`(MockK 진행률/저장/GameNotFound). 모두 통과.
- `GameAnalysisControllerTest`(@SpringBootTest): 새 빈 와이어링 + 풀 지연 초기화 확인, 통과.
- 프론트: `pnpm test`(15 files, 145 tests) + `pnpm build` 통과.
- **(예정) E2E**: stockfish 설치 후 게임 `284447503368060928` 백엔드 재분석 → 11.Bxf7+ Brilliant @ depth18, 진행바 동작 확인.

## 후속 / 범위 밖
- 포지션 병렬 평가, 큐/잡 영속화, Redis 캐시, 엔진 사이드카, 사용량 제한/티어, MultiPV, GPL 검토, Docker 배포 → `docs/todo/stockfish-scalability-backlog.md`.
- 평가 패리티: 네이티브 stockfish ≠ 브라우저 WASM 가능성 → E2E(Bxf7+)가 게이트.
