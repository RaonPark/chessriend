# feat/logging-pipeline 작업내역

## 배경

Loki 어펜더와 Micrometer Tracing(OTel) 브릿지는 `build.gradle.kts`에 이미 들어가 있었고, `logback-spring.xml`에는 `traceId`/`spanId` MDC 자리가 뚫려 있었다. 그러나 실제 애플리케이션 코드에 로그가 `GlobalExceptionHandler` 한 곳뿐이라, Loki에 도착하는 로그 자체가 거의 없었다. 즉 인프라는 있는데 **쏠 로그가 없는** 상태.

또 하나, WebFlux + 코루틴 스택에서는 스레드가 자유롭게 바뀌기 때문에 **MDC(ThreadLocal 기반)가 중간에 날아갈 수 있다**. 사용자 정의 MDC 키를 넣으려면 `kotlinx-coroutines-slf4j`의 `MDCContext`를 함께 써야 한다.

## 변경 내용

### 1. 의존성 추가 — `build.gradle.kts`

```kotlin
// ── Kotlin + Coroutines ──
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-slf4j:1.10.2")

// ── Logging ──
implementation("io.github.oshai:kotlin-logging-jvm:7.0.7")
```

- `kotlin-logging-jvm`: 현재 공식 권장 패턴은 **top-level property** — `private val log = KotlinLogging.logger {}`.
  `companion object : KLogging()` 상속 패턴은 레거시이므로 사용하지 않는다.
  람다 형태(`log.info { "..." }`)로 호출하면 비활성화된 레벨의 문자열 조립 비용이 생략된다.
- `kotlinx-coroutines-slf4j`: 코루틴에서 MDC를 전파하기 위한 `MDCContext`를 제공.
  WebFilter에서 MDC를 채운 뒤 코루틴 블록에 전파하는 파이프라인에서 필수.

### 2. 기존 로거 전환 — `GlobalExceptionHandler`

- `org.slf4j.LoggerFactory.getLogger(javaClass)` → `io.github.oshai.kotlinlogging.KotlinLogging.logger {}` (top-level)
- 모든 호출을 placeholder 스타일(`"{}"`, `ex.message`)에서 kotlin-logging 람다 스타일(`log.debug { "..." }`)로 변경.
- 예외 첨부 방식도 람다 시그니처(`log.error(ex) { "..." }`)로 맞췄다.

### 3. 도메인 로그 삽입

로그는 **파일별 top-level `KotlinLogging.logger {}`** 패턴으로 통일. Logger 객체를 한 클래스로 집중화하면 Loki `logger` 필드가 전부 같은 값이 되어 패키지/클래스 단위 필터링이 불가능해지므로 지양.

#### `ImportGameService`

- `onStart` — import 시작 (source/username/max 파라미터 기록)
- 저장된 게임 수 카운터 → `onCompletion`에서 성공/취소 경로 분기 로그
  - 정상 종료: `info` 레벨, `saved=N`
  - 예외/취소: `warn` 레벨 + throwable

Flow 파이프라인이므로 `onStart`/`onEach`/`onCompletion` 조합으로 부수 효과 없이 관측성 확보.

#### `GetGameService`

- 삭제 계열(`deleteGame`, `deleteGames`, `deleteAllGames`) — 상태 변경이므로 info/warn
  - `deleteAllGames`는 파괴적 작업이라 `warn` 레벨로 기록해 Loki에서 강조
- `updateAnnotations` — `debug` 레벨 (자주 호출되는 쓰기)

#### `ChessComClient`

- 월별 아카이브 URL 해석 결과를 `debug` 로그로 남김. rate limit/404/5xx 예외는 `GlobalExceptionHandler`가 받아 로깅하므로 클라이언트에서는 흐름 추적용 로그만 추가.

#### `LichessClient`

- NDJSON 스트림 오픈 시점을 `debug` 로그로 남김. `onStart` hook로 Flow 파이프라인에 부수 효과 없이 삽입.

## 왜 그렇게 했는가 (의사결정 근거)

- **Logger 클래스 집중화 안 함**: Logger name이 Loki의 필터링 차원이기 때문. 파일별 logger를 유지해야 `{logger="...ImportGameService"}` 같은 쿼리와 `<logger name="org.raonpark.chessriend.game" level="DEBUG"/>` 같은 패키지별 레벨 조절이 의미를 갖는다. 집중화해야 할 건 logger가 아니라 **정책**(logback 설정, WebFilter, ExceptionHandler).
- **람다 스타일 (`log.info { ... }`)**: 비활성 레벨에서 문자열 보간 비용을 회피. kotlin-logging의 핵심 이점.
- **Flow operator로 로그 삽입**: `onStart`/`onEach`/`onCompletion`은 Flow에 side-effect를 덧붙이는 idiomatic한 방법. 비즈니스 로직과 관측 로직 분리 유지.
- **로그 레벨**: 상태 변경은 `info`, 파괴적 작업은 `warn`, 상세 흐름은 `debug`. 에러는 `GlobalExceptionHandler`에서 일괄 처리하므로 service/client 계층에서 중복 `error` 로그 금지.

## 주요 변경 파일

- `build.gradle.kts` — `kotlin-logging-jvm`, `kotlinx-coroutines-slf4j` 추가
- `src/main/kotlin/org/raonpark/chessriend/shared/exception/GlobalExceptionHandler.kt` — SLF4J → kotlin-logging
- `src/main/kotlin/org/raonpark/chessriend/game/application/ImportGameService.kt` — import 라이프사이클 로그
- `src/main/kotlin/org/raonpark/chessriend/game/application/GetGameService.kt` — 삭제/업데이트 상태 변경 로그
- `src/main/kotlin/org/raonpark/chessriend/game/adapter/out/client/ChessComClient.kt` — 아카이브 해석 로그
- `src/main/kotlin/org/raonpark/chessriend/game/adapter/out/client/LichessClient.kt` — NDJSON 스트림 오픈 로그

## 남은 작업 (다음 커밋 후보)

아직 하지 않았고 이후 추가할 것들:

1. **WebFilter로 MDC 주입** — `requestId` 생성, 사용자 식별자가 있다면 `userId`, 경로/메서드 같은 기본 키를 MDC에 put. 요청 종료 시 자동 정리.
2. **코루틴 진입점 MDC 전파 검증** — Spring Boot 4의 Context Propagation이 Reactor Context → MDC 전달을 자동 처리하는지 실제 `traceId`가 도메인 로그까지 살아서 찍히는지 확인.
3. **LogstashEncoder로 전환** — 현재 `logback-spring.xml`의 Loki message pattern은 JSON 문자열을 하드코딩하고 있어, MDC 키가 늘어날 때마다 수정해야 한다. `LogstashEncoder`로 바꾸면 MDC 전체가 자동 JSON 필드화되어 Loki LogQL `|json | userId="..."` 쿼리가 일관되게 동작.
4. **도메인 확장** — analysis, review 도메인 추가 시 동일 패턴으로 로그 삽입.
