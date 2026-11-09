# 기물을 놓은 뒤 반투명으로 남는 버그 수정

## 증상
보드에서 기물을 끌었다가 **제자리에 다시 놓거나 둘 수 없는 칸에 놓으면**, 기물이 반투명(opacity 0.5) 상태로 남는 경우가 있었다.

## 원인
- react-chessboard는 드래그 중인 기물의 원래 칸을 반투명(ghost)으로 그리고, 드롭 처리(`handleDragEnd`)에서 `onPieceDrop`을 부른 **뒤** 드래그 상태(`draggingPiece`)를 `null`로 되돌린다.
- `onPieceDrop` → `boardStore.makeMove` → `chess.move()`인데, **chess.js 1.x는 불법 수에 `null`을 돌려주지 않고 예외(`Invalid move`)를 던진다.** 기존 코드는 `if (!result) return false`로 null만 처리했다.
- 예외가 드롭 처리 중간에 터져 `setDraggingPiece(null)`이 실행되지 않음 → 기물이 반투명으로 남음.

## 수정
- `frontend/src/features/game/stores/boardStore.ts` `makeMove`: `chess.move()`를 `try/catch`로 감싸 불법 수면 `false` 반환(포지션·변형선 상태 변화 없음).
- 다른 `chess.move()` 호출(저장된 기보 SAN 재생, 분류 계산)은 드래그와 무관하고 유효한 기보를 다루므로 그대로 둠.

## 테스트
- `stores/__tests__/boardStore.test.ts` — "둘 수 없는 수" 3건(제자리 드롭 / 갈 수 없는 칸 / 빈 칸에서 시작): 예외 없이 `false`, FEN·변형선 상태 그대로. 수정 전 3건 모두 실패 확인.
- 프론트 전체 293개 통과, `tsc`·`lint` 통과.
- 브라우저(Playwright)로 실제 드래그: `e2→e2`, `e2→e5`, `g1→g3` 모두 드래그 중 opacity 0.5 → 놓은 뒤 1로 복귀.
