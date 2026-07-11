# game.port

## 역할

도메인/애플리케이션과 외부 세계 사이의 **경계 인터페이스(Ports)**. 구현은 `adapter`에, 사용은 `application`에 있다. 포트 자체는 인터페이스만 정의하며 프레임워크에 의존하지 않는다.

- **`in/`** — Inbound Port: 애플리케이션이 제공하는 UseCase 계약. Controller가 호출.
- **`out/`** — Outbound Port: 애플리케이션이 필요로 하는 외부 능력. 어댑터가 구현.

## port/in (UseCase 인터페이스)

| 인터페이스 | 대표 메서드 | 역할 |
| --- | --- | --- |
| `ImportGameUseCase` | `importGames(source, criteria): Flow<Game>` | 외부 API에서 게임 가져와 저장(스트리밍) |
| `CreateGameFromPgnUseCase` | `createFromPgn(command): Game` (`suspend`) | PGN 붙여넣기로 게임 생성. `CreateGameFromPgnCommand` 입력 |
| `GetGameUseCase` | `getGame`, `getGames(page,size,source?,timeCategory?)`, `deleteGame`/`deleteGames`/`deleteAllGames`, `updateAnnotations` | 조회·페이징·삭제·주석 갱신 |
| `GetGameAnalysisUseCase` | `getAnalysis(gameId)`, `findAnalysis(gameId)` | 분석 조회(strict / nullable) |
| `RunGameAnalysisUseCase` | `runAnalysis(gameId): Flow<AnalysisProgress>` | 백엔드 Stockfish 분석 실행(진행률 스트림) |
| `SaveGameAnalysisUseCase` | `saveAnalysis(gameId, analysis): GameAnalysisData` (`suspend`) | 분석 결과 저장 |

> 페이징/필터 입력은 `GameFetchCriteria`(username, since/until, max, timeCategory, rated, color, vs) 등 포트와 같은 위치의 DTO를 사용한다.

## port/out (외부 의존 인터페이스)

| 인터페이스 | 대표 메서드 | 구현 어댑터 |
| --- | --- | --- |
| `GameRepository` | `save`, `findById`, `findAll(...): Flow<Game>`, `count`, `existsBySourceGameId`, `updateAnnotations`, `delete*` | `persistence/GamePersistenceAdapter` |
| `GameAnalysisRepository` | `save(gameId, analysis)`, `findByGameId`, `existsByGameId`, `deleteByGameId` | `persistence/GameAnalysisPersistenceAdapter` |
| `ChessGameClient` | `fetchGames(criteria): Flow<Game>`, `source: GameSource` | `client/LichessClient`, `client/ChessComClient` |
| `ChessRules` | `parsePgn(pgn): ParsedPgn`, `reconstructFens(sans)`, `analyzeMove(fen, san): MoveContext?` | `chess/ChesslibAdapter` |
| `ChessEngine` | `evaluate(fen, depth): EvalScore` (`suspend`) | `engine/StockfishEngineAdapter` |

## 주요 흐름

1. Controller → `port/in` UseCase 호출 → 애플리케이션 서비스가 구현.
2. 서비스 → `port/out` 호출 → 어댑터가 DB/외부 API/엔진/체스 규칙으로 변환.

`ChessGameClient`는 `source` 프로퍼티로 자기 출처를 노출 → `ImportGameService`가 여러 구현 중 알맞은 클라이언트를 선택한다(새 플랫폼은 어댑터만 추가).

## 변경 시 주의사항

- **인터페이스 변경의 파급**: 시그니처를 바꾸면 모든 구현 어댑터 + 호출 서비스가 동시에 영향받는다. 도메인 타입(`Flow<Game>`, `EvalScore` 등)만 노출하고 프레임워크 타입을 끌어들이지 말 것.
- **반환 타입 계약**: `findAnalysis`(nullable)와 `getAnalysis`(예외)처럼 null 정책이 메서드별로 다르다 — 새 메서드 추가 시 명확히.
- 새 외부 연동은 `port/out`에 능력을 먼저 정의하고 어댑터를 구현하는 순서를 지킨다.
