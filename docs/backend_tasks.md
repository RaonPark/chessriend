# 백엔드 작업 후보

> 생성일: 2026-05-23
> 컨텍스트: feat/multi-improvements 브랜치 작업 중, 코드베이스 감사로 추린 백엔드 거리

마지막 PR들(jOOQ 도입, 로그 파이프라인, Brilliant 판정)이 큰 백엔드 변경을 끝낸 상태라 손댈 곳이 적어 보이지만, 실제로 남은 거리가 있다. 우선순위순.

---

## ★★★ 1. 분석 결과(GameAnalysis) DB 영속화

**문제**: Stockfish 분석 결과가 클라이언트 메모리에만 존재. 게임 상세 페이지 재방문 시 매번 재분석 → 깊이 18까지 전 수 평가 다시 돌려야 함.

**현재 상태**:
- 도메인 엔티티는 이미 있음: `src/main/kotlin/.../game/domain/Annotation.kt:20-32` (`GameAnalysisData`, `MoveEvaluationData`)
- DB 테이블 없음 — Flyway V1~V3 마이그레이션에 분석 테이블 부재
- `GameAnnotation`에 `analysis: GameAnalysisData?` 필드로 내포되어 있지만 영속화 경로 없음

**해야할 것**:
- [ ] Flyway V4 마이그레이션: `game_analyses` 테이블 + `move_evaluations` 테이블 (혹은 JSONB 단일 컬럼)
- [ ] `GameAnalysisRepository` (jOOQ DSL)
- [ ] `SaveGameAnalysisUseCase` / `GetGameAnalysisUseCase`
- [ ] `POST /api/games/{id}/analysis` (저장), `GET` 시 기존 분석 응답
- [ ] 프론트엔드: 페이지 로드 시 서버 분석 fetch → 없으면 클라이언트 분석 후 POST
- [ ] 테스트: Testcontainers로 저장/조회 라운드트립

**임팩트**: 사용자 경험 큰 개선. 재방문 즉시 분석 표시.

---

## ★★★ 2. Import N+1 쿼리 제거

**문제**: `ImportGameService.kt:36`의 `existsBySourceGameId(game.sourceGameId)`가 게임 1개당 1쿼리. 200게임 import 시 200개 추가 쿼리.

**현재 코드**:
```kotlin
val newGames = client.fetchGames(criteria)
    .filter { game -> !gameRepository.existsBySourceGameId(game.sourceGameId) }  // ← N+1
    .map { game -> game.copy(ownerUsername = criteria.username) }
```

**해야할 것**:
- [ ] `GameRepository.findExistingSourceGameIds(ids: Set<String>): Set<String>` 추가 (jOOQ)
- [ ] Flow를 chunk로 모은 뒤 한 번에 필터링하거나, fetch 후 in-memory 중복 제거
- [ ] 단, Lichess가 NDJSON 스트림이라 "다 받은 뒤 필터"는 메모리 부담 — chunk(50) 정도가 현실적
- [ ] 테스트: 중복 게임 mix된 상황에서 쿼리 횟수 검증

**임팩트**: 200게임 import 기준 DB 쿼리 ~200건 → ~4건. 큰 import에서 체감 빨라짐.

---

## ★★ 3. Import 관측성 메트릭

**문제**: Micrometer + Prometheus 의존성(`build.gradle.kts`)은 있지만 커스텀 메트릭 0개. 어떤 source가 자주 쓰이는지, 평균 import 게임 수, 실패율 모름.

**해야할 것**:
- [ ] `ImportGameService.onCompletion`에 후킹:
  ```kotlin
  meterRegistry.counter(
      "games_imported_total",
      "source", source.name,
      "result", if (cause == null) "success" else "aborted"
  ).increment(saved.toDouble())
  ```
- [ ] `Timer`로 import 소요 시간 측정
- [ ] Grafana 대시보드에 패널 추가 (기존 모니터링 보드 확장)

**임팩트**: 운영 가시성. Import 실패율/소요시간 추세 관측.

---

## ★★ 4. R2dbcGameRepository → jOOQ 통합

**현재 상태**: 절반만 전환됨
- `GamePersistenceAdapter.kt:58-76` — jOOQ DSL 사용
- `R2dbcGameRepository.kt` — Spring Data 인터페이스 메서드명 기반

**해야할 것**:
- [ ] `R2dbcGameRepository`의 메서드들 (`findById`, `existsBySourceGameId` 등)을 jOOQ DSL로 통합
- [ ] 단일 Adapter로 일관화 → 스키마 변경 시 컴파일 타임 안전성 확보 (jOOQ 코드 생성 활용)

**임팩트**: 일관성. 코드 리뷰 부담 감소. 단, 동작 변경 없음 → 우선순위 낮음.

---

## ★ 5. 배치 분석 mate=0 부호 손실 보정

**문제**: 프론트엔드 EvalBar에서 잡은 `mate=0` 시 부호 손실(useStockfish 측 수정 완료) 이슈가, 배치 분석(`useBatchAnalysis`)에서도 동일하게 존재. 마지막 수가 체크메이트인 게임의 classification이 어긋날 가능성.

**현재 코드**: `useBatchAnalysis.ts:75` `rawEval.mate * flip` — mate=0이면 부호 사라짐

**해야할 것**:
- [ ] 백엔드에서 분석 결과를 받을 때 (위 ★★★ 1번과 묶어서) winner 정보 함께 저장
- [ ] 또는 프론트 배치 분석에서도 useStockfish와 동일한 mateWinner 패턴 적용

**임팩트**: 마지막 수 classification이 더 정확해짐. 매우 좁은 케이스.

---

## 권장 진행 순서

1. **★★★ 1번 (분석 영속화)** — 가장 큰 사용자 임팩트. 1번 PR은 마이그레이션 + Repository + UseCase까지, 프론트 통합은 후속 PR로 분리해도 좋음.
2. **★★★ 2번 (N+1 제거)** — 작고 명확한 win. 1번과 별개 PR.
3. **★★ 3번 (메트릭)** — Grafana 보드 작업과 묶어서.
4. 나머지는 여유 있을 때.
