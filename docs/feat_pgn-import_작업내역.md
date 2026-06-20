# PGN 붙여넣기로 게임 생성

## What

사용자가 PGN 기보 문자열을 붙여넣어 게임을 생성·리뷰하는 기능. 이전에 만들던 **FEN 입력 기능을 걷어내고 PGN으로 교체**했다.

- `POST /api/games/from-pgn` 엔드포인트
- chesslib로 PGN 파싱: 메인라인 수순 + 코멘트 + 1단계 변형선 + 태그(플레이어/Elo/결과/시간/오프닝)
- 프론트 `/import`에 "PGN으로 가져오기" 탭 + 입력 폼
- 생성된 게임은 수순을 가지므로 기존 보드/뷰어/분석/메모가 그대로 동작

## Why (전환 배경)

FEN은 보드 한 장의 스냅샷이라 0수(moves=[]) 게임이 되어 수순 리뷰·분석·메모가 동작하지 않았다.
"내 게임을 붙여넣어 리뷰"하려면 수순을 담는 **PGN**이 맞고, 앱의 import가 이미 SAN→Game 변환 기계를 갖고 있어 재사용이 자연스럽다.

## 확정 결정 (사용자 + 코드 검증)

- 출처: `GameSource.FEN` 제거 → **`GameSource.PGN`** 추가.
- 파싱 범위: **메인라인 + 코멘트 + 1단계 변형선**. 중첩 변형선은 v1 생략.
  - chesslib 1.3.6 `Game.loadMoveText()`가 comments/variations(중첩 포함)/nag를 채움을 스파이크로 검증.
  - 그러나 우리 `Variation`은 평탄(`moves: List<String>`), boardStore는 2레벨, MoveList는 단일 레벨 렌더 → 중첩 표시는 ~20–26h·고위험이라 비용/가치 불균형으로 제외.
- 다중 게임 PGN: 첫 게임만(여러 개면 안내). `[SetUp]/[FEN]` 비표준 시작: v1 미지원(안내).
- 소유자 없음: 보드 **백 시점 고정**, 승패 배지 **중립 라벨**(백 승/흑 승/무승부).

## chesslib 인덱스 컨벤션 (스파이크로 실측)

- 코멘트/변형선 맵 key는 **전역 ply 카운터**(변형선 수도 셈). 단순 `K-1` 매핑은 틀림.
  → 메인라인 emit 후 `variationsByKey[counter]`를 재귀 소비하는 **DFS 카운터 재구성**으로 각 메인라인 수의 전역 카운터를 복원하여 코멘트/변형선 분기점을 정확히 매핑.
- 변형선: 최상위 `parent == -1`, 중첩 `parent != -1`. branch key = 대체 수의 전역 카운터 → `startMoveIndex = (메인라인 인덱스) - 1`.
- 코멘트의 `[%clk ...]`/`[%eval ...]` 엔진 주석은 제거, 빈 코멘트는 누락.
- TimeControl 태그는 `game.property`가 null이라 PGN에서 정규식으로 직접 추출.

## 변경 파일

### 제거 (FEN 롤백)
`domain/FenPosition.kt`, `port/in/CreateGameFromFenUseCase.kt`, `application/CreateGameFromFenService.kt`,
`adapter/in/web`의 from-fen 엔드포인트/DTO, `components/FenCreateForm.tsx`, 관련 테스트/타입/탭, `docs/sql/proposed_add_initial_fen.sql`.

### 백엔드 (신규/수정)
| 파일 | 내용 |
|---|---|
| `domain/GameSource.kt` | `FEN` → `PGN` |
| `domain/ParsedPgn.kt` (신규) | PGN 파싱 결과 도메인 값 객체 |
| `port/out/ChessRules.kt` | `parsePgn(pgn): ParsedPgn` 추가 |
| `adapter/out/chess/ChesslibAdapter.kt` | `parsePgn` 구현(chesslib `GameLoader`/`loadMoveText`, DFS 카운터 재구성, 1단계 변형선) |
| `port/in/CreateGameFromPgnUseCase.kt` (신규) | UseCase + Command |
| `application/CreateGameFromPgnService.kt` (신규) | 태그→Game 매핑, 결과/시간/오프닝/날짜, multi/setup 거부 |
| `adapter/in/web/GameController.kt` + `GameResponse.kt` | `POST /from-pgn` + `CreateGameFromPgnRequest` |

### 프론트 (신규/수정)
| 파일 | 내용 |
|---|---|
| `types/game.ts` | `GameSource` PGN, `CreateGameFromPgnRequest` |
| `api/gameApi.ts`, `api/mutations.ts` | `createGameFromPgn`, `useCreateGameFromPgn` |
| `components/PgnImportForm.tsx` (신규) | PGN textarea 입력 폼 |
| `components/ImportPage.tsx` | "PGN으로 가져오기" 탭 |
| `components/GameViewer.tsx` | 소유자 없으면 백 시점 고정 |
| `utils/outcome.ts` (신규) + `GameDetailPage`/`GameListItem` | 소유자 없으면 중립 결과 라벨 |

### 유지 (FEN과 무관한 독립 버그 수정)
`GamePersistenceAdapter.findAll`의 rating 박싱 타입 조회(null 레이팅 NPE) + 회귀 테스트.

## 테스트

- 백엔드: `ChesslibAdapterTest`(parsePgn 태그/수/코멘트/1단계 변형선/[SetUp]/빈 PGN), `CreateGameFromPgnServiceTest`(매핑/`*`→무승부/setup·multi 거부), `GameControllerTest`(POST 200·400). `./gradlew test` 전체 그린.
- 프론트: `outcome.test.ts`, `PgnImportForm.test.tsx`, `ImportPage` 탭. `pnpm test:run` 156 passed, `tsc -b`/`pnpm build` 그린.

## Playwright 라이브 검증

`/import` → "PGN으로 가져오기" → 코멘트+변형선 포함 PGN 붙여넣기 → 생성:
- 목록/상세: 카스파로프(2800) vs 카르포프(2750), **Italian Game (C50) · 10+5 RAPID · 8수 · 백 승 (1-0)** — 태그·시간·오프닝·중립 배지 모두 정상.
- 상세 보드 **백 시점** 렌더, 수 네비게이션 동작, **e4에 "메모 있음 ✎"**(PGN 코멘트 보존), 메인라인 8수(변형선 제외).
- 잘못된 PGN → "PGN에 수가 없습니다." 에러 표시. 온라인 import 탭 회귀 정상.
- 스크린샷: `docs/test-screenshots/pgn-import.png`.

## 알려진 한계 (v1 밖)

- **중첩 변형선**: 추출은 가능하나 도메인/Store/UI가 평탄 1레벨이라 표시 안 함.
- `[SetUp]/[FEN]` 비표준 시작 PGN, 다중 게임 PGN: 미지원(안내 메시지).
- 가져온 코멘트/변형선은 기존 MoveList/CommentPanel 규칙을 따라 **분석 실행 후** 노출됨(수 목록의 ✎ 표시는 즉시). 분석 전 코멘트 본문 표시는 별도 후속.
- NAG(!,?,!! 등)는 미반영.

## 정리 SQL (수동)

폐기된 `source='FEN'` 잔존 행 삭제용: `docs/sql/cleanup_stale_fen_games.sql` (로컬/개발 DB 한정, 직접 DML 미실행 — 파일로만 제공).
