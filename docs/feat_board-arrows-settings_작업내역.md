# feat: 보드 화살표 저장 · 엔진 최선수 화살표 설정 · 상세 화면 레이아웃 개편

## 1. 화살표 그리기 + 저장

### What
- 분석이 끝난 게임에서 **우클릭 드래그**로 보드에 화살표를 그림
  - 기본 = 주황 `#ffaa00`, **Shift** = 초록 `#4caf50`, **Ctrl/Cmd** = 빨강 `#f44336` (react-chessboard 기본색, lichess 관례)
  - 같은 화살표를 같은 색으로 다시 그리면 삭제되고, 다른 색으로 그리면 색이 바뀜
  - 드래그 중에는 미리보기 화살표가 보임
  - 현재 포지션에 화살표가 있으면 "화살표 지우기" 버튼이 나타남
  - 보드 아래에 색 범례/조작 안내 표시
- 화살표는 **포지션별로** 저장됨
  - 메인라인: `annotations.moveArrows["{moveIndex}"]` (-1 = 시작 포지션)
  - 저장된 변형선: `variations[i].moveArrows["{변형선 내 index}"]`
  - 아직 저장 안 한 변형선: 임시로 들고 있다가 "변형선 저장" 시 함께 저장되고, 변형선을 나가면 버려짐
- 메모와 같은 저장 흐름: 화살표를 바꾸면 `annotationsDirty` → 저장 버튼 / Ctrl+S

### Why
- react-chessboard 내장 화살표 기능은 화살표를 내부 state에만 들고 있고, 포지션이 바뀌면 `onArrowsChange([])`로 비워버림
  → 저장된 화살표와 동기화하기 어려움.
  그래서 `allowDrawingArrows: false`로 내장 기능을 끄고, `onSquareMouseDown`/`onSquareMouseUp`(우클릭)으로 직접 처리한 뒤 `arrows` prop으로 그림
- DB는 `games.annotations` JSONB에 필드만 추가했으므로 **마이그레이션 없음**.
  도메인 필드에 기본값(`emptyMap()`)이 있어 예전에 저장된 데이터도 그대로 읽힘 (테스트로 확인)
- 화살표 색은 프론트에서 그대로 CSS로 쓰므로, 백엔드 도메인(`BoardArrow`)에서 칸(`a1`~`h8`)과 `#RRGGBB` 형식을 검증 (잘못된 값이면 400)
- 빈 화살표 목록은 키 자체를 저장하지 않음

## 2. 엔진 최선수 화살표 (설정)

### What
- 헤더에 **설정** 메뉴 추가 → `/settings` 페이지
- "엔진 최선수 화살표" 토글 (**기본: 끔**). 켜면 Stockfish 최선수(`pv`의 첫 수)가 **파란 화살표**(`#3b82f6`)로 표시됨
- 설정은 `useSettingsStore`(zustand `persist`)로 localStorage(`chessriend-settings`)에 저장

### Why
- 브라우저별 화면 취향이라 서버에 저장할 필요가 없어서 localStorage 사용
- 백엔드 분석 결과에는 최선수가 저장되지 않음. 그래서 설정이 켜져 있으면 이미 분석된 메인라인 포지션도 라이브 Stockfish를 돌림 (꺼져 있으면 기존처럼 캐시 사용)
- 포지션이 바뀐 직후에는 이전 포지션의 최선수가 잠깐 남아 있을 수 있음 → chess.js로 현재 포지션에서 둘 수 있는 수인지 확인하고, 아니면 그리지 않음

## 3. 상세 화면 레이아웃

### What
- **분석 결과 요약**(`AnalysisSummary`): 오른쪽 열에서 상단 대국 정보 카드의 "alice vs bob" 오른편으로 이동 (모바일에서는 아래로 쌓임)
- **메모 패널**(`CommentPanel`): 수 목록 하단에서 분석 결과가 있던 자리(수 목록 위)로 이동해 독립 카드가 됨
- `MoveList`는 더 이상 메모 패널을 포함하지 않음 (props 제거)

## 4. 저장된 메모 글자색

### What
- 저장된 메모 텍스트: 다크 모드 `gray-500` → **white**, 라이트 모드 `gray-900`. 빈 상태 안내("메모 추가...")는 기존처럼 흐리게 유지
- 줄바꿈 유지(`whitespace-pre-wrap`)
- `CommentPanel`의 `useEffect` 안 setState(lint 오류)를 제거: 편집 상태를 포지션 키와 묶어서, 수가 바뀌면 자동으로 편집이 종료됨

