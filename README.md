# Chessriend

chess.com / lichess.org에서 자신의 게임을 PGN으로 가져와 **분석하고, 메모를 작성**할 수 있는 체스 리뷰 앱.
"내 게임이니까 더 애정을 가질 수 있게" 만드는 것이 핵심 철학이다.

---

## 주요 기능

- **게임 가져오기**: Lichess / Chess.com 사용자명으로 게임을 가져오거나, PGN을 직접 붙여넣어 게임 생성 (SSE 실시간 스트리밍)
- **엔진 분석**: Stockfish로 수별 평가(centipawn) + Blunder / Mistake / Inaccuracy / Brilliant 분류
  - 백엔드 Stockfish(UCI 프로세스 풀): 게임 전체 일괄 분석
  - 프론트 Stockfish(브라우저 WASM): 사용자가 만든 변형선 실시간 평가
- **리뷰 / 메모**: 수별 코멘트, 변형선(variation) 작성·저장, 평가 막대(eval bar)
- **게임 목록**: 플랫폼·시간 카테고리 필터, 페이지네이션, 일괄 삭제

---

## 기술 스택

| 영역 | 스택 |
|------|------|
| **Backend** | Kotlin 2.3.20, Spring Boot 4.0.5 (Java 25), WebFlux + Coroutines |
| **Database** | PostgreSQL 17, R2DBC(논블로킹) + jOOQ(타입세이프 SQL) + Flyway(마이그레이션) |
| **Frontend** | React 19, TypeScript 6, Vite 8, Tailwind CSS v4 |
| **Chess** | chesslib(백엔드 SAN→FEN·희생 판정), chess.js + react-chessboard(프론트), Stockfish(UCI / WASM) |
| **State** | React Query(서버 상태), Zustand(클라이언트 보드 상태) |
| **Observability** | Micrometer + Prometheus(메트릭), Loki(로그), Tempo(트레이스, OTLP), Grafana |
| **Build** | Gradle 9.4.1 (Kotlin DSL), pnpm 10 |
| **Test** | Kotest + MockK + Testcontainers(백엔드), Vitest + MSW + Testing Library(프론트) |

---

## 아키텍처 개요

백엔드는 **헥사고날 아키텍처(Ports & Adapters)**. 의존 방향은 항상 바깥 → 안쪽이며, `domain`은 외부 의존성 zero.

```
Adapter  →  Port  →  Application  →  Domain
(바깥쪽)                              (안쪽)
```

현재 도메인은 `game` 단일 바운디드 컨텍스트 + 공통 코드 `shared`로 구성된다.

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
│           ├── persistence/  # R2DBC + jOOQ 영속성
│           ├── client/       # Lichess / Chess.com API 클라이언트
│           ├── engine/       # Stockfish UCI 프로세스 풀
│           └── chess/        # chesslib 어댑터(PGN 파싱·FEN 재구성)            → README (adapter/)
└── shared/                # config, exception, id(Snowflake), domain(PagedResult)  → README
```

설계 배경은 [`docs/architecture.md`](docs/architecture.md) 참고.

### 패키지별 README

| 패키지 | 내용 |
|--------|------|
| [`game/domain`](src/main/kotlin/org/raonpark/chessriend/game/domain/README.md) | 엔티티·값객체, 수 분류 로직(`GameAnalyzer`, `MoveClassifier`) |
| [`game/application`](src/main/kotlin/org/raonpark/chessriend/game/application/README.md) | UseCase 구현, 분석 오케스트레이션, 트랜잭션·코루틴 흐름 |
| [`game/port`](src/main/kotlin/org/raonpark/chessriend/game/port/README.md) | in/out 포트 인터페이스 목록과 계약 |
| [`game/adapter`](src/main/kotlin/org/raonpark/chessriend/game/adapter/README.md) | Controller, 영속성, 외부 API, 엔진, 체스 규칙 어댑터 |
| [`shared`](src/main/kotlin/org/raonpark/chessriend/shared/README.md) | 전역 예외 처리, Snowflake ID, jOOQ DSLContext 설정 |

프론트엔드 구조는 [`frontend/README.md`](frontend/README.md) 참고.

---

## 데이터 접근 방식

### jOOQ + R2DBC 조합

- **단순 CRUD** → Spring Data `CoroutineCrudRepository` (`R2dbcGameRepository`)
- **복잡한 쿼리**(동적 WHERE, 페이지네이션, UPSERT) → **jOOQ DSL로 타입세이프 SQL 작성 → R2DBC `DatabaseClient`로 실행**
  - 이유: 스키마 변경을 컴파일 타임에 잡기 위함. raw SQL은 런타임에야 터진다.

```kotlin
// jOOQ DSL → SQL 문자열 → R2DBC 실행 (GamePersistenceAdapter.bindQuery)
val sql = query.getSQL(ParamType.NAMED)
databaseClient.sql(sql).bind(index, value)...
// JSONB 컬럼은 jOOQ JSONB → io.r2dbc.postgresql.codec.Json 으로 변환 후 바인딩
```

- **JSONB**: `games.moves`, `games.annotations`, `game_analyses.evaluations`는 JSONB. Jackson으로 직렬화 후 `Json.of(...)`로 바인딩.
- **트랜잭션**: 별도 `@Transactional` 미사용 — 대부분 단일 쿼리/원자적 UPSERT. 다중 쿼리 일관성이 필요해지면 명시적 트랜잭션 경계 추가 필요.
- **blocking 없음**: 데이터 접근 계층은 전부 논블로킹(R2DBC). `Dispatchers.IO`는 Stockfish 프로세스 I/O에서만 사용.

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
# 백엔드 — Kotest + MockK, persistence/엔진 테스트는 Testcontainers(Docker 필요)
./gradlew test
./gradlew jacocoTestReport     # build/reports/jacoco/test/html

# 프론트엔드 — Vitest + MSW(API 모킹) + Testing Library
cd frontend
pnpm test            # watch
pnpm test:run        # 1회 실행
pnpm test:coverage
```

