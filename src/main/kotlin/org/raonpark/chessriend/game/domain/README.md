# game.domain

## 역할

헥사고날 아키텍처의 **가장 안쪽 계층**. 체스 게임의 엔티티·값객체와 순수 분석 로직만 담는다.
**외부 의존성 zero** — Spring·jOOQ·R2DBC·chesslib 등을 절대 import하지 않는다(`domain-deps-check.sh` 훅이 강제). 상태 변경은 `data class` + `copy()`(불변).

## 주요 구성요소

| 파일 | 역할 |
| --- | --- |
| `Game.kt` | 핵심 애그리게이트(엔티티). `id`, 소스, 플레이어, `moves`, 결과, 시간통제, 오프닝, PGN, `annotations`. `totalMoves`/`lastPosition` 계산 프로퍼티, `movesBy/moveAt` 헬퍼 |
| `Move.kt` | 단일 수: `number`, `color`, `san`, `fen`, `timeSpent?`, `comment?` |
| `Player.kt` | `Player`(이름·레이팅) + `Players`(백/흑 쌍, `byColor()`) |
| `Color.kt` | enum `WHITE`/`BLACK` + `opposite()` |
| `GameResult.kt` | enum `WHITE_WIN`/`BLACK_WIN`/`DRAW` + PGN 결과 문자열 변환 |
| `TimeControl.kt` | `TimeControl`(초기시간·증분·카테고리, `fromString()`) + enum `TimeCategory`(ULTRABULLET…CORRESPONDENCE) |
| `Opening.kt` | ECO 코드 + 이름 |
| `GameSource.kt` | enum `LICHESS`/`CHESS_COM`/`PGN` |
| `Annotation.kt` | `GameAnnotation`(수 코멘트 맵 + 변형선), `Variation`, 분석 값객체(`GameAnalysisData`, `MoveEvaluationData`, `EvalScore`) |
| `ParsedPgn.kt` | PGN 파싱 중간 결과(태그·수·코멘트·변형선·SetUp 여부). `ChessRules.parsePgn`의 반환 타입 |
| `analysis/GameAnalyzer.kt` | **object(순수 함수)**. 포지션 평가 배열 + 수 목록 → 수별 분류 계산. 프론트 `computeClassifications`와 1:1 |
| `analysis/MoveClassifier.kt` | **object(순수 함수)**. 기대 승률(Win%) 손실 기반 Blunder/Mistake/Inaccuracy 분류 + Brilliant(희생) 판정. lichess 승률 계수·Brilliant 임계값(2.0%p) |
| `analysis/AnalysisProgress.kt` | `sealed interface`: `Progress(current, total)` / `Completed(analysis)`. SSE 스트림 이벤트 |
| `analysis/PieceKind.kt` | enum(PAWN…KING). 분석 로직과 chesslib 결합도 분리용 |

## 주요 흐름

1. 어댑터/애플리케이션이 외부 데이터를 `Game`·`Move` 등 도메인 객체로 변환해 들고 들어온다.
2. 분석 시 `GameAnalyzer`/`MoveClassifier`가 (평가 배열, 수, 희생 컨텍스트)를 받아 순수 계산으로 분류를 산출한다.
3. 도메인은 I/O를 모른다 — 저장·조회·엔진 호출은 전부 포트 너머의 책임.

## 데이터 접근

- 없음. 영속성/직렬화는 어댑터 계층(`adapter/out/persistence`)이 담당한다.

## 예외 처리

- 입력 불변식 위반은 `IllegalArgumentException`(또는 `shared/exception`의 커스텀 예외)으로 표현. 도메인 안에서 HTTP·프레임워크 타입을 다루지 않는다.

## 변경 시 주의사항

- **순수성 유지**: 외부 라이브러리 import 금지. 체스 규칙이 필요하면 도메인이 아니라 `port/out/ChessRules`를 통해 어댑터에 위임.
- **분석 로직 동기화**: `GameAnalyzer`/`MoveClassifier`는 프론트 `utils/classification.ts`와 동일 알고리즘이어야 한다(승률 계수·임계값·기물 가치). 한쪽만 바꾸면 분류가 어긋난다.
- **불변 유지**: 새 필드는 `val` + `copy()`. 가변 컬렉션 노출 금지.
