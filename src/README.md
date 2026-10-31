# Chessriend — 기술 문서

앱 소개와 기능은 [루트 README](../README.md)에 있습니다. 이 문서는 개발에 필요한 기술 내용(스택, 아키텍처, 실행·테스트, API)을 다룹니다.

---

## 기술 스택

| 영역 | 스택 |
|------|------|
| **Backend** | Kotlin 2.3.20, Spring Boot 4.0.5 (Java 25), WebFlux + Coroutines |
| **Database** | PostgreSQL 17, R2DBC(논블로킹) + jOOQ(타입세이프 SQL) + Flyway(마이그레이션) |
| **Frontend** | React 19, TypeScript 6, Vite 8, Tailwind CSS v4, 글꼴 Pretendard |
| **Chess** | chesslib(백엔드 PGN 파싱·FEN 재구성·희생 판정), chess.js + react-chessboard(프론트), Stockfish(UCI / WASM) |
| **State** | React Query(서버 상태), Zustand(보드 상태, 설정 — 설정은 localStorage 저장) |
| **Observability** | Micrometer + Prometheus(메트릭), Loki(로그), Tempo(트레이스, OTLP), Grafana |
| **Build** | Gradle 9.4.1 (Kotlin DSL), pnpm 10 |
| **Test** | Kotest + MockK + Testcontainers(백엔드), Vitest + MSW + Testing Library(프론트), Playwright(브라우저 확인) |

---

## 아키텍처 개요

백엔드는 **헥사고날 아키텍처(Ports & Adapters)**. 의존 방향은 항상 바깥 → 안쪽이며, `domain`은 외부 의존성 zero.

```
Adapter  →  Port  →  Application  →  Domain
(바깥쪽)                              (안쪽)
```

현재 도메인은 `game` 단일 바운디드 컨텍스트(게임·분석·폴더) + 공통 코드 `shared`로 구성된다.

```
src/main/kotlin/org/raonpark/chessriend/
├── game/
│   ├── domain/            # 엔티티·값객체(순수 Kotlin) + analysis/ 분류 로직   → README
│   ├── application/       # UseCase 구현 (@Service)                            → README
│   ├── port/
│   │   ├── in/            # UseCase 인터페이스
│   │   └── out/           # Repository·Client·Engine·Rules 인터페이스          → README
│   └── adapter/
│       ├── in/web/        # REST Controller (suspend / Flow SSE)
│       └── out/
│           ├── persistence/  # R2DBC + jOOQ 영속성 (게임·분석·폴더)
│           ├── client/       # Lichess / Chess.com API 클라이언트
│           ├── engine/       # Stockfish UCI 프로세스 풀
│           └── chess/        # chesslib 어댑터(PGN 파싱·FEN 재구성)            → README (adapter/)
└── shared/                # config, exception, id(Snowflake), domain(PagedResult)  → README
```

설계 배경은 [`docs/architecture.md`](../docs/architecture.md) 참고.

### 패키지별 README

| 패키지 | 내용 |
|--------|------|
| [`game/domain`](main/kotlin/org/raonpark/chessriend/game/domain/README.md) | 엔티티·값객체(게임·폴더·검색 조건·애칭/메모), 수 분류 로직(`GameAnalyzer`, `MoveClassifier`) |
| [`game/application`](main/kotlin/org/raonpark/chessriend/game/application/README.md) | UseCase 구현, 분석 오케스트레이션, 트랜잭션·코루틴 흐름 |
| [`game/port`](main/kotlin/org/raonpark/chessriend/game/port/README.md) | in/out 포트 인터페이스 목록과 계약 |
| [`game/adapter`](main/kotlin/org/raonpark/chessriend/game/adapter/README.md) | Controller, 영속성, 외부 API, 엔진, 체스 규칙 어댑터 |
| [`shared`](main/kotlin/org/raonpark/chessriend/shared/README.md) | 전역 예외 처리, Snowflake ID, jOOQ DSLContext 설정 |

프론트엔드 구조는 [`frontend/README.md`](../frontend/README.md) 참고.

---

## 데이터 접근 방식

### jOOQ + R2DBC 조합

- **단순 CRUD** → Spring Data `CoroutineCrudRepository` (`R2dbcGameRepository`)
- **복잡한 쿼리**(동적 WHERE, 페이지네이션, 집계, UPSERT) → **jOOQ DSL로 타입세이프 SQL 작성 → R2DBC `DatabaseClient`로 실행**
  - 이유: 스키마 변경을 컴파일 타임에 잡기 위함. raw SQL은 런타임에야 터진다.