## Key files

**Backend**
- `game/domain/Annotation.kt` — `BoardArrow` 값 객체, `GameAnnotation.moveArrows`, `Variation.moveArrows`
- `game/adapter/in/web/GameResponse.kt` — `BoardArrowDto`, 요청/응답 매핑
- 테스트: `domain/BoardArrowTest.kt`, `adapter/in/web/AnnotationDtoTest.kt`

**Frontend**
- `features/game/stores/boardStore.ts` — `moveArrows`, `draftVariationArrows`, `toggleArrow`, `clearCurrentArrows`, `selectCurrentArrows`
- `features/game/utils/arrows.ts` — 색 상수, `arrowColorFor`, `bestMoveArrow`
- `features/game/components/GameBoard.tsx` — 우클릭 드래그, 화살표 렌더링, 범례
- `features/game/hooks/useStockfish.ts` — `EvalResult.bestMove`
- `features/game/components/GameViewer.tsx`, `GameDetailPage.tsx`, `MoveList.tsx`, `CommentPanel.tsx` — 레이아웃
- `features/settings/` — `settingsStore.ts`, `SettingsPage.tsx`
- `app/router.tsx`, `app/Layout.tsx` — `/settings` 라우트, 메뉴
- 테스트: `boardStore.test.ts`(화살표 9개 추가), `arrows.test.ts`, `SettingsPage.test.tsx`

## 5. 저장 전 변형선에서도 메모 작성

### What
- 보드에서 수를 둬서 새로 만든(아직 저장 안 한) 변형선에서도 메모 패널이 표시됨
  - 라벨: `새 변형선 · {수}`. indigo 색이고, "메모를 저장하면 변형선도 함께 저장됩니다" 안내 표시
  - 메모를 저장하면 **변형선을 먼저 저장한 뒤 메모를 기록**하고 서버에 저장(onPersist)
  - 빈 메모로 저장하면 변형선을 저장하지 않음
- `saveCurrentVariation` 동작 변경: 저장 후 방금 저장한 변형선 안에 머무름(`activeVariationIndex` = 새 인덱스)
  - 이후 메모·화살표는 이 저장된 변형선에 기록됨
  - 기존 버그 수정: 저장 후에도 `activeVariationIndex`가 -1로 남아 "저장" 버튼이 계속 보이고, 같은 변형선이 중복 저장될 수 있었음

### Why
- 메모를 남긴다는 건 그 변형선을 남기고 싶다는 뜻 → 저장 단계를 하나로 합침 (사용자 선택)
- 저장 전 메모를 임시로 들고 있는 방식은 변형선을 나가면 메모가 날아가서 채택하지 않음

### Key files
- `features/game/stores/boardStore.ts` — `saveCurrentVariation`
- `features/game/components/CommentPanel.tsx` — 저장 전 변형선 분기, 색 테마
- 테스트: `CommentPanel.test.tsx` (저장 전 변형선 3개, 기존 "변형선 모드 미표시" 테스트 대체), `boardStore.test.ts` (중복 저장 방지)

## 6. 변형선 수 번호 표시

### What
- 변형선의 각 수 앞에 수 번호를 표시: 백 `2.Nf3`, 흑 `2...Bc5`
  - 적용 위치: 현재 변형선(인라인), 저장된 변형선 줄, 메모 패널 라벨(`변형선 · 2...Nc6`)
- 버튼(칩)마다 수가 따로 나뉘어 있어서, 흑 수에도 매번 `N...`을 붙여 칩 하나만 봐도 몇 번째 수인지 알 수 있게 함

### Why / 계산
- 변형선은 메인라인 `startMoveIndex` 수 이후 포지션에서 시작 → j번째 수의 ply = `startMoveIndex + 1 + j`
- 수 번호 = `⌊ply / 2⌋ + 1`, ply가 짝수면 백(`.`), 홀수면 흑(`...`)

### Key files
- `features/game/utils/moveNumber.ts` — `formatNumberedMove`, `variationMovePly` (+ 테스트 5개)
- `features/game/components/MoveList.tsx`, `CommentPanel.tsx`
