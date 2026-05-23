# Chessriend - Chess Game Review App

chess.com / lichess.org에서 자신의 게임을 PGN으로 가져와 분석하고, 메모를 작성할 수 있는 체스 리뷰 앱.
"내 게임이니까 더 애정을 가질 수 있게" 만드는 것이 핵심 철학.

## Tech Stack

- **Backend**: Kotlin 2.3.20 + Spring Boot 4.0.5 (Java 25), WebFlux + Coroutines
- **Frontend**: React 19.2.5 + TypeScript 6.0.2 + Vite 8.0.8 + Tailwind CSS
- **Database**: PostgreSQL (R2DBC) + jOOQ (type-safe SQL builder)
- **Build**: Gradle 9.4.1 (Kotlin DSL) / pnpm 10.33.0
- **Chess**: chess.js + react-chessboard + Stockfish (UCI)

## Behavioral Rules

- State assumptions explicitly before implementing. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- Ambiguous scope? Ask whether it's backend (Kotlin), frontend (React), or both.
  - Layer keywords: "도메인"→`domain/`, "유스케이스"→`application/`, "포트"→`port/`, "컨트롤러/API"→`adapter/in/web/`, "레포지토리/DB"→`adapter/out/persistence/`, "클라이언트/외부API"→`adapter/out/client/`
- If a simpler approach exists, say so. Push back when warranted.
- Transform tasks into verifiable goals:
  - "Fix bug" → "Write reproducing test → make it pass"
  - "Add feature" → "Write test → implement → verify pass"
- Multi-step tasks, plan first:
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]

## Architecture: Hexagonal (Ports & Adapters)

Domain은 외부 의존성 zero. 의존 방향은 항상 바깥 → 안쪽.

```
game/
├── domain/           # 엔티티, 값 객체 (순수 비즈니스 로직)
├── application/      # UseCase 구현
├── port/
│   ├── in/           # UseCase 인터페이스
│   └── out/          # Repository, Client 인터페이스
└── adapter/
    ├── in/web/       # REST Controller
    └── out/
        ├── persistence/  # R2DBC Repository
        └── client/       # 외부 API 클라이언트
```

Shared code: `shared/` (공통 설정, 예외, 유틸)

## Architecture Principles

1. **Reactive-first**: WebFlux + Coroutines, non-blocking I/O
2. **Hexagonal dependency rule**: Domain has zero external deps
3. **Optimistic locking**: `@Version` for concurrent modification
4. **Immutable entities**: `data class` + `val`, state change via `copy()`

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

## Development Checklist

각 도메인 기능 개발 시:
- [ ] Domain (엔티티, 값 객체)
- [ ] Port out (Repository, Client 인터페이스)
- [ ] Port in (UseCase 인터페이스)
- [ ] Application (UseCase 구현, `@Transactional`)
- [ ] Adapter out/persistence (R2DBC Repository + Flyway 마이그레이션)
- [ ] Adapter out/client (외부 API 클라이언트)
- [ ] Adapter in/web (Controller, `suspend` 함수)
- [ ] DTO (Request/Response)
- [ ] Exception (커스텀 예외 클래스 in `shared/exception/`)
- [ ] Test (Kotest + MockK, Testcontainers)
- [ ] `application.yml` 설정 추가
- [ ] `docs/` 작업 내역 문서

## Code Conventions

- 한국어 주석 허용, 코드(변수명, 함수명, 클래스명)는 영어
- 모든 비즈니스 로직은 테스트 필수
- Detailed conventions: see `.claude/rules/` (loaded per file type)

## Domain Glossary

- **PGN**: Portable Game Notation — 체스 기보 표준 포맷
- **FEN**: Forsyth-Edwards Notation — 체스 보드 상태 표현
- **UCI**: Universal Chess Interface — 체스 엔진 통신 프로토콜
- **Evaluation**: 엔진이 판단한 포지션 점수 (centipawn 단위)
- **Blunder/Mistake/Inaccuracy**: 실수 등급 (큰 실수/실수/부정확)