```kotlin
// jOOQ DSL → SQL 문자열 → R2DBC 실행 (각 PersistenceAdapter의 bindQuery)
val sql = query.getSQL(ParamType.NAMED)
databaseClient.sql(sql).bind(index, value)...
// - JSONB 파라미터: jOOQ JSONB → io.r2dbc.postgresql.codec.Json 으로 변환 후 바인딩
// - null 파라미터(값 지우기 등): bindNull(index, type)
```

- **목록 검색 조건**: `GameSearchCriteria`(플랫폼·시간·결과·상대 레이팅·오프닝·폴더)를 jOOQ `Condition`으로 변환. 소유자 쪽 판별은 `lower(white_name) = lower(owner_username)`.
- **JSONB**: `games.moves`, `games.annotations`(수별 메모·변형선·화살표), `game_analyses.evaluations`는 JSONB. Jackson으로 직렬화.
- **트랜잭션**: 대부분 단일 쿼리/원자적 UPSERT. 여러 쿼리를 묶어야 하는 폴더 생성·이름 변경·삭제(`FolderService`)는 `@Transactional`.
- **blocking 없음**: 데이터 접근 계층은 전부 논블로킹(R2DBC). `Dispatchers.IO`는 Stockfish 프로세스 I/O에서만 사용.

### DB 마이그레이션 (`main/resources/db/migration`)

| 버전 | 내용 |
|------|------|
| V1 | `games` 테이블 |
| V2 | `owner_username` (게임 소유자) |
| V3 | `annotations` JSONB (수별 메모·변형선) |
| V4 | `game_analyses` 테이블 분리 |
| V5 | `folders`, `game_folders` (게임 ↔ 폴더 다대다) |
| V6 | 시간 정보 없는 PGN 게임 → `OTHER`(기타) 재분류 |
| V7 | 체크메이트로 끝낸 수의 분류 보정 (cpLoss 0 / 분류 없음) |
| V8 | `games.nickname`, `games.memo` (게임 애칭·메모) |

이미 병합된 마이그레이션은 수정하지 않는다(훅 `flyway-guard.sh`가 차단). 변경이 필요하면 새 버전을 추가한다.

### jOOQ 코드 생성

생성물은 **gitignore**되며, 라이브 DB 스키마에서 생성한다. 따라서 DB가 떠 있고 마이그레이션이 적용된 상태여야 한다.

```bash
docker compose up -d postgres   # DB 기동
./gradlew flywayMigrate          # 마이그레이션 적용
./gradlew generateJooq           # build/generated-src/jooq/main 에 생성 (패키지: org.raonpark.chessriend.jooq)
```

스키마 변경(`db/migration/V*.sql` 추가) → `flywayMigrate` → `generateJooq` 순서가 깨지면 `GAMES` 등 참조가 컴파일에 실패한다.

---

## 실행 방법

### 사전 준비

1. **Docker** — PostgreSQL(+ 선택적으로 모니터링 스택)
2. **Stockfish** — 백엔드 일괄 분석용 바이너리. macOS: `brew install stockfish` (기본 경로 `/opt/homebrew/bin/stockfish`). 다른 경로면 `CHESS_ENGINE_PATH` 지정.
3. **JDK 25**, **pnpm 10**

### 1) 인프라 기동

```bash
docker compose up -d postgres                 # DB만
# 또는 모니터링 포함 전체:
docker compose up -d
```

### 2) 백엔드

```bash
./gradlew flywayMigrate && ./gradlew generateJooq   # 최초 1회(또는 스키마 변경 시)
./gradlew bootRun                                    # http://localhost:8081
```

> 마이그레이션이 추가된 브랜치를 받은 뒤에는 백엔드를 **재시작**해야 새 컬럼·분류값을 읽을 수 있다.

### 3) 프론트엔드

```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:5173 — /api 요청은 8081로 프록시
```

---

## 빌드 방법

```bash
# 백엔드 (실행 가능 jar)
./gradlew build

# 프론트엔드 (tsc 타입체크 + Vite 번들 → frontend/dist)
cd frontend && pnpm build
```

---

## 테스트 방법

```bash
# 백엔드 — Kotest + MockK, persistence/API 통합/엔진 테스트는 Testcontainers(Docker 필요)
./gradlew test
./gradlew jacocoTestReport     # build/reports/jacoco/test/html

# 프론트엔드 — Vitest + MSW(API 모킹) + Testing Library
cd frontend
pnpm test            # watch
pnpm test:run        # 1회 실행
pnpm test:coverage
pnpm lint
```

