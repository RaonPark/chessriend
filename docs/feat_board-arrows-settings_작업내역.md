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

## 7. 분석 결과에 cp loss (평균 centipawn loss) 추가

### What
- 분석 결과 요약 표 아래에 `cp loss` 행 추가: 백/흑 각각의 **평균** centipawn loss (ACPL, 반올림)
- `?` 버튼에 호버하거나 키보드로 포커스하면 설명 툴팁 표시 (네이티브 `title` 대신 커스텀 툴팁, `role="tooltip"` + `aria-describedby`)
- 해당 색의 평가가 없으면 `-`

### Why
- lichess / chess.com과 같은 지표라서 익숙함. 총합은 게임 길이에 따라 달라지므로 평균을 씀
- 백엔드에 저장된 `cpLoss`는 메이트를 ±10000cp(`MATE_SCORE`)로 환산한 값
  → 메이트 하나만 놓쳐도 평균이 수백으로 튐.
  그래서 lichess ACPL처럼 평가를 **±1000cp로 제한**해 `evalBefore`/`evalAfter`로부터 프론트에서 다시 계산
  (`utils/cpLoss.ts`). 수 분류(Blunder 등)는 기존대로 백엔드의 Win% 기준이라 영향 없음

### Key files
- `features/game/utils/cpLoss.ts` — `moveCpLoss` (+ 테스트 6개)
- `features/game/components/AnalysisSummary.tsx` — cp loss 행, `CpLossHelp` 툴팁
- 테스트: `components/__tests__/AnalysisSummary.test.tsx` (5개)

## 8. fix: 저장된 변형선을 이어서 두면 저장 버튼이 안 뜨던 문제

### What
- 저장된 변형선 **끝에서 이어서** 수를 두면 "저장" 버튼이 표시되고, 누르면 **같은 변형선이 갱신**됨 (기존 메모·화살표 유지)
  - 이어 둔 수에 메모를 저장해도 변형선이 함께 갱신됨 (5번 결정과 같은 규칙)
- 저장된 변형선 **중간에서 다른 수**를 두면 원본은 그대로 두고 **새(미저장) 변형선으로 분기**. 분기 지점까지의 화살표는 복사됨
- 변형선의 **다음 수와 같은 수**를 두면 새로 만들지 않고 한 수 앞으로 이동
- 저장 안 한(이어 둔) 수에 달린 메모·화살표는 서버로 보내는 스냅샷에서 제외

### Why
- 원인: "저장" 버튼 조건이 `activeVariationIndex < 0`(새 변형선)뿐이었음.
  여기에 7c92333의 중복 저장 방지(저장된 변형선 안에서는 저장 무시)까지 겹쳐서, 이어 둔 수를 저장할 방법이 없었음
- 버튼 표시 기준을 `selectHasUnsavedVariationMoves`(새 변형선이거나, 저장된 것보다 수가 많음) 하나로 통일
- 중간 분기를 덮어쓰기로 처리하면 원본 뒷부분 수와 메모가 사라지므로, 파괴적이지 않은 새 변형선 분기를 선택

### Key files
- `features/game/stores/boardStore.ts` — `selectHasUnsavedVariationMoves`, `makeMove`, `saveCurrentVariation`, `getAnnotationsSnapshot`
- `features/game/components/MoveList.tsx`, `CommentPanel.tsx`
- 테스트: `boardStore.test.ts` (6개), `CommentPanel.test.tsx` (1개)

## 9. 기본 글꼴 Pretendard 적용

### What
- `index.html`에서 Pretendard Variable(dynamic subset, jsdelivr `v1.3.9` 고정)을 로드
- `index.css`의 Tailwind `@theme`에서 `--font-sans`를 Pretendard로 지정. 로드 전이나 실패 시에는 시스템 글꼴로 대체
- 분석 요약 숫자의 `font-mono` 제거 → Pretendard + `tabular-nums`(고정폭 숫자)로 정렬 유지
- PGN 붙여넣기 textarea(`PgnImportForm`)는 코드 성격의 입력이라 `font-mono` 유지

