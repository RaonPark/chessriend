# feat: 보드 legal move 힌트 + 클릭으로 두기

## What
- 기물을 클릭하거나 드래그하기 시작하면 그 기물이 갈 수 있는 칸을 보드에 표시
  - 선택한 칸: amber 하이라이트 (`rgba(245, 158, 11, 0.5)`)
  - 빈 칸: 가운데 작은 점
  - 잡을 수 있는 칸 (앙파상 포함): 테두리 링
- 클릭으로 두기: 기물 클릭 → 표시된 칸 클릭으로 수 이동 (기존 드래그도 그대로 동작)
  - 같은 칸을 다시 클릭하거나 빈 칸/상대 기물을 클릭하면 선택 해제
  - 차례가 아닌 쪽의 기물은 둘 수 있는 수가 없으므로 선택되지 않음
  - 프로모션은 드래그와 동일하게 퀸으로 자동 승격

## Why
- chess.com / lichess와 같은 익숙한 UX. 변형선을 탐색할 때 둘 수 있는 수를 바로 볼 수 있게 하려고
- 선택 상태를 `{ fen, square }`로 저장하고 현재 FEN과 다르면 무시
  → 수 이동이나 네비게이션으로 포지션이 바뀌면 `useEffect` 없이도 선택이 자동으로 해제됨
- 계산 로직은 순수 함수(`utils/moveHints.ts`)로 분리해서 단위 테스트를 작성
- 선택 상태는 보드 UI에만 필요한 로컬 상태라서 Zustand store가 아닌 `useState`에 둠

## 참고
- 분석이 끝나기 전에는 `boardStore.makeMove`가 메인라인 분기를 막는 기존 규칙이 그대로 적용됨
  (힌트는 표시되지만, 클릭이나 드래그로 수를 둘 수는 없음)

## Key files
- `frontend/src/features/game/utils/moveHints.ts` — `getLegalTargets(fen, square)`, `buildMoveHintStyles(selected, targets)`
- `frontend/src/features/game/utils/__tests__/moveHints.test.ts` — 테스트 10개
- `frontend/src/features/game/components/GameBoard.tsx` — `squareStyles`, `onSquareClick`, `onPieceDrag` 연결
