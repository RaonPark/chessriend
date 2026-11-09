# 흥미로운 수(!?) 수동 표시

## What
사용자가 메인라인 수와 **변형선 수**에 직접 `!?`(흥미로운 수)를 붙이고 뗄 수 있다.
엔진 자동 분류(`!!`, `!`, `??`, `?`, `?!`)와 달리 사람이 판단해 붙이는 표시다.

## Why
- "흥미롭지만 확실하지 않은 수"는 엔진 수치로 정하기 어렵다. 사용자가 직접 붙여야 의미가 있다.
- 주된 용도는 **변형선에서 메인라인과 다른 흥미로운 수를 소개하는 것**이다. 그래서 변형선도 지원한다.
  메인라인도 같은 방식으로 붙일 수 있다.

## 설계 결정
| 항목 | 결정 | 이유 |
|---|---|---|
| 저장 위치 | `annotations` JSONB 안 `interestingMoves: number[]` (메인라인), `variations[i].interestingMoves` (변형선) | 메모·화살표와 같은 생명주기. 필드 기본값 `[]` → **마이그레이션 불필요**, 기존 데이터 그대로 읽힘 |
| 붙일 수 있는 때 | 분석 완료 후, "수"가 선택됐을 때만 (시작·분기 포지션 제외) | 메모·화살표와 같은 규칙 |
| 저장 전 변형선 | 표시하면 변형선을 **먼저 저장**한 뒤 기록 | 메모 저장 규칙과 동일 ("메모를 저장하면 변형선도 함께 저장") |
| 저장 시점 | 토글 즉시 서버 저장 (`onPersist`) | 메모 저장 버튼과 같은 경험 |
| 엔진 분류와 겹칠 때 | 기호는 **둘 다** 표시 (`Qh3??!?`), 배경은 엔진 분류 우선 | 실수 표시가 가려지지 않게 |
| 대국자 바 집계 | 넣지 않음 | 엔진 분석 요약이라 사용자 표시와 섞지 않음 |
| 색 | **fuchsia** (`text-fuchsia-600` / `dark:text-fuchsia-400`, 배경 `bg-fuchsia-100` / `dark:bg-fuchsia-900/30`) | 엔진 기호 색(cyan·sky·red·orange·yellow), 앱 테마(amber), 변형선(indigo·emerald) 어느 것과도 겹치지 않음. lichess의 `!?` 색(분홍·자홍 계열)과도 비슷해 체스 사용자에게 익숙함 |

## 백엔드
- `domain/Annotation.kt`
  - `GameAnnotation.interestingMoves: List<Int>` — 음수 인덱스 거부
  - `Variation.interestingMoves: List<Int>` — 변형선 수 범위(`moves.indices`) 밖이면 거부
- `adapter/in/web/GameResponse.kt`
  - `AnnotationRequest`/`VariationRequest` → 도메인 변환 시 **중복 제거 + 정렬**
  - `AnnotationResponse`/`VariationResponse`에 `interestingMoves` 추가
  - (훅 컨벤션 위반으로 막혀 있던) 기존 `!!` 3곳을 `requireNotNull`로 교체
- 테스트: `AnnotationDtoTest` — 매핑 왕복, 정렬·중복 제거, 음수/범위 밖 거부, 필드 없는 기존 JSON 호환, JSON 왕복

## 프론트엔드
### `stores/boardStore.ts`
- 상태 `interestingMoves: number[]` (메인라인). 변형선 표시는 `savedVariations[i].interestingMoves`
- `toggleInterestingMove()` — 현재 수의 표시를 켜고 끈다.
  저장 안 된 변형선이면 `saveCurrentVariation()`을 먼저 호출해 `activeVariationIndex`가 생긴 뒤 기록한다
- 선택자
  - `selectCanMarkInteresting` — 분석 완료 + 수가 선택된 상태
  - `selectIsCurrentInteresting` — 현재 수가 표시되어 있는지
- `loadAnnotations`/`loadMoves`/`getAnnotationsSnapshot`에 반영.
  스냅샷은 변형선 길이 밖 인덱스(이어 두고 저장 안 한 수)를 제외한다

### `utils/moveSymbols.ts`
- `INTERESTING_MARK` — `{ symbol: '!?', label: '흥미로운 수', className, bgClassName }`.
  엔진 분류(`MOVE_SYMBOLS`)와 성격이 달라 분리했다

### `components/CommentPanel.tsx` — 토글 버튼
- 메모 패널 머리글 오른쪽의 알약 모양 버튼 `!? 흥미로운 수`
- 꺼짐: 점선 테두리 fuchsia 글자 / 켜짐: fuchsia 채움 + 흰 글자 (`aria-pressed`로 상태 노출)
- 저장 중(`isPersisting`)에는 비활성화

### `components/MoveList.tsx` — 표시
- 메인라인 칸: 엔진 기호 뒤에 `!?`. 엔진 분류가 없으면 fuchsia 배경
- 보고 있는 변형선(인디고 박스)과 저장된 변형선 줄(에메랄드): 수 뒤에 `!?`.
  저장된 변형선 수 버튼의 `aria-label`에 "(흥미로운 수)"를 덧붙인다

### 테스트
- `boardStore.test.ts` — 메인라인 토글/해제, 시작 포지션·분석 전 불가,
  저장된 변형선에 기록, 저장 전 변형선 자동 저장 후 기록, 불러오기·스냅샷, 초기화
- `CommentPanel.test.tsx` — 토글 시 표시 + `onPersist` 호출, 저장 중 비활성화
- `MoveList.test.tsx` — 메인라인·저장된 변형선에 `!?` 표시

## 검증
- 백엔드 `./gradlew test` 통과 (`AnnotationDtoTest` 13건)
- 프론트 `pnpm test` 303건 통과, `pnpm build`(tsc) 통과, `pnpm lint` 통과
- 브라우저(Playwright)
  - 브랜치 백엔드를 8091, 프론트를 5174에 따로 띄워 확인
  - 경기 338827999937822720에서 메인라인 `4.Bd3`와 저장된 변형선 `14.dxe5`에 표시
  - 서버 응답에 반영된 것 확인, 새로고침 후에도 유지, 라이트·다크 모드 모두 확인
  - 확인 후 표시를 원래대로 되돌림
  - 스크린샷: `docs/test-screenshots/interesting-move-{light,dark,mainline}.png` (gitignore 대상)

## 미구현 / 후속
- 저장된 변형선 **중간**에서 다른 수로 분기하면 새 변형선에는 `!?`가 따라가지 않는다 (메모와 같은 동작. 화살표만 따라감)
- 키보드 단축키 없음
- 목록 화면 요약에는 `!?` 개수를 보여 주지 않는다
