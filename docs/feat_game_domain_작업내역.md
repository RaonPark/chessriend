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
| `game/port/in/ImportGameUseCase.kt` | `fun importGames(source, criteria): Flow<Game>` |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| 반환 타입 | `Flow<Game>` (스트리밍) | 수백 게임을 메모리에 한번에 올리지 않고 하나씩 처리. 프론트 실시간 진행 표시 가능 |
| source 지정 | 파라미터 (`GameSource`) | 가져오기 흐름은 플랫폼 무관하게 동일. 차이는 ChessGameClient Adapter가 흡수 |
| 중복 처리 | skip | 과거 기보 데이터는 불변. skip이 단순하고 안전 |
| 메서드명 | `importGames` (`import` → 변경) | `import`는 Kotlin 예약어 |

## 2026-04-10: Application 레이어 구현

### 무엇을
- `ImportGameService` — 게임 가져오기 유스케이스 구현 (fetch → 중복체크 → save 스트리밍 파이프라인)

### 왜
- Port in(`ImportGameUseCase`)의 구현체로서, Port out(`ChessGameClient`, `GameRepository`)을 조합하여 비즈니스 흐름 완성
- `List<ChessGameClient>` 주입 + `source` 속성으로 플랫폼별 client 자동 선택

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/application/ImportGameService.kt` | UseCase 구현 — `@Service`, Flow 파이프라인 (fetch → filter 중복 → map save) |
| `game/port/out/ChessGameClient.kt` | `val source: GameSource` 속성 추가 (client 식별용) |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| Client 선택 방식 | `List<ChessGameClient>` + `source` 속성 매칭 | Spring이 모든 구현체를 자동 주입, 새 플랫폼 추가 시 Adapter만 만들면 자동 등록 |
| 비즈니스 흐름 | Flow 파이프라인 (fetch → filter → map) | lichess NDJSON 스트리밍을 끊지 않고 게임 단위로 중복체크 + 저장 처리 |

## 2026-04-10: Adapter out 구현 (Persistence + Client)

### 무엇을
- DB 저장 Adapter (`GamePersistenceAdapter`) + Flyway 마이그레이션
- lichess API 클라이언트 (`LichessClient`) — NDJSON 스트리밍 수신 + 도메인 변환
- Snowflake ID Generator (forder 프로젝트에서 가져와 단일 서버용으로 간소화)
- spring-dotenv 도입 + `.env` 기반 시크릿 관리

### 왜
- **Persistence**: JSONB로 moves 저장하여 테이블 하나로 단순화. Game 로드 시 항상 전체 Move를 함께 가져오므로 별도 테이블 불필요
- **LichessClient**: NDJSON 스트리밍을 WebClient + Reactor → Flow로 변환하여 메모리 효율적 처리
- **Snowflake ID**: UUID 대비 시간 순서 내장, BIGINT로 인덱스 성능 우수
- **spring-dotenv**: IDE에서도 `.env` 자동 읽기, 별도 Run Configuration 불필요

### 변경 파일
| 파일 | 설명 |
|------|------|
| `shared/id/SnowflakeIdGenerator.kt` | Snowflake ID 생성기 (단일 서버용, machineId=0 기본) |
| `shared/config/IdGeneratorConfig.kt` | SnowflakeIdGenerator Spring Bean 등록 |
| `game/adapter/out/persistence/GameEntity.kt` | R2DBC 엔티티 (`@Table("games")`) |
| `game/adapter/out/persistence/R2dbcGameRepository.kt` | `CoroutineCrudRepository` + `CoroutineSortingRepository` |
| `game/adapter/out/persistence/GamePersistenceAdapter.kt` | Port `GameRepository` 구현, 도메인 ↔ Entity 변환, moves JSONB 직렬화 |
| `game/adapter/out/client/LichessConfig.kt` | `@ConfigurationProperties` — baseUrl, token |
| `game/adapter/out/client/LichessClient.kt` | lichess NDJSON API 호출, Game 도메인 변환 |
| `V1__create_games_table.sql` | games 테이블 (BIGINT PK, JSONB moves, unique constraint on source+sourceGameId) |
| `application.yml` | lichess API 설정 추가 |
| `build.gradle.kts` | spring-dotenv 의존성 추가 |
| `.env` / `.env.example` | 환경변수 템플릿 (LICHESS_API_TOKEN) |
| `.gitignore` | `.env` 추가 |
| `game/domain/Game.kt` | `id: String?` → `id: Long?` (Snowflake ID) |

### TODO
- [ ] 백엔드 체스 라이브러리 도입 후 Move.fen 실제 FEN 계산으로 교체
- [ ] lichess API 에러 응답 처리 (rate limit 429, 404 user not found 등)

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| Move 저장 방식 | JSONB 컬럼 | 항상 전체 Move를 함께 로드, 개별 Move SQL 쿼리 불필요 |
| ID 생성 | Snowflake (BIGINT) | 시간순 정렬 내장, B-tree 인덱스 효율, forder 검증 코드 재활용 |
| lichess 인증 | Optional token (`.env`) | 무료 API, 토큰 있으면 rate limit 완화. spring-dotenv로 관리 |
| 중복 방지 | DB unique constraint (source + sourceGameId) | Application 레벨 체크 + DB 레벨 보장 이중 안전장치 |

## 2026-04-10: Adapter in 구현 (Controller)

### 무엇을
- `GameController` — 게임 import REST API 엔드포인트 (SSE 스트리밍)
- `GameResponse` + DTO — 도메인 → API 응답 변환

### 왜
- SSE(`text/event-stream`)로 lichess NDJSON → Flow → 클라이언트까지 end-to-end 스트리밍
- 수백 게임 import 시 전체 완료 대기 없이 게임마다 실시간 응답

### API
```
GET /api/games/import?source=LICHESS&username={username}
  [optional] since, until, max, timeCategory, rated, color, vs
  produces: text/event-stream
  response: Stream<GameResponse>
```

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/adapter/in/web/GameController.kt` | `@RestController`, SSE 스트리밍 엔드포인트 |
| `game/adapter/in/web/GameResponse.kt` | GameResponse, PlayerResponse, TimeControlResponse, OpeningResponse DTO |

### TODO
- [ ] SSE → 프론트엔드 EventSource 연동 시 전환

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| 응답 방식 | SSE (text/event-stream) | end-to-end 스트리밍, 대량 import 시 실시간 진행 표시 가능 |
| GraphQL 사용 | 불필요 | 서버→클라이언트 단방향 스트리밍은 SSE가 적합, WebFlux 네이티브 지원 |
| HTTP method | GET | import는 외부 데이터 조회+저장이지만, 쿼리 파라미터로 조건 전달이 자연스러움 |
