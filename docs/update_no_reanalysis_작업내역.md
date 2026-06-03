# `update/no_reanalysis` 작업 내역

## What

- `AnalysisSummary`에서 "재분석" 버튼과 `onReanalyze` prop 제거.
- 헤더가 단일 라벨만 남으므로 `flex items-center justify-between`을 단순 `mb-3` 블록으로 정리.
- `GameViewer`에서 `<AnalysisSummary />` 호출 시 `onReanalyze={handleStartAnalysis}` 전달 제거.

## Why

- 사용자가 같은 게임에서 "재분석"을 반복 호출하면 브라우저 Stockfish(WASM, `useBatchAnalysis`)가 매번 모든 메인라인 포지션을 재평가하여 비용이 누적됨.
- "내 게임이니까 더 애정을 가지게" 만든다는 제품 철학상, 분석은 게임당 1회로 충분. 재분석이 필요하면 기능 자체를 다시 검토할 때 별도 정책으로 도입.
- 최초 분석("게임 분석" 버튼) 흐름은 변경 없이 그대로 유지 — 분석되지 않은 게임에서는 여전히 진입 가능.

## 유지된 것 (의도)

- `useBatchAnalysis` 훅 전체 — 최초 분석 엔진 + 진행 중 분석 취소(`cancelAnalysis`, `generationRef`)에 여전히 필요.
- `useSubmitAnalysis` 자동 저장 흐름.
- `boardStore.setAnalysis` / `clearAnalysis`.
- `useStockfish` (EvalBar 실시간 평가).
- `GameViewer`의 `handleStartAnalysis` — "게임 분석" 버튼이 사용.

## Key modified files

- `frontend/src/features/game/components/AnalysisSummary.tsx`
  - Props 인터페이스에서 `onReanalyze` 제거.
  - 함수 시그니처에서 `onReanalyze` 제거.
  - 재분석 `<button>` 제거 및 헤더 래퍼 단순화.
- `frontend/src/features/game/components/GameViewer.tsx`
  - `<AnalysisSummary />` 호출부에서 `onReanalyze` 전달 한 줄 제거.

## 검증

- 정적: `grep -rn "재분석\|onReanalyze\|reanalyze\|reAnalyze" frontend/src` → 0건.
- 빌드: `cd frontend && pnpm build` 통과.
- 동작: Playwright로 분석 완료된 게임 페이지에서 "재분석" 버튼 부재 확인.
