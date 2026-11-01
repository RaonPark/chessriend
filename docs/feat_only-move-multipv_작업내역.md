# feat/only-move-multipv 작업 내역

## 2026-11-01: MultiPV 2 + 유일수(`!`) 자동 분류

### 무엇을
- 백엔드 엔진이 **MultiPV 2**로 분석해 포지션마다 1순위/2순위 평가와 최선수(UCI)를 돌려준다.
  - `UciParser.parseInfo` / `extractPositionEval` (순수 함수), `PositionEval` 도메인 타입 신설.
  - `ChessEngine.evaluate` 반환 타입 `EvalScore` → `PositionEval`.
  - `ChessEngineProperties.multiPv`(기본 2, `CHESS_ENGINE_MULTI_PV`)로 설정 가능.
- `MoveClassifier.detectOnlyMove`, `GameAnalyzer`에 유일수 판정 추가 → classification 값 `"only"`.
- `MoveContext.uci` 추가: 둔 수가 엔진 1순위인지 비교하기 위해 chesslib 수의 UCI 표기를 담는다.
- 프론트: `MoveClassification`에 `'only'` 추가, 기호 `!`(sky), 수 목록 배경·분석 요약 배지·집계 반영.

### 유일수 판정 (모든 승률은 **둔 쪽 관점**, Win% = 기존 `winPercent` 곡선)
1. 둔 수가 엔진 1순위 수와 같다.
2. 1순위 승률 ≥ 45% (유리/동등 유지)
3. 2순위 승률 < 50% (2순위부터 상대가 유리)
4. 1·2순위 승률 차이 ≥ 20%p (사소한 부호 뒤집힘 제외 — 기존 Mistake 기준과 같은 값)
5. 합법수가 하나뿐이라 2순위가 없으면 유일수가 아니다(강제 수).
6. 우선순위: 실수 계열 → brilliant → only. 즉 실수/브릴리언트가 있으면 only는 붙지 않는다.
3순위는 보지 않는다: MultiPV는 점수순이라 2순위가 이미 불리하면 3순위는 같거나 더 나쁘다.

### 왜
- 사용자 요청: `!`를 "엔진에 유리함을 유지할 유일한 수"로 표시. 2순위부터 바로 상대가 유리해지는 경우만, 차이가 충분히 클 때만.
- 임계값(45/50/20)은 근거 있는 값이 아니라 초기값이다. 실제 게임으로 조정 필요.

### 변경 파일
| 파일 | 변경 |
|------|------|
| `game/domain/analysis/PositionEval.kt` | 신규 |
| `game/domain/analysis/PieceKind.kt` | `MoveContext.uci` |
| `game/domain/analysis/MoveClassifier.kt` | `detectOnlyMove`, 임계값 상수 |
| `game/domain/analysis/GameAnalyzer.kt` | `engineLines` 인자(기본 빈 목록), only 판정 |
| `game/port/out/ChessEngine.kt`, `adapter/out/engine/*` | 반환 타입 `PositionEval`, MultiPV 옵션, 파서 |
| `game/adapter/out/chess/ChesslibAdapter.kt` | `uci` 채움 |
| `game/application/RunGameAnalysisService.kt` | `engineLines` 전달 |
| `application.yml` | `chess.engine.multi-pv` |
| 프론트 `types/game.ts`, `moveSymbols.ts`, `analysisStats.ts`, `AnalysisSummary.tsx`, `MoveList.tsx` | `only` 반영 |
| `.claude/rules/ui.md` | 분류 색 표에 only(sky) 추가 |

### 검증
- 신규 테스트: `UciParserMultiPvTest`, `OnlyMoveTest`(백/흑 관점, 경계값, 우선순위), 프론트 `analysisStats`.
- 백엔드 전체 테스트 통과, 프론트 33파일 통과, tsc/eslint 통과.
- 실제 Stockfish 18 인수 테스트(`RUN_ENGINE_TEST=1`, 경기 284447503368060928, 39수): `!!`는 기존대로 index 20 하나,
  `!`(only)는 3개(16:bxc3, 28:Nxf6+, 30:Qxg4, 모두 되잡기). 분포 `{null=29, inaccuracy=3, only=3, brilliant=1, mistake=3}`.

### 미구현 / 후속
- 이미 저장된 분석에는 `only`가 없다 (재분석 필요).
- 변형선 자동 분류(브라우저 `useStockfish` MultiPV 필요): 저장하지 않고 열 때마다 재계산하기로 함.
- 목록용 요약(`GameAnalysisSummary`, `SideAnalysisSummary`)에는 only 개수를 넣지 않았다.
- 분석 시간 증가: MultiPV 2 비용은 측정하지 않았다.
- `!?`(흥미로운 수) 수동 마크는 별도 작업.
