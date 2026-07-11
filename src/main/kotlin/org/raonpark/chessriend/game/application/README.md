# game.application

## 역할

`port/in`의 UseCase 인터페이스를 구현하는 **애플리케이션 서비스** 계층. 도메인 로직을 조립(orchestrate)하고 `port/out`(Repository·Client·Engine·Rules)을 통해 외부와 통신한다. 전부 `@Service` + **생성자 주입**(포트 인터페이스에만 의존, 구현체 직접 주입 금지).

## 주요 구성요소

| 파일 | 구현 UseCase | 핵심 동작 |
| --- | --- | --- |
| `ImportGameService.kt` | `ImportGameUseCase` | 소스에 맞는 `ChessGameClient` 선택 → `Flow<Game>` 중복 제거(`existsBySourceGameId`) + `max` 제한 → 저장. Flow 취소가 상류 WebClient까지 전파 |
| `CreateGameFromPgnService.kt` | `CreateGameFromPgnUseCase` | PGN 문자열 → `ChessRules.parsePgn` → `TimeControl` 추정 → `Game` 생성·저장. 복수 게임/`SetUp`·FEN 태그는 거절 |
| `GetGameService.kt` | `GetGameUseCase` | 조회(없으면 `GameNotFoundException`)·삭제·일괄/전체 삭제·페이지 조회(offset/limit, `PagedResult`)·주석 업데이트 |
| `RunGameAnalysisService.kt` | `RunGameAnalysisUseCase` | **분석 오케스트레이션**(아래) |
| `GetGameAnalysisService.kt` | `GetGameAnalysisUseCase` | `getAnalysis`(없으면 예외) / `findAnalysis`(없으면 null) 두 계약 제공 |
| `SaveGameAnalysisService.kt` | `SaveGameAnalysisUseCase` | 게임 존재 확인 후 `GameAnalysisRepository`에 위임 저장 |

## 주요 흐름 — `RunGameAnalysisService`

`flow { }` 빌더로 진행률을 스트리밍한다.

1. 게임 조회 → `ChessRules.reconstructFens`로 SAN을 FEN 배열로 재구성(부분 재생 시 warn 로그)
2. 각 포지션을 `ChessEngine.evaluate(fen, depth)`로 평가하며 `AnalysisProgress.Progress(current, total)` emit
3. `ChessRules.analyzeMove`로 희생 컨텍스트 계산 → `GameAnalyzer`/`MoveClassifier`로 수별 분류
4. `GameAnalysisRepository.save` 후 `AnalysisProgress.Completed(analysis)` emit
5. 긴 루프에서 `ensureActive()`로 취소 신호를 확인(취소 시 즉시 중단)

## 데이터 접근

- 직접 SQL/jOOQ 없음 — 전부 `port/out` 인터페이스 경유(`GameRepository`, `GameAnalysisRepository`, `ChessGameClient`, `ChessEngine`, `ChessRules`).
- **트랜잭션**: `@Transactional` 미사용. 현재 UseCase는 단일 저장 또는 원자적 UPSERT 위주라 명시적 트랜잭션 경계가 없다. 한 UseCase에서 다중 쓰기 일관성이 필요해지면 트랜잭션 경계를 추가해야 한다.
- **비동기**: 순차 작업은 평범한 `suspend fun`, 스트리밍은 `Flow`. 병렬이 필요하면 `coroutineScope { async {} }`(현재는 미사용).

## 예외 처리

- 서비스는 `shared/exception`의 커스텀 예외를 **throw**한다(`GameNotFoundException`, `GameAnalysisNotFoundException`, `ConflictException` 등). `ResponseEntity` 반환 금지 — HTTP 매핑은 `GlobalExceptionHandler`가 담당.

## 변경 시 주의사항

- **포트에만 의존**: 구현 어댑터를 직접 주입하지 말 것.
- **취소 전파**: `CancellationException`을 삼키지 말고 rethrow, 장기 루프엔 `ensureActive()`.
- **import `max` 시맨틱**: 제한은 **중복 제거 후** 적용된다(가져온 게임 수가 아니라 신규 저장 기준). 변경 시 의도 확인.
- 새 UseCase 추가 시 `docs/{브랜치}_작업내역.md`에 What/Why 기록(`.claude/rules/docs.md`).
