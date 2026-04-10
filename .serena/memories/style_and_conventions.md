# Code Style & Conventions

## Kotlin (Backend)
- Kotlin 공식 코딩 컨벤션 준수
- Coroutines 우선 (suspend fun + Flow, Mono/Flux 직접 사용 지양)
- Spring WebFlux 기반 (Netty)
- 한국어 주석 허용, 코드(변수명, 함수명 등)는 영어
- 모든 비즈니스 로직은 테스트 필수
- 설정 파일: application.yml (properties 아님)

## Hexagonal Architecture Rules
- Domain: 순수 Kotlin, 외부 의존성 zero (Spring annotation 금지)
- Port: 인터페이스만 정의
- Adapter: Port 구현, Spring Bean 등록
- 의존성 방향: Adapter → Port → Domain (항상 안쪽으로)

## Frontend (React + TypeScript)
- Functional components only
- Hooks 패턴
- Feature-based folder structure
- TypeScript strict mode

## Package Structure
- Group ID: org.raonpark
- Base package: org.raonpark.chessriend

## Test
- Kotest 6.1.4 (runner-junit5)
- MockK 1.14.9
- Testcontainers for integration tests