### Why
- npm `pretendard` 패키지는 `pnpm add` 시 `invalid array length` OOM으로 설치 실패 (패키지가 모든 폰트 포맷을 포함해 매우 큼)
  → 공식 문서에서 권장하는 CDN dynamic subset으로 대체 (페이지에서 쓰는 글자만 내려받음)

## 10. 게임 상세 레이아웃 개편 — C안 (대국자 바, lichess 스타일)

### What
- 피그마 시안 3개(A 슬림 헤더 바 / B 보드 우선 2단 / C 대국자 바) 중 **C안** 채택
  - 시안: https://www.figma.com/design/2l64N2RGEDFCWoxP1J6B70
- 상단의 큰 대국 정보 카드 제거 → 1280×1000 화면에서 보드·컨트롤이 첫 화면에 다 보임 (보드 top 476px → 약 175px)
- **대국자 바** (`PlayerBar`): 보드 위·아래에 배치, 보드 방향을 따라감 (흑 소유자면 흑이 아래)
  - 이름 · 레이팅 · 결과 배지 · (분석 후) Blunder / Mistake / cp loss(+ 설명 툴팁)
  - 결과 배지(`getPlayerBadge`): 소유자 쪽에만 소유자 관점 승리/패배/무승부.
    소유자가 없는 게임은 이긴 쪽에 "승리", 무승부면 양쪽 모두 "무승부"
- **오른쪽 열 탭**: `기보·메모`(메모 + 수 목록) | `경기 정보`(`GameInfoPanel`: 플랫폼·시간·오프닝·총 수·날짜 + 전체 분석 표 + 게임 삭제)
  - Stockfish 상태 줄, 저장 버튼, 분석 진행률은 탭 위에 있어서 어느 탭에서나 보임
- 이동 컨트롤(`BoardControls`)을 아래쪽 대국자 바 밑으로 이동
- 수가 없는 게임은 보드 없이 대국자 바 + 경기 정보만 표시
- fix: 엔진 최선수·그리는 중 화살표가 저장된 화살표와 같은 칸이면 react-chessboard key가 충돌하던 문제
  → `dedupeArrows`로 하나만 남김 (그리는 중 > 저장 > 엔진)

### Why
- 체스 앱(lichess / chess.com) 사용자에게 가장 익숙한 배치이고,
  "누가 몇 번 실수했나"가 보드 바로 옆에 보임
- 백/흑별 분류 개수·평균 cp loss 계산을 `summarizeAnalysis`로 분리 → `AnalysisSummary` 표와 대국자 바가 같은 계산을 공유

### Key files
- `features/game/components/PlayerBar.tsx`, `GameInfoPanel.tsx` (신규)
- `features/game/components/GameViewer.tsx` — `game` 전체를 props로 받고, 대국자 바 + 탭 레이아웃
- `features/game/components/GameDetailPage.tsx` — 뒤로가기 링크 + 뷰어 (또는 수 없는 게임 대체 화면)
- `features/game/components/AnalysisSummary.tsx` — `summarizeAnalysis` 사용, `CpLossHelp` export
- `features/game/utils/analysisStats.ts`, `outcome.ts`(`getPlayerBadge`), `arrows.ts`(`dedupeArrows`)
- 테스트: `PlayerBar.test.tsx`, `analysisStats.test.ts`, `outcome.test.ts`(+4), `arrows.test.ts`(+2)

## 11. 설정을 다이얼로그로 변경 (복기 중에도 사용)

### What
- 헤더의 "설정"이 `/settings` 페이지 링크에서 **다이얼로그를 여는 버튼**으로 바뀜 (`SettingsDialog`)
  - 페이지 이동이 없어서 복기 중인 수·변형선·보드 상태가 그대로 유지됨
  - 토글은 즉시 적용·저장 (localStorage). ✕ / Esc / 바깥 클릭으로 닫힘
  - `/settings` 라우트와 `SettingsPage` 제거
- fix: `BoardControls`의 전역 키보드 단축키가 다이얼로그 안에서 누른 키까지 처리하던 문제
  - 변형선 안에서 다이얼로그(설정·삭제 확인)를 열고 Esc를 누르면, 다이얼로그는 안 닫히고 **변형선이 닫혔음**
  - 방향키를 누르면 다이얼로그 뒤에서 수가 넘어갔음
  - → 이벤트가 `<dialog>` 안에서 왔으면 보드 단축키를 무시