CI(`.github/workflows/ci.yml`)는 push/PR(`main`) 시 백엔드(JDK 25, Flyway→jOOQ→test→JaCoCo)와 프론트(Node 22, test→coverage→build)를 각각 실행하고 PR에 커버리지 코멘트를 단다.

브라우저 시나리오 확인은 Playwright MCP로 한다([`.claude/rules/playwright.md`](../.claude/rules/playwright.md), [`docs/playwright-scenarios.md`](../docs/playwright-scenarios.md)).

---

## 환경 설정

루트 `.env`(예시: `.env.example`)와 `application.yml`을 사용한다(`spring-dotenv`로 `.env` 로드).

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `LICHESS_API_TOKEN` | (없음) | Lichess API 토큰. 없으면 미인증(분당 20회 제한) |
| `CHESS_ENGINE_PATH` | `/opt/homebrew/bin/stockfish` | 백엔드 Stockfish 바이너리 경로 |
| `CHESS_ENGINE_DEPTH` | `18` | 분석 깊이 (프론트 `constants.ts`의 `ANALYSIS_DEPTH`와 동기 유지) |
| `CHESS_ENGINE_POOL_SIZE` | `2` | 동시 분석 프로세스 수 |
| `CHESS_ENGINE_THREADS` / `CHESS_ENGINE_HASH_MB` / `CHESS_ENGINE_TIMEOUT_MS` | `1` / `128` / `15000` | 프로세스당 스레드·해시·포지션 타임아웃 |
| `POSTGRES_*` | `chessriend` / `localhost:5432` | DB 접속(docker-compose 기본값과 동일) |

> `.env`에는 시크릿이 들어갈 수 있으므로 커밋 금지(`.gitignore` 등록됨). 훅 `bash-guard.sh`가 `.env` 읽기를 차단한다.

### 포트 / 서비스 요약

| 서비스 | 포트 | 비고 |
|--------|------|------|
| Backend (Spring) | 8081 | `application.yml: server.port` |
| Frontend (Vite) | 5173 | `/api` → 8081 프록시 |
| PostgreSQL | 5432 | db/user/pass 모두 `chessriend` |
| Grafana | 3000 | admin / admin |
| Prometheus | 9090 | |
| Loki | 3100 | 로그 (logback `Loki4jAppender`, `test` 프로파일 제외) |
| Tempo | 3200 / 4317 / 4318 | 트레이스(OTLP gRPC/HTTP) |

---

## REST API 요약

### 게임

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/games` | 게임 목록. 쿼리: `page`, `size`, `source`, `timeCategory`, `outcome`(WIN/LOSS/DRAW, 소유자 관점), `ratingBand`(상대 레이팅 구간, `UNRATED` 포함), `opening`, `folderId`. 응답에 분석 요약(`analysisSummary`)·폴더 태그·애칭/메모 포함 |
| `GET` | `/api/games/openings` | 오프닝 이름별 게임 수 (많은 순) |
| `GET` | `/api/games/{id}` | 게임 상세(수순 + 수별 메모·변형선·화살표 + 분석 + 애칭/메모) |
| `POST` | `/api/games/from-pgn` | PGN 문자열로 게임 생성 (TimeControl·Event 태그로 시간 분류) |
| `GET` | `/api/games/import` | 외부 API 게임 가져오기 — **SSE**(`text/event-stream`). 쿼리: `source`, `username`, `since`, `until`, `max`, `timeCategory`, `rated`, `color`, `vs` |
| `PUT` | `/api/games/{id}/annotations` | 수별 메모·변형선·화살표 저장 |
| `PUT` | `/api/games/{id}/note` | 게임 애칭·메모 저장 (빈 값은 지움) |
| `DELETE` | `/api/games/{id}` · `/batch` · `/all` | 개별 / 일괄 / 전체 삭제 |

### 분석

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/games/{gameId}/analysis` | 분석 결과 저장 |
| `GET` | `/api/games/{gameId}/analysis` | 분석 결과 조회 |
| `GET` | `/api/games/{gameId}/analysis/run` | 백엔드 Stockfish 분석 실행 — **SSE**(`progress` / `complete` 이벤트) |

