# master — 프로젝트 초기 설정

## 2026-06-03: GameDetailPage 정렬 수정 + 플랫폼 라벨

### What
`frontend/src/features/game/components/GameDetailPage.tsx` 게임 정보 카드의 정렬과 플랫폼 표기 수정.

1. **대국자 헤더 정렬**
   - `flex items-center justify-center gap-10` → `grid grid-cols-[1fr_auto_1fr] items-start gap-4 sm:gap-10`로 교체.
   - 각 플레이어 컬럼을 `text-center` → `flex flex-col items-center text-center`로 감쌈. `vs`는 `pt-3`로 King 사진 중앙 부근에 맞춤.
2. **승리/패배 텍스트**: 기존 `text-center` 유지 (변경 없음).
3. **메타 정보 + 대국 날짜**
   - 별도 하단 줄로 분리돼 있던 대국 날짜를 메타 그리드 안의 라벨 셀("대국 날짜")로 통합. 기존 중앙정렬 `<p>` 제거.
   - 그리드 열 수를 반응형으로: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
4. **플랫폼 표기**: `game.source` 원형 enum(`CHESS_COM`/`LICHESS`) 대신 표시명으로 매핑.
   - 파일 상단에 `SOURCE_LABELS: Record<GameSource, string> = { CHESS_COM: 'Chess.com', LICHESS: 'lichess' }` 추가, `import type { GameSource } from '../types/game'` 추가.
   - 플랫폼 셀 `{game.source}` → `{SOURCE_LABELS[game.source]}`.

### Why
- Safari에서 닉네임 길이가 다르면 `items-center` 탓에 두 King 사진이 서로 다른 높이로 어긋나고, raw inline `<svg>`(ChessKing은 className 미지원)가 `text-center`만으로는 가로 중앙정렬이 불안정했음.
  - `grid-cols-[1fr_auto_1fr]`로 양쪽 컬럼 폭 동일·`vs` 가운데 고정, `items-start`로 King 사진을 같은 상단 높이 정렬, `flex flex-col items-center`로 inline SVG·닉네임·ELO 가로 중앙정렬. ChessKing 컴포넌트는 수정하지 않고 래퍼 flex로 해결.
- 대국 날짜를 나머지 메타와 한 흐름으로 두자는 요구. 반응형 열 수로 충족: 넓은 화면(lg≥1024) 5열 한 줄 / 중간(sm 640~1024) 3열 → 윗줄 플랫폼·시간제한·오프닝, 아랫줄 총 수·대국 날짜(요청한 fallback) / 모바일 2열.
- 플랫폼은 보기 좋은 표기(`Chess.com`, `lichess`) 요구. 중앙 매핑 유틸이 없어 `OUTCOME_LABELS` 패턴을 따라 같은 파일 상수로 추가.
- 제약(표출 텍스트 유지) 준수: 텍스트 삭제 없음(날짜는 위치 이동 + "대국 날짜" 라벨 추가, 플랫폼은 표기만 변환).

### Key modified files
- `frontend/src/features/game/components/GameDetailPage.tsx`

### 검증
- `pnpm tsc --noEmit` 통과 (exit 0).
- Playwright 동작 확인 (스크린샷 `docs/test-screenshots/`):
  - `gamedetail-wide.png`(1280px): 메타 5개 한 줄, King 정렬·중앙정렬, 플랫폼 "Chess.com".
  - `gamedetail-medium-820.png`(820px): 메타 3+2 줄바꿈.
  - `gamedetail-mobile-390.png`(390px): 메타 2열.
  - `gamedetail-longname.png`: 55자 긴 닉네임 주입 시에도 두 King top 동일(180/180), King 중앙 X = 닉네임 중앙 X(324/324).
  - 콘솔 에러 0건.

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