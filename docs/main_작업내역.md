# master — 프로젝트 초기 설정

## 2026-04-10: 프로젝트 init

### Backend 설정
- **무엇을**: Spring Boot 프로젝트 의존성 전면 업그레이드 및 Hexagonal 패키지 구조 생성
- **왜**: 최신 안정 버전 스택으로 시작하고, 도메인 분리를 위해 Hexagonal Architecture 채택
- **변경점**:
  - `build.gradle.kts` — Kotlin 2.3.20, Java 25, Spring Boot 4.0.5로 업그레이드
  - WebFlux + Coroutines, R2DBC, Flyway, SpringDoc OpenAPI, Kotest, MockK 등 의존성 추가
  - `application.properties` → `application.yml` 전환
  - `gradle.properties` — Corretto 25 JDK 경로 (gitignore 처리, 머신별 로컬 관리)
  - `gradle/wrapper/gradle-wrapper.properties` — Gradle 9.4.1
  - 패키지 구조: `game/`, `analysis/`, `review/`, `shared/` 각각 hexagonal 레이어 생성

### Frontend 설정
- **무엇을**: Vite 8 + React 19 + TypeScript 프로젝트 생성 및 체스 라이브러리 추가
- **왜**: 최신 Vite 8 (Rolldown 번들러)로 빠른 빌드, chess.js와 react-chessboard가 TypeScript 네이티브 지원
- **변경점**:
  - `frontend/` — `pnpm create vite` (react-ts 템플릿)
  - React 19.2.5, TypeScript 6.0.2, Vite 8.0.8
  - chess.js 1.4.0, react-chessboard 5.10.0 추가

### 인프라
- **무엇을**: Docker, Serena, Claude MCP 설정
- **왜**: 어떤 데스크탑(Windows/Mac)에서든 동일한 개발 환경을 보장하기 위해
- **변경점**:
  - `docker-compose.yml` — PostgreSQL 17 컨테이너 (chessriend DB, 5432 포트)
  - `.claude/settings.json` — PostgreSQL MCP 서버 설정 (`npx @anthropic/postgres-mcp`)
  - `.serena/project.yml` — Kotlin + TypeScript 언어 설정, 온보딩 메모리 작성
  - `.gitignore` — `gradle.properties` 추가 (머신별 JDK 경로)

### 문서
- **무엇을**: CLAUDE.md, docs/ 문서 체계 수립
- **왜**: 프로젝트 컨텍스트를 팀(또는 AI)이 빠르게 파악할 수 있도록
- **변경점**:
  - `CLAUDE.md` — 프로젝트 개요, 스택, 아키텍처 설명, 문서화 규칙
  - `docs/architecture.md` — Hexagonal Architecture 상세 설명 + 프론트엔드 구조
  - `docs/tech-stack.md` — 기술 스택 버전 및 선택 이유
  - `docs/how-to-request.md` — Claude에게 효과적으로 요청하는 가이드

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| Spring Boot 버전 | 4.0.5 | 4.1은 아직 마일스톤(M4), 안정 버전 선택 |
| Vite 버전 | 8.0.8 | Rolldown 통합으로 빌드 10-30x 빨라짐 |
| Java 버전 관리 | gradle.properties + gitignore | JAVA_HOME(8)은 회사 프로젝트용으로 유지 |
| 설정 파일 포맷 | application.yml | 사용자 선호 |
| DB 마이그레이션 | Flyway + JDBC | R2DBC 미지원이라 마이그레이션 시에만 JDBC 사용 |
| Hexagonal Architecture | 채택 | 외부 의존성(lichess, chess.com, Stockfish, DB)이 많아 분리 필요 |
