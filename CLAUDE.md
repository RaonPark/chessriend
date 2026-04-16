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

### 공통 원칙

- 한국어 주석 허용, 코드(변수명, 함수명, 클래스명)는 영어
- 최신 스택의 공식 권장 패턴 준수, deprecated API 사용 금지
- 깔끔한 코드 우선: 보일러플레이트·수동 캐스팅·불필요한 래핑 최소화
- 라이브러리/프레임워크 기능 적극 활용 (직접 구현 전에 제공 기능 확인)
- 모든 비즈니스 로직은 테스트 필수

---

### Kotlin 2.x 공식 패턴

- **Immutable 우선**: `val` 기본, `var`는 명확한 이유가 있을 때만
- **Trailing lambda**: 마지막 파라미터가 람다면 괄호 밖으로, 유일한 인자면 괄호 생략
- **Scope functions**: `?.let {}` (null-safe 체이닝), `apply {}` (객체 설정), `also {}` (사이드이펙트)
- **Null safety**: `?.let {}` > `if (x != null)`, `requireNotNull()` > `!!`, elvis(`?:`) 적극 활용
- **Sealed class/interface**: exhaustive `when` 분기 보장, `else` 브랜치 최소화
- **Named arguments**: 같은 타입 파라미터 2개 이상이면 반드시 사용
- **`data object`**: toString 필요한 싱글턴에 사용 (Kotlin 2.x)
- **Visibility**: `internal` > `public` 기본, 최소 공개 원칙

```kotlin
// ✅ Kotlin idiomatic
user?.let { save(it) }
requireNotNull(id) { "ID required" }
list.filter { it > 0 }.map { it.toString() }

// ❌ 금지
if (user != null) save(user)  // let 체이닝 가능한 경우
id!!  // requireNotNull 대신 사용
```

### Kotlin Coroutines 패턴

- **Structured concurrency**: 모든 코루틴은 `CoroutineScope`에 속해야 함. `GlobalScope` 금지
- **`suspend fun` 기본**: 순차 비동기는 suspend fun, 병렬은 `coroutineScope { async {} }`
- **`Flow<T>` for streams**: cold stream 기본, hot 필요시 `.stateIn()` / `.shareIn()`
- **Blocking 호출**: `withContext(Dispatchers.IO) { blockingCall() }` 필수
- **Cancellation 협력**: 장시간 루프에서 `ensureActive()` 체크
- **`CancellationException`**: catch 하면 반드시 rethrow

```kotlin
// ✅ 병렬 실행
coroutineScope {
    val a = async { fetchA() }
    val b = async { fetchB() }
    Result(a.await(), b.await())
}

// ❌ 금지
GlobalScope.launch { ... }
async { fetchA() }.await()  // 바로 await하면 그냥 suspend fun 사용
```

---

### Spring WebFlux + Coroutines (Spring Boot 4.x)

- **Controller**: `suspend fun`으로 직접 반환, `Mono<T>` / `ResponseEntity` 래핑 불필요
- **Streaming**: `Flow<T>` 반환 → Spring이 자동으로 `Flux` 변환
- **Repository**: `CoroutineCrudRepository` 사용 (not `ReactiveCrudRepository`)
- **WebClient**: `awaitBody<T>()`, `bodyToFlow<T>()` 코루틴 확장 함수 사용, `.block()` 금지
- **DI**: 생성자 주입만 사용, `@Autowired` 필드 주입 금지, 인터페이스(Port) 주입
- **예외**: Service에서 커스텀 예외 throw → `@RestControllerAdvice`에서 중앙 처리
- **`@Transactional`**: Spring 7에서 suspend fun에 네이티브 지원

```kotlin
// ✅ 코루틴 컨트롤러
@GetMapping("/{id}")
suspend fun getGame(@PathVariable id: Long): GameDetailResponse =
    GameDetailResponse.from(getGameUseCase.getGame(id))

// ❌ 금지 패턴
fun getGame(id: Long): Mono<GameDetailResponse>  // Mono 래핑
fun getGame(id: Long): ResponseEntity<GameDetailResponse>  // Service에서 ResponseEntity
```

#### Jackson / JSON 직렬화

```kotlin
// ✅ ObjectMapper 타입 변환 사용
objectMapper.readValue(json, GameAnnotation::class.java)

// ✅ 유동적 외부 API 응답만 JsonNode 사용
val node = objectMapper.readTree(body)
node["archives"]?.forEach { add(it.asText()) }

// ❌ 수동 캐스팅 금지
val map = objectMapper.readValue(json, Map::class.java) as Map<String, Any?>
```

#### DTO 매핑 규칙

