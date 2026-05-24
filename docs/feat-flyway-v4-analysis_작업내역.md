# feat/flyway-v4-analysis 작업 내역

## 무엇을 했나

`docs/backend_tasks.md` ★★★ 1번 (분석 결과 DB 영속화)의 백엔드 전체 구현.

기존에 Stockfish 분석 결과(`GameAnalysisData`)는 `games.annotations` JSONB에 `analysis` 키로 내포 저장되고 있었음. 이번 PR로 전용 `game_analyses` 테이블에 분리하고, 독립 엔드포인트(`POST/GET /api/games/{id}/analysis`)를 노출.

## 왜

- **라이프사이클 분리**: 메모/베리에이션과 분석의 라이프사이클이 묶여 있어 재분석 시 annotations 전체를 다시 보내야 했음
- **JSONB 비대화**: 150수 게임 기준 평가 데이터만 ~30KB. 메모 단순 조회 시에도 끌려옴
- **별도 조회 경로 없음**: 분석 메타데이터(depth, analyzedAt)만 보고 싶을 때 전체 게임을 로드해야 했음

## 주요 변경

### Flyway V4 마이그레이션
- `src/main/resources/db/migration/V4__create_game_analyses.sql`
  - `game_analyses` 테이블 신설 (`id`, `game_id UNIQUE FK ON DELETE CASCADE`, `depth`, `analyzed_at`, `evaluations JSONB`, `created_at`, `updated_at`)
  - 기존 `games.annotations->'analysis'`를 새 테이블로 백필 (백필 id는 `games.id` 그대로 사용 — Snowflake는 시간단조증가라 신규 발급과 충돌 없음)
  - `annotations`에서 `analysis` 키 제거 (`annotations - 'analysis'`)

### 도메인
- `GameAnnotation.analysis` 필드 제거 (`domain/Annotation.kt`)
- `GameAnalysisNotFoundException` 추가 (`shared/exception/Exceptions.kt`)

### 헥사고날 레이어
- Port out: `GameAnalysisRepository` (save/findByGameId/deleteByGameId/existsByGameId)
- Port in: `SaveGameAnalysisUseCase`, `GetGameAnalysisUseCase` (`getAnalysis` 예외 던짐, `findAnalysis` 백워드 호환용 null 반환)
- Application: `SaveGameAnalysisService` (game 존재 검증 후 upsert), `GetGameAnalysisService`
- Adapter out: `GameAnalysisPersistenceAdapter` (순수 jOOQ DSL + R2DBC, `ON CONFLICT (game_id) DO UPDATE` upsert)
- Adapter in: `GameAnalysisController` (POST/GET 엔드포인트, 기존 `GameAnalysisRequest`/`GameAnalysisResponse` DTO 재사용)

### 백워드 호환
- `GET /api/games/{id}` 응답의 `annotations.analysis` 필드는 새 테이블에서 join하여 계속 노출
- `GameController.getGame`에 `GetGameAnalysisUseCase` 주입하여 `findAnalysis(id)` 호출 → `GameDetailResponse.from(game, analysis)` 2-arg 팩토리
- `PUT /api/games/{id}/annotations`로 들어오는 `analysis` 필드는 silently drop (`AnnotationRequest.toDomain()`에서 무시) — 프론트 한 릴리즈 동안 옛 페이로드 허용

## 주요 결정과 이유

| 결정 | 이유 |
|---|---|
| `evaluations`는 단일 JSONB 컬럼 (별도 `move_evaluations` 테이블 X) | 항상 함께 read/write, 개별 평가 쿼리 불필요. `games.moves` JSONB 선례와 일치 |
| `analyzedAt` 도메인 타입은 `String` 유지 | 도메인 타입 변경은 별개 리팩토링. 어댑터 경계에서 `Instant` ↔ `String` 변환 |
| 백필 시 `game_analyses.id = games.id` | Snowflake는 시간단조 증가 → 신규 발급과 충돌 없음, deterministic |
| 순수 jOOQ 어댑터 (R2DBC repo 안 만듦) | upsert + findByGameId만 필요. `Persistable.isNew` dance 회피 |
| `@Transactional` 사용 안 함 | 코드베이스 전반에 미사용. 각 작업이 단일 SQL이라 cross-statement 원자성 불필요 |
| Optimistic locking 사용 안 함 | 재분석은 사용자 트리거, 멱등. last-write-wins 허용 |
| Cascade delete | FK `ON DELETE CASCADE` — 게임 삭제 시 분석 자동 삭제 |

## 구현 중 발견한 이슈와 픽스

1. **R2DBC가 jOOQ `JSONB` 타입을 직접 인코딩 못함** (`DefaultCodecs.encodeParameterValue` 실패)
   - `bindQuery` 헬퍼에서 `JSONB` 파라미터를 `io.r2dbc.postgresql.codec.Json.of(v.data())`로 변환
2. **`.one().awaitSingleOrNull()`은 0 row일 때 예외** (`IncorrectResultSizeDataAccessException`)
   - `.first().awaitSingleOrNull()`로 변경 (R2DBC `RowsFetchSpec.one()`은 정확히 1건일 때만 통과)
3. **`dsl.selectOne()`이 `1` literal을 jOOQ params에 포함시켜 R2DBC bind index 어긋남** (`IndexOutOfBoundsException`)
   - `dsl.select(GAME_ANALYSES.ID).limit(1)`로 대체

## 테스트

- `GameAnalysisPersistenceAdapterTest` — Testcontainers PostgreSQL 17, FK 만족시킬 게임 먼저 저장 후 분석 라운드트립 검증
  - 신규 저장, upsert, findByGameId 라운드트립 (JSONB), analyzedAt 라운드트립, exists, delete, cascade delete
- `SaveGameAnalysisServiceTest` / `GetGameAnalysisServiceTest` — Kotest + MockK
- `GameAnalysisControllerTest` — WebTestClient + `@TestConfiguration` mock 주입

기존 `GameControllerTest`는 수정 불필요 — 실제 `GetGameAnalysisUseCase` 빈이 컨텍스트에 wire-up되어 비어있는 DB에 대해 `findAnalysis`가 null 반환.

## 후속 작업 (별도 PR)

- 프론트엔드 rewiring: `useBatchAnalysis` 완료 시 `POST /api/games/{id}/analysis` 호출, 페이지 로드 시 `GET /api/games/{id}/analysis` 별도 fetch
- 프론트 cutover 완료 후 `AnnotationRequest.analysis` 필드 제거, `GameDetailResponse.annotations.analysis` 호환 코드 제거
