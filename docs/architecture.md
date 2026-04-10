# Architecture Overview

## Backend: Hexagonal Architecture

### 왜 Hexagonal인가?

체스 리뷰 앱은 외부 의존성이 많다:
- chess.com API, lichess API (게임 가져오기)
- Stockfish 엔진 (분석)
- PostgreSQL (저장)
- 프론트엔드 REST API (입력/출력)

Hexagonal Architecture를 사용하면 이 외부 의존성들을 **인터페이스(Port)** 뒤에 숨길 수 있다.
도메인 로직은 "lichess에서 가져오는지 chess.com에서 가져오는지" 모른다.
새 체스 사이트가 추가되어도 Adapter만 하나 더 만들면 된다.

### 레이어 규칙

```
Domain ← Port ← Adapter
(안쪽)          (바깥쪽)
```

- **의존성 방향은 항상 안쪽으로.** Adapter → Port → Domain 순으로 의존.
- Domain은 Spring, DB, HTTP 등 외부 프레임워크를 절대 import하지 않는다.
- Port는 인터페이스만 정의한다.
- Adapter가 Port를 구현하고, Spring Bean으로 등록한다.

### 각 도메인 모듈 구조

```
game/
├── domain/              # 순수 Kotlin 클래스. 외부 의존성 zero.
│   ├── Game.kt          # 엔티티
│   ├── Move.kt          # 값 객체
│   └── Position.kt      # 값 객체 (FEN 기반)
│
├── application/         # UseCase 구현 (domain + port 사용)
│   └── ImportGameUseCase.kt
│
├── port/
│   ├── in/              # Inbound Port - UseCase 인터페이스
│   │   └── ImportGamePort.kt
│   └── out/             # Outbound Port - 외부 시스템 인터페이스
│       ├── GameRepository.kt
│       └── ChessGameClient.kt
│
└── adapter/
    ├── in/web/          # Inbound Adapter - REST Controller
    │   └── GameController.kt
    └── out/
        ├── persistence/ # Outbound Adapter - DB 구현
        │   └── R2dbcGameRepository.kt
        └── client/      # Outbound Adapter - 외부 API 구현
            ├── LichessClient.kt
            └── ChessComClient.kt
```

### 흐름 예시: "lichess에서 게임 가져오기"

```
GET /api/games/import?source=LICHESS&username=magnus

1. [GameController]       ← SSE (text/event-stream) 연결
2. [ImportGameService]    → ChessGameClient.fetchGames(criteria)
3. [LichessClient]        → lichess NDJSON API 호출 (application/x-ndjson)
4.                        ← 게임 1개씩 스트리밍 수신
5. [ImportGameService]    → existsBySourceGameId() 중복 체크
6.                        → save() DB 저장
7. [GameController]       → GameResponse 변환, SSE로 클라이언트에 전달
8.                        (4~7 반복, 게임마다 실시간 전달)
```

### SSE (Server-Sent Events) 스트리밍

게임 import는 **end-to-end 스트리밍** 구조:

```
lichess API          Backend                    Frontend
    │                    │                          │
    │──NDJSON 게임1──→  │                          │
    │                    │──중복체크──→ DB           │
    │                    │──save────→ DB            │
    │                    │──SSE event──────────→    │  ← 게임1 표시
    │──NDJSON 게임2──→  │                          │
    │                    │──중복체크──→ DB           │
    │                    │──(중복 skip)             │
    │──NDJSON 게임3──→  │                          │
    │                    │──save────→ DB            │
    │                    │──SSE event──────────→    │  ← 게임3 표시
    │                    │                          │
```

**왜 SSE인가:**
- WebFlux의 `Flow<T>` + `text/event-stream`으로 별도 라이브러리 없이 지원
- lichess NDJSON 스트리밍을 끊지 않고 클라이언트까지 전달
- 수백 게임 import 시 전체 완료 대기 없이 실시간 진행 표시 가능
- 서버→클라이언트 단방향 스트리밍에 적합 (GraphQL Subscription은 과도함)

**프론트엔드 연동 (추후):**
```typescript
const eventSource = new EventSource(
  '/api/games/import?source=LICHESS&username=magnus'
);
eventSource.onmessage = (event) => {
  const game = JSON.parse(event.data);
  // 게임 목록에 추가, 진행률 업데이트
};
eventSource.onerror = () => eventSource.close();
```

**curl 테스트:**
```bash
curl -N "http://localhost:8080/api/games/import?source=LICHESS&username=magnus&max=5"
```

## Frontend: Feature-based Structure

### 구조

```
frontend/src/
├── features/           # 기능 단위 폴더
│   ├── game/           # 게임 목록, 가져오기
│   ├── analysis/       # 엔진 분석 결과 표시
│   └── review/         # 리뷰 보드, 메모 작성
├── shared/             # 공유 컴포넌트, 훅, 유틸
│   ├── components/     # Button, Modal 등 공통 UI
│   ├── hooks/          # useApi, useChess 등 공통 훅
│   └── lib/            # API 클라이언트, 타입 정의
├── App.tsx
└── main.tsx
```

### 핵심 라이브러리

| 라이브러리 | 역할 | 설명 |
|-----------|------|------|
| **chess.js** | 체스 로직 | 수 이동 검증, FEN/PGN 파싱, 체크/체크메이트 판정 |
| **react-chessboard** | 보드 UI | 드래그앤드롭, 화살표, 하이라이트 지원 체스보드 컴포넌트 |

### chess.js 기본 사용법

```typescript
import { Chess } from 'chess.js'

// 새 게임 생성
const game = new Chess()

// PGN에서 게임 로드
game.loadPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6')

// 현재 보드 상태 (FEN)
game.fen() // → 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4'

// 수 이동
game.move('d4')
game.move({ from: 'e7', to: 'e5' })

// 기보 탐색 (undo/redo)
game.undo()

// 가능한 수 목록
game.moves() // → ['a3', 'b3', 'c3', ...]
```

### react-chessboard 기본 사용법

```tsx
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'

function ReviewBoard() {
  const [game, setGame] = useState(new Chess())

  function onPieceDrop(source: string, target: string) {
    const move = game.move({ from: source, to: target })
    if (move === null) return false // 불법 수
    setGame(new Chess(game.fen()))
    return true
  }

  return (
    <Chessboard
      position={game.fen()}
      onPieceDrop={onPieceDrop}
      boardWidth={560}
    />
  )
}
```
