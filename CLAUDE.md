# Chessriend - Chess Game Review App

## Project Overview

chess.com / lichess.org에서 자신의 게임을 PGN으로 가져와 분석하고, 메모를 작성할 수 있는 체스 리뷰 앱.
"내 게임이니까 더 애정을 가질 수 있게" 만드는 것이 핵심 철학.

## Tech Stack

- **Backend**: Kotlin 2.3.20 + Spring Boot 4.0.5 (Java 25)
- **Frontend**: React 19.2.5 + TypeScript 6.0.2 + Vite 8.0.8
- **Database**: PostgreSQL (R2DBC for reactive)
- **Build**: Gradle 9.4.1 (Kotlin DSL) / pnpm 10.33.0
- **Chess Libraries**: chess.js 1.4.0 + react-chessboard 5.10.0
- **Chess Engine**: Stockfish (UCI protocol)

## Architecture

### Backend: Hexagonal Architecture (Ports & Adapters)

비즈니스 로직(Domain)을 외부 의존성(DB, API, Web)으로부터 완전히 분리하는 구조.

```
┌──────────── Adapter (외부 세계) ────────────┐
│  ┌──────── Port (인터페이스) ────────┐       │
│  │  ┌──── Domain (순수 로직) ────┐   │       │
│  │  │  엔티티, 유스케이스        │   │       │
│  │  └───────────────────────────┘   │       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

**3계층:**
- **Domain** — 순수 비즈니스 로직, 외부 의존성 zero (Game, Move, Position)
- **Port** — 인터페이스 정의 (in: UseCase / out: Repository, Client)
- **Adapter** — Port 구현 (in: Controller / out: PostgresRepo, LichessClient)

**각 도메인 모듈 내부 구조:**
```
game/
├── domain/           # 엔티티, 값 객체
├── application/      # UseCase 구현
├── port/
│   ├── in/           # UseCase 인터페이스
│   └── out/          # Repository, Client 인터페이스
└── adapter/
    ├── in/web/       # REST Controller
    └── out/
        ├── persistence/  # R2DBC Repository 구현
        └── client/       # 외부 API 클라이언트 구현
```

### Frontend: Feature-based folder structure
### API: RESTful with OpenAPI spec

## Code Conventions

- Kotlin: 공식 코딩 컨벤션 준수, coroutines 우선
- Port/UseCase: suspend fun + Flow (순수 코루틴, Spring 의존 없음)
- Adapter(DB): CoroutineCrudRepository + CoroutineSortingRepository 사용 (R2DBC 코루틴 지원, Spring Data 3.x+에서 분리됨)
- React: Functional components only, hooks 패턴
- 모든 비즈니스 로직은 테스트 필수
- 한국어 주석 허용, 코드는 영어

## Code Style Patterns

- **Suspend functions**: Controller, Service 모두 `suspend fun` 사용
- **Flow for streaming**: 스트리밍 응답(lichess NDJSON 등)은 `Flow<T>` 사용
- **Immutable data classes**: 엔티티, 값 객체 모두 `data class` + `val`
- **Companion objects**: 상수, 팩토리 메서드에 활용
- **Extension functions**: 변환 로직에 Kotlin idiomatic 패턴 사용
- **Explicit null handling**: nullable 타입(`?`)과 null-safe 연산자 사용

## Exception Handling

모든 예외 처리는 `@RestControllerAdvice`와 `@ExceptionHandler`로 중앙 집중 처리한다.

### 규칙
- **커스텀 예외 클래스**: `shared/exception/`에 도메인별 예외 정의
- **Service 계층**: `throw CustomException(...)` — ResponseEntity 직접 반환 금지
- **Controller 계층**: try/catch 금지. Service 호출 결과만 반환
- **GlobalExceptionHandler**: 예외 → HTTP 응답 변환을 중앙에서 처리

### 표준 HTTP 상태 코드 매핑

| 예외 유형 | HTTP 상태 | 설명 |
|-----------|-----------|------|
| `XxxNotFoundException` | `404 Not Found` | 존재하지 않는 리소스 조회 |
| `XxxConflictException` | `409 Conflict` | 도메인 불변식 위반 |
| `IllegalArgumentException` | `400 Bad Request` | 잘못된 요청 파라미터 |
| `Exception` (catch-all) | `500 Internal Server Error` | 예상치 못한 오류 |

### 금지 패턴

```kotlin
// ❌ Service에서 ResponseEntity 반환
fun getGame(gameId: String): ResponseEntity<GameResponse> { ... }

