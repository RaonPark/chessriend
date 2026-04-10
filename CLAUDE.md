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
- React: Functional components only, hooks 패턴
- 모든 비즈니스 로직은 테스트 필수
- 한국어 주석 허용, 코드는 영어

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
