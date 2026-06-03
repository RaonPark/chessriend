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
- `frontend/src/features/game/hooks/useBatchAnalysis.ts`: `BATCH_DEPTH=16` 제거 → `ANALYSIS_DEPTH` 사용 (`go depth`, 저장 `depth`)
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
- **백엔드 Stockfish(최초 분석만 서버 수행) — 다음 플랜에서 진행.**