// ❌ Controller에서 try/catch
@GetMapping("/{gameId}")
suspend fun getGame(@PathVariable gameId: String): ResponseEntity<GameResponse> {
    return try {
        ResponseEntity.ok(gameService.getGame(gameId))
    } catch (e: Exception) {
        ResponseEntity.notFound().build()
    }
}

// ❌ 표준 예외를 그대로 던짐
throw NoSuchElementException("Game not found")
```

## Development Checklist

각 도메인 기능 개발 시 체크리스트:
- [ ] Domain (엔티티, 값 객체)
- [ ] Port out (Repository, Client 인터페이스)
- [ ] Port in (UseCase 인터페이스)
- [ ] Application (UseCase 구현, `@Transactional`)
- [ ] Adapter out/persistence (R2DBC Repository + Flyway 마이그레이션)
- [ ] Adapter out/client (외부 API 클라이언트)
- [ ] Adapter in/web (Controller, `suspend` 함수, REST API)
- [ ] DTO (Request/Response)
- [ ] Exception (커스텀 예외 클래스)
- [ ] Test (Kotest + MockK, Testcontainers)
- [ ] `application.yml` 설정 추가
- [ ] `docs/` 작업 내역 문서

## Architecture Principles

1. **Reactive-first**: WebFlux + Coroutines으로 non-blocking I/O
2. **Hexagonal 의존성 규칙**: Domain은 외부 의존성 zero, 의존 방향은 항상 안쪽으로
3. **Optimistic locking**: `@Version`으로 동시 수정 충돌 방지
4. **Immutable entities**: `data class` + `val`, 상태 변경은 `copy()` 사용
5. **OpenAPI spec**: SpringDoc으로 API 문서 자동 생성

## Key Commands

```bash
# Backend
./gradlew bootRun
./gradlew test

# Frontend
cd frontend && pnpm dev
cd frontend && pnpm test
cd frontend && pnpm build
```

## Project Structure

```
chessriend/
├── src/main/kotlin/org/raonpark/chessriend/
│   ├── game/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── port/in/
│   │   ├── port/out/
│   │   └── adapter/in/web/
│   │       └── out/persistence/
│   │           └── client/
│   ├── analysis/                 # (같은 hexagonal 구조)
│   ├── review/                   # (같은 hexagonal 구조)
│   └── shared/                   # 공통 설정, 예외, 유틸
├── frontend/src/
│   ├── features/
│   │   ├── game/
│   │   ├── analysis/
│   │   └── review/
│   └── shared/
├── docs/                         # 작업 내용 정리 문서
├── build.gradle.kts
└── CLAUDE.md
```

## Documentation Rules

- 작업을 할 때마다 `docs/` 밑에 작업 내역 문서를 작성/업데이트할 것
- 파일명 형식: `{브랜치명}_작업내역.md` (예: `feat/game-import_작업내역.md`)
- 문서에는 각 작업 단위로 줄을 추가하며 다음을 포함:
  - **무엇을** 변경했는지
  - **왜** 그렇게 했는지 (의사결정 근거)
  - 주요 변경 파일 목록
- 프론트엔드 작업은 특히 상세하게 문서화 (컴포넌트 설명, 사용법 포함)
- 아키텍처 변경 시 `docs/architecture.md`도 반영

## Domain Glossary

- PGN: Portable Game Notation - 체스 기보 표준 포맷
- FEN: Forsyth-Edwards Notation - 체스 보드 상태 표현
- UCI: Universal Chess Interface - 체스 엔진 통신 프로토콜
- Evaluation: 엔진이 판단한 포지션 점수 (centipawn 단위)
- Blunder/Mistake/Inaccuracy: 실수 등급 (큰 실수/실수/부정확)
