# Tech Stack 상세

## Backend

| 기술 | 버전 | 용도 |
|------|------|------|
| Kotlin | 2.3.20 | 메인 언어 |
| Spring Boot | 4.0.5 | 프레임워크 |
| Spring WebFlux | - | 리액티브 웹 서버 (Netty) |
| Coroutines | 1.10.2 | 비동기 처리 (suspend + Flow) |
| R2DBC PostgreSQL | - | 리액티브 DB 드라이버 |
| Flyway | 12.3.0 | DB 스키마 마이그레이션 |
| SpringDoc OpenAPI | 3.0.1 | API 문서 (Swagger UI) |
| Jackson Kotlin | - | JSON 직렬화 |
| Kotest | 6.1.4 | 테스트 프레임워크 |
| MockK | 1.14.9 | Kotlin 목킹 |
| Testcontainers | - | 통합 테스트용 PostgreSQL 컨테이너 |
| Java | 25 (Corretto 25.0.1) | JVM |
| Gradle | 9.4.1 | 빌드 도구 |

### 왜 WebFlux + Coroutines?

- **WebFlux**: 논블로킹 I/O. Netty 기반으로 적은 스레드로 높은 동시성 처리.
- **Coroutines**: WebFlux의 Mono/Flux 대신 `suspend fun`과 `Flow`를 사용. 가독성이 훨씬 좋음.
- lichess API가 NDJSON 스트리밍을 주는데, `Flow`로 자연스럽게 처리 가능.
- Stockfish 분석도 비동기 프로세스 I/O → 코루틴 채널로 래핑하기 좋음.

### Flyway + R2DBC 공존

Flyway는 R2DBC를 지원하지 않아서, 마이그레이션 실행 시에만 JDBC 드라이버를 사용한다.
런타임 쿼리는 전부 R2DBC. `spring-boot-starter-jdbc`는 Flyway 전용.

```yaml
# application.yml
spring:
  r2dbc:                    # 런타임 쿼리용
    url: r2dbc:postgresql://localhost:5432/chessriend
  flyway:                   # 마이그레이션 전용 (JDBC)
    url: jdbc:postgresql://localhost:5432/chessriend
```

## Frontend

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.2.5 | UI 프레임워크 |
| TypeScript | 6.0.2 | 타입 안전성 |
| Vite | 8.0.8 | 빌드 도구 (Rolldown 번들러 내장) |
| chess.js | 1.4.0 | 체스 로직 (수 검증, PGN 파싱) |
| react-chessboard | 5.10.0 | 체스보드 UI 컴포넌트 |
| pnpm | 10.33.0 | 패키지 매니저 |

### 왜 Vite 8?

- Rolldown (Rust 기반 번들러) 통합으로 빌드 속도 10-30x 향상
- HMR (Hot Module Replacement)이 거의 즉시 반영
- React 19와 완전 호환

### 왜 chess.js + react-chessboard?

- 둘 다 TypeScript로 작성되어 타입 지원 완벽
- chess.js: 수 이동 규칙, PGN/FEN 처리를 프론트에서 바로 가능
- react-chessboard: 드래그앤드롭, 화살표 표시, 하이라이트 등 리뷰에 필요한 기능 내장
- 이 조합이 React 체스 앱의 사실상 표준

## 로컬 개발 환경

### Java 버전 관리

회사 프로젝트(Java 8)와 공존하기 위해 `gradle.properties`로 프로젝트별 JVM 지정:

```properties
# gradle.properties (gitignore 처리됨, 머신마다 로컬 관리)
org.gradle.java.home=C:/Users/sumin/.jdks/corretto-25.0.1
```

JAVA_HOME은 건드리지 않음. Gradle Toolchain이 컴파일/테스트에 Java 25를 자동 사용.
