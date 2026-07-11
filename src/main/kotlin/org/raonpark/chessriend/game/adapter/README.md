# game.adapter

## 역할

**가장 바깥 계층**. `port`를 구현하거나(`out/`) 호출하는(`in/`) 어댑터들. 외부 기술(HTTP, R2DBC/jOOQ, Stockfish 프로세스, chesslib)과 도메인을 잇고, 외부 모델 ↔ 도메인 모델 변환을 책임진다.

```
adapter/
├── in/web/         # REST Controller (suspend / Flow SSE) + DTO
└── out/
    ├── persistence/  # R2DBC + jOOQ
    ├── client/       # Lichess / Chess.com API (WebClient)
    ├── engine/       # Stockfish UCI 프로세스 풀
    └── chess/        # chesslib (PGN 파싱·FEN 재구성·희생 판정)
```

## in/web — REST Controller

| 파일 | 내용 |
| --- | --- |
| `GameController.kt` | `/api/games` — 목록/상세/PGN생성/주석/삭제 + `GET /import`(SSE, `text/event-stream`) |
| `GameAnalysisController.kt` | `/api/games/{gameId}/analysis` — 저장/조회 + `GET /run`(SSE: `progress`/`complete`) |
| `GameResponse.kt` | 모든 요청/응답 DTO 모음 (`GameResponse`, `GameDetailResponse`, `PagedGameResponse`, `AnnotationRequest`, `GameAnalysis*`, `CreateGameFromPgnRequest` 등) |

- 컨트롤러는 `suspend fun`으로 DTO를 직접 반환(또는 스트리밍은 `Flow<ServerSentEvent<Any>>`). **`Mono`/`ResponseEntity`/try-catch 금지** — 예외는 `shared`의 `GlobalExceptionHandler`가 매핑.
- 변환 규약: Domain→DTO는 `companion object { fun from() }`, DTO→Domain은 `fun toDomain()`/`toCommand()`.

## out/persistence — R2DBC + jOOQ

| 파일 | 내용 |
| --- | --- |
| `GameEntity.kt` | `@Table("games")` + `Persistable<Long>`. `moves`/`annotations`는 JSONB(`io.r2dbc.postgresql.codec.Json`). `isNewEntity`로 INSERT/UPDATE 구분 |
| `R2dbcGameRepository.kt` | `CoroutineCrudRepository` + 커스텀(`existsBySourceGameId`, `deleteAllByIdIn`) — 단순 CRUD |
| `GamePersistenceAdapter.kt` | 복잡 쿼리: jOOQ DSL로 동적 WHERE/페이지네이션 작성 → `DatabaseClient`로 실행(`bindQuery`). Domain↔Entity·JSONB 직렬화(Jackson) |
| `GameAnalysisPersistenceAdapter.kt` | `game_analyses` UPSERT(`onConflict(GAME_ID).doUpdate()`), 조회/존재/삭제 |

**jOOQ → R2DBC 패턴**(`GamePersistenceAdapter.bindQuery`):
```kotlin
val sql = query.getSQL(ParamType.NAMED)          // jOOQ가 타입세이프하게 SQL 생성
var spec = databaseClient.sql(sql)
query.params.entries.forEachIndexed { i, (_, p) ->
    val v = if (p.value is JSONB) Json.of((p.value as JSONB).data()) else p.value  // JSONB → R2DBC Json
    spec = spec.bind(i, v)
}
```

## out/client — 외부 API (WebClient)

| 파일 | 내용 |
| --- | --- |
| `LichessClient.kt` (+ `LichessConfig`) | `lichess.org` NDJSON 스트림 → `Flow<Game>`. 토큰 있으면 `Authorization: Bearer`. 시계 배열로 `timeSpent` 계산 |
| `ChessComClient.kt` (+ `ChessComConfig`) | `api.chess.com` 월별 아카이브 조회 → 날짜 필터 → 최신순 정렬 → `Flow<Game>`. User-Agent `Chessriend/1.0`, maxInMemorySize 16MB |

