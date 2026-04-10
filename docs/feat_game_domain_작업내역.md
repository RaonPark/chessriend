# feat/game_domain — Game 도메인 구현

## 2026-04-10: Game 도메인 엔티티 및 값 객체

### 무엇을
- lichess/chess.com 게임 가져오기를 위한 `game/domain/` 엔티티 및 값 객체 구현

### 왜
- Rich Domain 전략: Move를 도메인에 포함하여 수 단위 분석/리뷰 메모 기능의 기반 마련
- 통합 모델 전략: 플랫폼(lichess, chess.com)에 종속되지 않는 "체스 보편 언어"로 모델링하여 Hexagonal 원칙 준수

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/domain/Game.kt` | 메인 엔티티 — players, moves, result, timeControl, opening, pgn 등 |
| `game/domain/Move.kt` | 값 객체 — number, color, san, fen, timeSpent, comment |
| `game/domain/Player.kt` | Player + Players 값 객체 — 이름, 레이팅 |
| `game/domain/Color.kt` | WHITE, BLACK enum |
| `game/domain/GameResult.kt` | WHITE_WIN, BLACK_WIN, DRAW + PGN 표준 문자열 변환 |
| `game/domain/GameSource.kt` | LICHESS, CHESS_COM enum |
| `game/domain/TimeControl.kt` | initialTime, increment, category — 카테고리는 플랫폼이 제공한 값 사용 |
| `game/domain/Opening.kt` | eco 코드, name |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| Game 범위 | Rich Domain (Move 포함) | Stockfish 평가값, 수 단위 리뷰 메모를 위해 Move가 도메인에 필수 |
| 플랫폼 추상화 | 통합 모델 | 도메인이 lichess/chess.com을 모름. opening, rating 등은 체스 보편 개념이므로 도메인에 포함 가능 |
| TimeCategory 결정 주체 | Adapter (플랫폼 제공값 사용) | lichess API가 speed 필드를 직접 제공하므로 도메인이 직접 계산할 필요 없음 |
| 시간 제어 | 값 객체 (TimeControl) | Bullet/Blitz/Rapid 필터링이 사용자 관점에서 필수 기능 |

## 2026-04-10: Port out 인터페이스 정의

### 무엇을
- 외부 API 호출(`ChessGameClient`)과 DB 저장(`GameRepository`) 인터페이스 정의

### 왜
- Hexagonal Port 레이어: 도메인이 외부 시스템에 의존하지 않도록 인터페이스만 정의
- `GameFetchCriteria` 조건 객체를 도입하여 lichess API의 다양한 필터(since, until, max, perfType, rated, color, vs)를 수용

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/port/out/ChessGameClient.kt` | 외부 API 인터페이스 + `GameFetchCriteria` 조건 객체 |
| `game/port/out/GameRepository.kt` | DB 저장 인터페이스 — `save`, `existsBySourceGameId` |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| Client 파라미터 | 조건 객체 (`GameFetchCriteria`) | lichess API 필터가 다양하고, 필터 추가 시 인터페이스 변경 없이 확장 가능 |
| Criteria 필터 범위 | 사용자 조회 조건만 포함 | 응답 형식 제어(moves, clocks, opening 등)는 Adapter 내부 설정으로 분리 |
| Repository 범위 | import 필요 최소한 (save + 중복 체크) | 조회 메서드는 필요할 때 추가 |
| Repository 반환 타입 | suspend fun (코루틴) | R2DBC 리액티브 스택 + 코루틴 우선 컨벤션 |

## 2026-04-10: Port in 인터페이스 정의

### 무엇을
- 게임 가져오기 유스케이스 인터페이스(`ImportGameUseCase`) 정의

### 왜
- Hexagonal inbound port: Controller가 의존할 유스케이스 계약 정의
- `Flow<Game>` 반환으로 lichess NDJSON 스트리밍과 자연스럽게 매칭

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/port/in/ImportGameUseCase.kt` | `fun import(source, criteria): Flow<Game>` |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| 반환 타입 | `Flow<Game>` (스트리밍) | 수백 게임을 메모리에 한번에 올리지 않고 하나씩 처리. 프론트 실시간 진행 표시 가능 |
| source 지정 | 파라미터 (`GameSource`) | 가져오기 흐름은 플랫폼 무관하게 동일. 차이는 ChessGameClient Adapter가 흡수 |
| 중복 처리 | skip | 과거 기보 데이터는 불변. skip이 단순하고 안전 |