```kotlin
// Domain → DTO: companion object { fun from() }
data class GameResponse(...) {
    companion object {
        fun from(game: Game): GameResponse = GameResponse(...)
    }
}

// DTO → Domain: fun toDomain()
data class AnnotationRequest(...) {
    fun toDomain(): GameAnnotation = GameAnnotation(...)
}
```

#### R2DBC 규칙

- 단순 CRUD → `CoroutineCrudRepository` 메서드
- 복잡한 쿼리(동적 WHERE, 페이지네이션) → `DatabaseClient.sql()` + named bind
- JSONB 컬럼 → `io.r2dbc.postgresql.codec.Json.of()`

---

### React 19 공식 패턴

- **Functional components only**, class component 금지
- **`ref` as prop**: `forwardRef()` deprecated → `ref`를 일반 prop으로 전달
- **`use()` API**: 조건부 호출 가능한 promise/context 읽기 (Suspense와 함께)
- **`useActionState`**: 폼 제출 + 비동기 상태 + pending을 한번에 처리
- **`useOptimistic`**: 비동기 작업 중 낙관적 UI 업데이트
- **React Compiler (v1.0)**: 자동 메모이제이션 → 수동 `useMemo`/`useCallback`/`React.memo` 최소화
- **Suspense 경계**: 데이터 로딩은 `<Suspense fallback={...}>` 활용
- **Context 직접 렌더링**: `<Context>` 가능, `<Context.Provider>` 불필요

```tsx
// ✅ React 19 패턴
function Input({ ref, ...props }) {  // forwardRef 불필요
  return <input ref={ref} {...props} />
}

// ✅ ref cleanup
<div ref={(node) => { setup(node); return () => cleanup(node); }} />

// ❌ deprecated
const Input = forwardRef((props, ref) => ...)
```

#### 상태 관리 규칙

- **서버 상태**: React Query (`useQuery`, `useMutation`)
- **클라이언트 상태**: Zustand (`create` + 개별 selector)
- **Query key factory**: `gameKeys.detail(id)` 패턴으로 중앙 관리
- **캐시 무효화**: mutation `onSuccess`에서 관련 query key invalidate

```typescript
// ✅ 개별 selector (불필요한 리렌더 방지)
const currentFen = useBoardStore((s) => s.currentFen)

// ❌ 전체 store 구독 금지
const store = useBoardStore()
```

#### 컴포넌트 패턴

```tsx
// ✅ 로딩/에러/빈 상태 항상 처리
if (isLoading) return <LoadingSpinner />
if (error) return <ErrorMessage message="..." onRetry={() => refetch()} />

// ✅ mutation pending 상태 반영
<button disabled={mutation.isPending}>
  {mutation.isPending ? '저장 중...' : '저장'}
</button>
```

---

### TypeScript 6.x 공식 패턴

- **`import type`**: 타입 전용 import는 반드시 `import type` 사용 (`verbatimModuleSyntax`)
- **`unknown` > `any`**: 불확실한 타입은 `unknown` + 타입 가드로 좁히기
- **`satisfies`**: 타입 호환성 검증 without 타입 확장 (`as` 대신 사용)
- **Discriminated union**: 패턴 매칭용 유니온 타입, exhaustive switch
- **Interface vs Type**: 객체 형태 → `interface`, union/literal → `type`
- **Strict mode**: `strict: true` + `noUncheckedIndexedAccess` 권장

```typescript
// ✅ satisfies로 타입 검증 (타입 추론 유지)
const config = { port: 3000 } satisfies ServerConfig

// ✅ discriminated union
type Result = { status: 'ok'; data: T } | { status: 'error'; message: string }

// ❌ 금지
const config = { port: 3000 } as ServerConfig  // 타입 단언
let data: any  // any 사용
```

---

### Tailwind CSS / UI 규칙

- **Chess amber 테마**: primary 색상은 amber 계열 (amber-600~900)
- **Dark mode 필수**: 모든 인터랙티브 요소에 `dark:` variant 포함
- **클래스 순서**: display → sizing → spacing → border → colors → shadow → transition → dark:
- **UI 라이브러리 금지**: 네이티브 HTML + Tailwind 커스텀 컴포넌트
- **의미론적 색상 체계**:
  - Primary: amber (체스 테마)
  - Analysis: indigo (변형선, 분석 모드)
  - Saved: emerald (저장된 변형선)
  - Error/Danger: red
  - Classification: red (블런더) / orange (미스테이크) / yellow (부정확)

### Import 순서

```typescript
// Frontend
// 1. React / 외부 라이브러리
// 2. Shared (@ alias)
// 3. Feature 내부 (상대 경로)
// 4. Type imports

// Backend
// 1. kotlinx (coroutines 등)
// 2. Spring framework
// 3. 프로젝트 도메인 (org.raonpark)
// 4. Java / 외부 라이브러리
```

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