### Key files
- `features/settings/components/SettingsDialog.tsx` (SettingsPage에서 전환)
- `app/Layout.tsx`, `app/router.tsx`
- `features/game/components/BoardControls.tsx`
- 테스트: `settings/components/__tests__/SettingsDialog.test.tsx`(3개), `game/components/__tests__/BoardControls.test.tsx`(3개)

## 12. fix: 상태 줄 버튼 글자가 2줄로 깨지던 문제

### What
- 오른쪽 열 상태 줄(Stockfish · depth / 게임 분석 / 화살표 지우기 / 분석 모드 / 저장)에 버튼이 여러 개 뜨면 글자가 2줄로 접히던 문제 수정
  - 각 항목에 `whitespace-nowrap`
  - 줄 전체는 `flex-wrap` → 공간이 모자라면 글자를 접지 않고 버튼 묶음이 다음 줄로 넘어감
- 확인: 1280px에서는 버튼 묶음이 다음 줄로 정렬되고, 1024px에서는 한 줄로 들어감 ("화살표 지우기" 높이 42px → 26px)

### Key files
- `features/game/components/GameViewer.tsx`

## 13. 변형선 우클릭 → 삭제

### What
- 수 목록의 **저장된 변형선 줄**을 우클릭 → 메뉴 "변형선 보기 / 변형선 삭제"
- **보고 있는 변형선 박스**를 우클릭 → "변형선 삭제"
  - 저장된 변형선이면 목록에서 제거, 저장 전 변형선이면 버림 → 분기 지점(메인라인)으로 복귀 (`deleteCurrentVariation`)
- 삭제는 메모와 같은 흐름: `annotationsDirty` → 저장 버튼 / Ctrl+S로 서버에 반영
- 공용 `ContextMenu` 컴포넌트 추가 (`shared/components`, 브라우저 기본 메뉴 대신)
  - Esc · 바깥 클릭 · 스크롤 · 리사이즈 시 닫힘, ↑↓로 항목 이동, 화면 밖으로 넘치지 않게 위치 보정
  - 키 입력을 capture 단계에서 먼저 받아 막아서, 메뉴가 열린 동안 보드 단축키(Esc = 변형선 나가기, 방향키 = 수 이동)가 같이 동작하지 않음

### Why
- 우클릭 즉시 삭제는 실수로 변형선과 메모를 잃기 쉬워서, 메뉴를 한 번 거치도록 함

### Key files
- `shared/components/ContextMenu.tsx` (신규)
- `features/game/components/MoveList.tsx`, `features/game/stores/boardStore.ts`
- 테스트: `ContextMenu.test.tsx`(3개), `MoveList.test.tsx`(3개), `boardStore.test.ts`(+2)

## 14. fix: 변형선을 누르면 한 번 떴다가 바뀌던 문제

### 원인
- `enterSavedVariation`이 변형선의 **분기 포지션**(`variationIndex: -1`)으로 진입했음
  - 보드는 첫 수를 두기 전 상태로 남아 있음
  - 메모 패널은 -1에서 아무것도 표시하지 않아 카드가 사라지고, 수 목록이 위로 튐
  - 사용자가 첫 수를 다시 눌러야 그제서야 보드·메모·화살표가 바뀜 → "떴다가 바뀌는" 느낌
- 저장된 변형선 줄 전체가 버튼 하나라서, `2.exd5`를 눌러도 분기 포지션으로 진입했음

### What
- `enterSavedVariation(variation, index, moveIndex = 0)`: 분기 포지션 대신 **첫 수(또는 지정한 수)로 바로 진입** (범위 밖은 마지막 수로 보정)
- 저장된 변형선 줄을 **수마다 버튼**으로 → 누른 수로 바로 진입 (메모가 있으면 aria-label에 "메모 있음")
- 테스트 환경: jsdom에 없는 `scrollIntoView` 스텁 추가 (`src/test/setup.ts`)

### Key files
- `features/game/stores/boardStore.ts`, `features/game/components/MoveList.tsx`, `src/test/setup.ts`
- 테스트: `boardStore.test.ts`(+3), `MoveList.test.tsx`(+1)