### 폴더

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/folders` | 폴더 목록 + 게임 수 (생성 순) |
| `POST` | `/api/folders` | 폴더 생성 `{name, gameIds?}` → 201. 같은 이름 409 |
| `PATCH` | `/api/folders/{id}` | 이름 변경 |
| `DELETE` | `/api/folders/{id}` | 폴더 삭제 (게임은 남음) → 204 |
| `POST` / `DELETE` | `/api/folders/{id}/games` | 게임 넣기 / 빼기 (body: 게임 ID 배열) → 204 |

OpenAPI UI: springdoc(`/swagger-ui.html`).

---

## AI Assisted Development (Claude Code)

이 저장소는 Claude Code로 개발되며, 규칙·가드레일이 파일로 명시되어 있다.

- **[`CLAUDE.md`](../CLAUDE.md)** — 프로젝트 헌장: 기술 스택, 헥사고날 규칙, 도메인 기능 개발 체크리스트, 동작 규칙(가정 명시, 검증 가능한 목표로 변환 등).
- **[`.claude/rules/`](../.claude/rules/)** — 파일 타입별로 자동 로드되는 컨벤션(frontmatter `paths`):
  - `kotlin.md`(널 안전·코루틴·로깅), `spring.md`(WebFlux·DI·예외), `database.md`(jOOQ+R2DBC), `react.md`, `ui.md`(네이티브 UI 금지·amber 테마), `playwright.md`(E2E 시나리오), `docs.md`(작업내역 문서화).
- **`.claude/hooks/`** — 가드/자동화 훅(`.claude/settings.local.json`에 연결):
  | 훅 | 이벤트 | 역할 |
  |----|--------|------|
  | `bash-guard.sh` | PreToolUse(Bash) | `rm -rf`·force push·`.env` 읽기 등 위험 명령 차단/확인 |
  | `flyway-guard.sh` | Pre+PostToolUse | 병합된 마이그레이션 수정 차단 + `generateJooq` 리마인드 |
  | `domain-deps-check.sh` | PostToolUse | `domain/`에 Spring/jOOQ/R2DBC 등 import 시 경고(헥사고날 보호) |
  | `kotlin-conventions.sh` | PostToolUse | `.block()`·`GlobalScope`·`@Autowired` 필드주입·`!!`·`ResponseEntity` 등 차단 |
  | `eslint-check.sh` | PostToolUse | 편집한 프론트 파일 ESLint |
  | `tsc-check.sh` | Stop | 턴 종료 시 프론트 타입체크 1회 |
  | `notify.sh` | Notification/Stop | macOS 데스크톱 알림 |
  | `readme-check.sh` | PostToolUse (선택) | 패키지 README 누락·루트 README 비어 있음 경고 (아래 참고) |
- **[`.claude/skills/new-domain.md`](../.claude/skills/new-domain.md)** — 헥사고날 6레이어 + 엔티티/리포지토리/어댑터/Flyway/테스트/작업내역을 한 번에 스캐폴딩하는 커스텀 스킬.
- **MCP 서버**(`.claude/settings.local.json`) — `postgres`(로컬 DB 질의), `serena`(LSP 기반 코드 분석, Kotlin·TypeScript), `playwright`(브라우저 확인).

---

## 문서 최신화 정책

- 모든 작업은 `docs/{브랜치명}_작업내역.md`에 **What / Why / 주요 변경 파일**을 남긴다([`.claude/rules/docs.md`](../.claude/rules/docs.md)). 작업내역은 당시 기록이므로 이후 코드가 바뀌어도 고치지 않는다.
- 아키텍처 변경 시 [`docs/architecture.md`](../docs/architecture.md)와 해당 패키지 README도 갱신한다.

### (선택) README 점검 훅

`.claude/hooks/readme-check.sh`는 도메인/포트/어댑터 소스를 편집할 때 **해당 패키지에 README가 없거나 루트 README가 비어 있으면 경고만** 출력한다(차단하지 않음, 새 의존성 없음). 활성화하려면 `.claude/settings.local.json`의 `PostToolUse`(matcher `Edit|Write`) 배열에 추가한다:

```json
{ "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/readme-check.sh", "timeout": 10 }
```

---

## 디렉터리 요약

```
chessriend/
├── README.md             # 앱 소개·기능 (체스 사용자 관점)
├── src/                  # 백엔드 (Kotlin) — 이 문서
│   ├── main/kotlin/...   # game/ + shared/  (패키지별 README 있음)
│   ├── main/resources/   # application.yml, db/migration/V1~V8, logback-spring.xml
│   └── test/kotlin/...   # Kotest + Testcontainers
├── frontend/             # React + TS (frontend/README.md)
├── monitoring/           # prometheus / loki / tempo / grafana 설정
├── docs/                 # 작업내역·설계 문서
├── .claude/              # Claude Code 규칙·훅·스킬
├── docker-compose.yml    # postgres + 모니터링 스택
└── build.gradle.kts
```