- 코루틴 WebClient 확장(`awaitBody`/`bodyToFlow`)만 사용, **`.block()` 금지**.
- API 오류 → `shared`의 외부 API 예외로 변환: `429 → ExternalApiRateLimitException`, `404 → ExternalApiUserNotFoundException`, 그 외 → `ExternalApiException`.

## out/engine — Stockfish UCI

```
StockfishEngineAdapter → StockfishEnginePool → UciStockfishProcess × N → UciParser
```

| 파일 | 내용 |
| --- | --- |
| `ChessEngineProperties.kt` | `@ConfigurationProperties("chess.engine")` — path/depth/threads/hashMb/poolSize/timeout |
| `StockfishEngineAdapter.kt` | `ChessEngine` 구현 — 풀에서 프로세스 빌려 `evaluate` |
| `StockfishEnginePool.kt` | Channel 기반 프로세스 풀. **지연 초기화**(첫 borrow까지 프로세스 안 띄움 → Stockfish 미설치 환경에서도 앱 기동 OK). 죽은 프로세스 자동 교체, `DisposableBean`로 종료 정리 |
| `UciStockfishProcess.kt` | 프로세스 1개 래퍼. `Dispatchers.IO`에서 blocking UCI I/O, 타임아웃 시 `stop` 전송, 취소 시 `destroy` |
| `UciParser.kt` | `info ... score cp|mate` 파싱 + side-to-move → 백 관점 부호 보정(`flipFor`) |

## out/chess — 체스 규칙 (chesslib)

| 파일 | 내용 |
| --- | --- |
| `ChesslibAdapter.kt` | `ChessRules` 구현. `parsePgn`(메인라인 + 1단계 변형선 추출), `reconstructFens`(SAN→FEN, 부분 재생 허용), `analyzeMove`(목적지가 방어 안 됨 + 더 싼 적 기물 공격 → `isAtRisk`로 희생 판정) |

도메인을 chesslib에서 격리하기 위한 유일한 지점 — chesslib 타입은 이 패키지 밖으로 새어나가지 않는다.

## 데이터 접근 요약

- jOOQ 사용: `GamePersistenceAdapter`, `GameAnalysisPersistenceAdapter` (동적 WHERE·페이지네이션·UPSERT).
- R2DBC 사용: `R2dbcGameRepository`(CRUD), `DatabaseClient`(jOOQ 실행). 전부 논블로킹.
- `Dispatchers.IO`는 **엔진 프로세스 I/O에서만** 사용(DB 접근엔 사용하지 않음).

## 변경 시 주의사항

- **JSONB 바인딩**: jOOQ `JSONB`는 R2DBC Postgres 코덱이 직접 인코딩하지 못한다 → 반드시 `Json.of(...)`로 변환(`bindQuery` 참고).
- **rating은 boxed `Int?`로 조회**: `row.get("white_rating", Int::class.javaObjectType)`. primitive로 받으면 NULL 레이팅(익명·FEN 게임)에서 NPE.
- **jOOQ 참조 최신화**: 스키마 변경 후 `flywayMigrate` → `generateJooq`를 돌려야 `GAMES`/`GAME_ANALYSES` 참조가 맞다.
- **목록 조회 비용**: `findAll`은 `SELECT *`라 JSONB `moves`/`annotations`까지 읽는다. 목록에 실제로 불필요하면 필요한 컬럼만 선택하도록 최적화 여지가 있다.
- **컨트롤러 규칙**: `Mono`/`ResponseEntity`/try-catch 금지, SSE는 `produces = TEXT_EVENT_STREAM_VALUE`.
- **엔진 풀**: poolSize/timeout은 `chess.engine.*`로 조절. 프로세스 누수 방지를 위해 borrow/반납 경로를 깨지 말 것.