CI(`.github/workflows/ci.yml`)는 push/PR(`main`) 시 백엔드(JDK 25, Flyway→jOOQ→test→JaCoCo)와 프론트(Node 22, test→coverage→build)를 각각 실행하고 PR에 커버리지 코멘트를 단다.

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

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/games` | 게임 목록(쿼리: `page`, `size`, `source`, `timeCategory`) |
| `GET` | `/api/games/{id}` | 게임 상세(수순 + 주석 + 분석 포함) |
| `POST` | `/api/games/from-pgn` | PGN 문자열로 게임 생성 |
| `GET` | `/api/games/import` | 외부 API 게임 가져오기 — **SSE**(`text/event-stream`). 쿼리: `source`, `username`, `max`, 등 |
| `PUT` | `/api/games/{id}/annotations` | 수별 코멘트·변형선 저장 |
| `DELETE` | `/api/games/{id}` · `/batch` · `/all` | 개별 / 일괄 / 전체 삭제 |
| `POST` | `/api/games/{gameId}/analysis` | 분석 결과 저장 |
| `GET` | `/api/games/{gameId}/analysis` | 분석 결과 조회 |
| `GET` | `/api/games/{gameId}/analysis/run` | 백엔드 Stockfish 분석 실행 — **SSE**(`progress` / `complete` 이벤트) |

OpenAPI UI: springdoc(`/swagger-ui.html`).

---

## AI Assisted Development (Claude Code)

이 저장소는 Claude Code로 개발되며, 규칙·가드레일이 파일로 명시되어 있다.

- **[`CLAUDE.md`](CLAUDE.md)** — 프로젝트 헌장: 기술 스택, 헥사고날 규칙, 도메인 기능 개발 체크리스트, 동작 규칙(가정 명시, 검증 가능한 목표로 변환 등).
- **[`.claude/rules/`](.claude/rules/)** — 파일 타입별로 자동 로드되는 컨벤션(frontmatter `paths`):
  - `kotlin.md`(널 안전·코루틴·로깅), `spring.md`(WebFlux·DI·예외), `database.md`(jOOQ+R2DBC), `react.md`, `ui.md`(네이티브 UI 금지·amber 테마), `playwright.md`(E2E 시나리오), `docs.md`(작업내역 문서화).
- **`.claude/hooks/`** — 가드/자동화 훅 7종(`.claude/settings.local.json`에 연결):
  | 훅 | 이벤트 | 역할 |
  |----|--------|------|
  | `bash-guard.sh` | PreToolUse(Bash) | `rm -rf`·force push·`.env` 읽기 등 위험 명령 차단/확인 |
  | `flyway-guard.sh` | Pre+PostToolUse | 병합된 마이그레이션 수정 차단 + `generateJooq` 리마인드 |
  | `domain-deps-check.sh` | PostToolUse | `domain/`에 Spring/jOOQ/R2DBC 등 import 시 경고(헥사고날 보호) |
  | `kotlin-conventions.sh` | PostToolUse | `.block()`·`GlobalScope`·`@Autowired` 필드주입·`!!`·`ResponseEntity` 등 차단 |
  | `eslint-check.sh` | PostToolUse | 편집한 프론트 파일 ESLint |
  | `tsc-check.sh` | Stop | 턴 종료 시 프론트 타입체크 1회 |
  | `notify.sh` | Notification/Stop | macOS 데스크톱 알림 |
- **[`.claude/skills/new-domain.md`](.claude/skills/new-domain.md)** — 헥사고날 6레이어 + 엔티티/리포지토리/어댑터/Flyway/테스트/작업내역을 한 번에 스캐폴딩하는 커스텀 스킬.
- **MCP 서버**(`.claude/settings.local.json`) — `postgres`(로컬 DB 질의), `serena`(LSP 기반 코드 분석, Kotlin·TypeScript).

---

## 문서 최신화 정책

- 모든 작업은 `docs/{브랜치명}_작업내역.md`에 **What / Why / 주요 변경 파일**을 남긴다([`.claude/rules/docs.md`](.claude/rules/docs.md)).
- 아키텍처 변경 시 [`docs/architecture.md`](docs/architecture.md)도 갱신한다.
- README 누락/노후를 감지하는 보조 스크립트가 `.claude/hooks/readme-check.sh`로 제공된다(기본 비활성, 아래 참고).

### (선택) README 점검 훅

`.claude/hooks/readme-check.sh`는 도메인/포트/어댑터 소스를 편집할 때 **해당 패키지에 README가 없거나 루트 README가 비어 있으면 경고만** 출력한다(차단하지 않음, 새 의존성 없음). 활성화하려면 `.claude/settings.local.json`의 `PostToolUse`(matcher `Edit|Write`) 배열에 추가한다:

```json
{ "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/readme-check.sh", "timeout": 10 }
```

---

## 디렉터리 요약

```
chessriend/
├── src/                  # 백엔드 (Kotlin)
│   ├── main/kotlin/...   # game/ + shared/  (패키지별 README 있음)
│   ├── main/resources/   # application.yml, db/migration/V1~V4, logback-spring.xml
│   └── test/kotlin/...   # Kotest + Testcontainers
├── frontend/             # React + TS (frontend/README.md)
├── monitoring/           # prometheus / loki / tempo / grafana 설정
├── docs/                 # 작업내역·설계 문서
├── .claude/              # CLAUDE 규칙·훅·스킬
├── docker-compose.yml    # postgres + 모니터링 스택
└── build.gradle.kts
```
