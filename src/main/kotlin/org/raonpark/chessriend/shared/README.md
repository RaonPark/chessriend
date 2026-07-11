# shared

## 역할

도메인에 속하지 않는 **공통 인프라/유틸**. 전역 예외 처리, ID 생성, jOOQ DSLContext 설정, 페이징 결과 타입을 제공한다. 특정 바운디드 컨텍스트에 종속되지 않는다.

## 주요 구성요소

| 파일 | 역할 |
| --- | --- |
| `config/JooqConfig.kt` | `DSLContext` 빈(`DSL.using(SQLDialect.POSTGRES)`). 연결은 들지 않고 SQL 생성만 — 실행은 R2DBC `DatabaseClient` |
| `config/IdGeneratorConfig.kt` | `SnowflakeIdGenerator` 빈 등록 |
| `id/SnowflakeIdGenerator.kt` | 64비트 Snowflake ID(timestamp + machineId + sequence). 커스텀 epoch, `@Synchronized`로 스레드 안전 |
| `domain/PagedResult.kt` | 페이징 결과(`content`, `page`, `size`, `totalElements`, `totalPages`) + `hasNext`/`hasPrevious` 계산 |
| `exception/Exceptions.kt` | 커스텀 예외 계층 정의 |
| `exception/ErrorResponse.kt` | 에러 응답 DTO(`status`, `error`, `message`, `timestamp`) |
| `exception/GlobalExceptionHandler.kt` | `@RestControllerAdvice` — 예외 → HTTP 상태 + `ErrorResponse` 매핑 |

## 예외 처리 (전역)

서비스는 커스텀 예외를 throw하고, 컨트롤러는 try-catch 없이 통과시킨다. `GlobalExceptionHandler`가 한곳에서 매핑한다.

| 예외 | HTTP | 로그 레벨 |
| --- | --- | --- |
| `NotFoundException`(↳ `GameNotFoundException`, `GameAnalysisNotFoundException`) | 404 | debug |
| `IllegalArgumentException` | 400 | debug |
| `ConflictException` | 409 | warn |
| `ExternalApiRateLimitException` | 429 | warn |
| `ExternalApiUserNotFoundException` | 404 | — |
| `ExternalApiException` | 502 | error |
| `UnsupportedGameSourceException` | 400 | — |
| `EngineTimeoutException` | 504 | warn |
| `EngineUnavailableException` | 503 | error |
| `Exception`(catch-all) | 500 | error |

> 위 표의 HTTP/로그 레벨은 `Exceptions.kt`·`GlobalExceptionHandler.kt`를 변경하면 함께 갱신할 것.

## 데이터 접근

- `JooqConfig`만 데이터 계층과 연관(DSLContext 제공). 실제 쿼리 실행은 `game/adapter/out/persistence`가 담당.

## 변경 시 주의사항

- **Snowflake**: 다중 인스턴스로 확장하면 `machineId`를 인스턴스마다 다르게 줘야 ID 충돌이 없다(현재 단일 서버 기준 기본값).
- **새 예외 추가 시**: `Exceptions.kt`에 정의 + `GlobalExceptionHandler`에 핸들러 추가를 짝으로. 핸들러 없는 커스텀 예외는 catch-all로 500이 된다.
- **`PagedResult`**: `page`는 0-indexed. `hasNext = page < totalPages - 1`. 프론트 `PagedResponse`와 필드가 대응한다.
