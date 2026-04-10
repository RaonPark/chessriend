# Chessriend - Chess Game Review App

## Purpose
chess.com / lichess.org에서 자신의 체스 게임을 PGN으로 가져와 분석하고, 메모를 작성할 수 있는 체스 리뷰 앱.
"내 게임이니까 더 애정을 가질 수 있게" 만드는 것이 핵심 철학.

## Tech Stack
- **Backend**: Kotlin 2.3.20 + Spring Boot 4.0.5 (Java 25, Corretto 25.0.1)
- **Frontend**: React 19.2.5 + TypeScript 6.0.2 + Vite 8.0.8
- **Database**: PostgreSQL (R2DBC for reactive)
- **Build**: Gradle 9.4.1 (Kotlin DSL) / pnpm 10.33.0
- **Chess Libraries**: chess.js 1.4.0 + react-chessboard 5.10.0
- **Chess Engine**: Stockfish (UCI protocol)
- **WebFlux + Coroutines**: suspend fun + Flow 기반 비동기 처리

## Architecture
- Backend: Hexagonal Architecture (Ports & Adapters)
- Frontend: Feature-based folder structure
- API: RESTful with OpenAPI spec (SpringDoc 3.0.1)

## Project Structure
```
chessriend/
├── src/main/kotlin/org/raonpark/chessriend/   # Backend
│   ├── game/          # 게임 가져오기 & PGN 파싱 (hexagonal)
│   ├── analysis/      # 엔진 분석 (hexagonal)
│   ├── review/        # 리뷰 & 메모 (hexagonal)
│   └── shared/        # 공통 설정, 예외
├── src/main/resources/
│   ├── application.yml
│   └── db/migration/
├── frontend/          # React + TypeScript + Vite
│   └── src/
│       ├── features/game, analysis, review
│       └── shared/
├── docs/              # 작업 내용 정리 문서
├── build.gradle.kts
└── CLAUDE.md
```

Each hexagonal module has: domain/, application/, port/in/, port/out/, adapter/in/web/, adapter/out/persistence/, adapter/out/client/
