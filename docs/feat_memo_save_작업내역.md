# feat/memo_save 작업 내역

## 무엇을 했나

분석된 게임에 작성한 메모(annotations)가 DB에 저장되지 않던 버그를 진단하고 수정. `GamePersistenceAdapter.bindQuery`가 jOOQ의 `JSONB` 파라미터를 r2dbc-postgresql `DatabaseClient`에 그대로 bind하던 부분을, r2dbc 코덱이 인식하는 `io.r2dbc.postgresql.codec.Json`으로 변환하도록 통일.

## 왜

`feat/memo_save` 브랜치에서 메모/변형선 저장 경로 (`PUT /api/games/{id}/annotations` → `GetGameService.updateAnnotations` → `GamePersistenceAdapter.updateAnnotations`)는 모두 깔려 있었으나, 실제로 사용자가 메모를 작성하고 GameViewer의 "저장 (Ctrl+S)" 까지 눌러도 DB의 `games.annotations` JSONB 컬럼이 갱신되지 않는 보고가 있었다.

진단 결과:

1. `psql`로 DB 직접 확인: 전체 200개 게임 모두 `annotations`가 기본값(`{"moveComments":{},"variations":[]}` 또는 키 순서만 다른 빈 객체) — **DB에 저장된 메모 0건**.
2. 코드 점검 결과 `GamePersistenceAdapter.updateAnnotations`는 jOOQ DSL로 `JSONB.jsonb(json)` 을 SET 절에 넣고, `bindQuery`가 `param.value!!` (즉 `org.jooq.JSONB` 인스턴스)를 그대로 R2DBC `DatabaseClient.bind`에 넘기는 구조였다.
3. **r2dbc-postgresql 코덱은 `org.jooq.JSONB` 타입을 모른다** — silent fail 또는 잘못된 인코딩으로 UPDATE가 무효화됨.
4. 결정적 단서: 같은 패키지의 `GameAnalysisPersistenceAdapter.bindQuery`(89-101줄)에 이미 동일 문제에 대한 변환이 들어가 있었다:

   ```kotlin
   // R2DBC Postgres 코덱은 jOOQ의 JSONB 타입을 직접 인코딩하지 못함 → R2DBC의 Json 으로 변환
   is JSONB -> Json.of(v.data())
   ```

   `game_analyses` 어댑터에는 적용된 변환이 `games` 어댑터에는 누락되어 있었던 게 진짜 원인.

## 주요 변경

### 백엔드: bindQuery JSONB 코덱 통일
- `src/main/kotlin/org/raonpark/chessriend/game/adapter/out/persistence/GamePersistenceAdapter.kt`
  - `bindQuery` (118-128줄)에 jOOQ `JSONB` → r2dbc-postgresql `Json.of(v.data())` 변환 추가. `GameAnalysisPersistenceAdapter.bindQuery`와 동일한 패턴.
  - 이 변환은 SET 절뿐 아니라 WHERE/SELECT의 JSONB 비교에도 안전 — 두 어댑터 간 동작이 완전히 일치.

```kotlin
private fun bindQuery(query: org.jooq.Query): DatabaseClient.GenericExecuteSpec {
    val sql = query.getSQL(ParamType.NAMED)
    var spec = databaseClient.sql(sql)
    query.params.entries.forEachIndexed { index, (_, param) ->
        // R2DBC Postgres 코덱은 jOOQ의 JSONB 타입을 직접 인코딩하지 못함 → R2DBC의 Json 으로 변환
        val value = when (val v = param.value!!) {
            is JSONB -> Json.of(v.data())
            else -> v
        }
        spec = spec.bind(index, value)
    }
    return spec
}
```

### 검증
- `./gradlew compileKotlin` 성공
- `./gradlew test --tests "...GamePersistenceAdapterTest"` 통과 (회귀 없음)
- DB 확인 명령:

  ```bash
  docker exec -i chessriend-db psql -U chessriend -d chessriend -c \
    "SELECT id, jsonb_pretty(annotations) FROM games \
     WHERE annotations -> 'moveComments' <> '{}'::jsonb \
     ORDER BY imported_at DESC LIMIT 5;"
  ```

## 주요 결정과 이유

| 결정 | 이유 |
|---|---|
| `GamePersistenceAdapter` 전용 패치가 아닌 공통 `bindQuery`에 변환 추가 | 향후 다른 update/select 쿼리에서도 JSONB 컬럼이 늘 수 있고, 같은 헬퍼를 통과시키는 한 자동으로 안전. 호출처별 분기보다 단일 진입점에서 처리하는 게 일관됨. |
| jOOQ DSL 구조 유지 (raw SQL로 다운그레이드 X) | 컴파일 타임 스키마 검증(jOOQ generateJooq) 이점을 포기할 이유 없음. 진짜 문제는 R2DBC bind 단계의 타입 누락이었지 jOOQ DSL 자체가 아니다. |
| `GameAnalysisPersistenceAdapter`와 같은 변환 패턴 차용 | 이미 동일 문제에 대한 검증된 해결책이 옆 파일에 존재. 새 패턴 도입 대신 기존 패턴으로 통일해 인지 부하 최소화. |
| `rowsUpdated == 0` 가드는 이번 PR 범위 밖 | `GetGameService.updateAnnotations`(41-45)가 `findById`로 사전 존재 검증을 하고 있어 현실적 TOCTOU만 남은 상태. 후속 개선 사항으로 분리. |
| 프론트 `onError` 핸들러 추가는 별도 작업으로 분리 | 본 PR은 root cause fix에 집중. UX 개선(저장 실패 토스트)은 follow-up. |

## 진단 과정 기록

1. **사용자 보고**: "분석한 게임에 메모가 저장되지 않는 것 같다"
2. **2단계 저장 흐름** 확인 (CommentPanel "저장" → Zustand 메모리 / GameViewer "저장 (Ctrl+S)" → 백엔드 PUT). 사용자가 양쪽 모두 클릭했음을 확인 → UX 가설 배제.
3. **코드 흐름 점검**: 프론트 호출 경로, 백엔드 컨트롤러/서비스/어댑터, Flyway 마이그레이션 모두 정합. `awaitSingle()` 까지 await됨.
4. **DB 직접 확인** (`docker exec` + `psql`):
   - `SELECT count(*) FILTER (WHERE annotations::text <> '{...}') FROM games;` → 200/200 (모두 비기본값으로 보이지만 키 순서 차이일 뿐 빈 객체)
   - `jsonb_pretty(annotations)` 출력: 모두 `{"variations": [], "moveComments": {}}`
   - → DB에 진짜로 저장된 메모 0건.
5. **두 JSONB 저장 패턴 비교**:
   - `save()` 패턴은 R2dbcGameRepository 경유 → r2dbc 코덱이 직접 `Json` 처리 → 정상.
   - `updateAnnotations()` 패턴은 jOOQ DSL → `bindQuery` → R2DBC bind → jOOQ JSONB 타입이 그대로 전달됨 → 비정상.
6. **결정적 증거**: `GameAnalysisPersistenceAdapter`에 이미 동일 변환이 적용되어 있음을 발견.
7. **수정**: 누락된 변환 1줄 추가.

## 핵심 파일

- `src/main/kotlin/org/raonpark/chessriend/game/adapter/out/persistence/GamePersistenceAdapter.kt`
- (참고) `src/main/kotlin/org/raonpark/chessriend/game/adapter/out/persistence/GameAnalysisPersistenceAdapter.kt` — 통일 대상 패턴

## 추가 변경: CommentPanel 저장 즉시 영속화 (UX 개선)

### 무엇을

CommentPanel의 "저장" 버튼을 누르면 **즉시 백엔드 PUT까지 전송**되도록 변경. 기존엔 1단계(메모 패널 저장 → Zustand 메모리만 반영) + 2단계(우상단 "저장 (Ctrl+S)" → 백엔드 PUT)로 분리돼 있어 사용자가 2단계를 놓치면 메모가 휘발하는 혼동이 있었다.

### 왜

근본 원인(jOOQ JSONB bind) 수정 후 Playwright로 검증하던 중 사용자가 UX 개선을 요청. "메모 패널 안의 저장"이라는 동일 단어가 시각적으로 동등하게 보임에도 실제 동작이 다른 점이 직관에 어긋났다. 메모는 의도적 편집이지만 "방금 적은 한 줄"을 즉시 서버로 보내는 모델이 자연스럽다. 우상단 "저장 (Ctrl+S)" 버튼은 변형선(`saveCurrentVariation`/`deleteSavedVariation`) 같은 다른 dirty 흐름을 위해 유지.

### 주요 변경

- `frontend/src/features/game/components/CommentPanel.tsx`
  - `interface CommentPanelProps { onPersist?: () => void; isPersisting?: boolean }` 신설.
  - `handleSave()` 끝에 `onPersist?.()` 호출 — `setMoveComment`/`setVariationMoveComment` 직후 Zustand가 동기 반영하므로, 같은 tick에 `getAnnotationsSnapshot()`이 최신 값 반환.
  - 저장 버튼에 `disabled={isPersisting}` + 라벨 `저장 중...` 표시로 더블 클릭 방지.

- `frontend/src/features/game/components/MoveList.tsx`
  - `interface MoveListProps { onPersist?: () => void; isPersisting?: boolean }` 신설, `<CommentPanel onPersist={onPersist} isPersisting={isPersisting} />`로 전달.

- `frontend/src/features/game/components/GameViewer.tsx`
  - `<MoveList onPersist={onSaveAnnotations} isPersisting={isSaving} />` — 이미 GameDetailPage에서 받고 있던 `onSaveAnnotations`/`isSaving`을 그대로 흘려보냄. 새 mutation 도입 없음.

### 테스트

`frontend/src/features/game/components/__tests__/CommentPanel.test.tsx`
- `저장 클릭 시 onPersist 콜백을 호출한다` — 신규.
- `isPersisting=true일 때 저장 버튼이 비활성화되고 라벨이 바뀐다` — 신규.
- 145개 테스트 전체 통과 (회귀 없음).

### Playwright 검증

1. `/games/280548918700277760` 진입 → 2.Nc3에 메모 작성 → CommentPanel "저장" **한 번만** 클릭.
2. Network: `PUT /api/games/280548918700277760/annotations` → 200 OK.
3. DB:
   ```
   moveComments: {
     "0": "테스트 메모 (Playwright 검증) — 2026-05-30",
     "2": "UX 개선 후 단일 클릭 검증 — 2026-05-30"
   }
   ```
   우상단 "저장 (Ctrl+S)" 버튼을 누르지 않고도 영속화 확인.

### 주요 결정과 이유

| 결정 | 이유 |
|---|---|
| `onPersist` prop을 CommentPanel → MoveList → GameViewer로 drilling (한 단계 추가) | GameViewer가 이미 `onSaveAnnotations`를 받고 있어서, mutation을 CommentPanel에서 새로 만들 필요 없음. drilling 한 단계는 추가됐지만 의도가 명확하고 테스트도 mock으로 깔끔. |
| 우상단 "저장 (Ctrl+S)" 버튼 유지 | 변형선 저장 같은 다른 dirty 흐름이 여전히 명시적 저장에 의존. 제거하면 변형선 작업 시 영속화 트리거가 사라짐. |
| `isPersisting`으로 더블 클릭 방지 | mutation pending 중 동일 메모 다시 저장 누르면 무해하지만, 버튼이 disabled가 아니면 사용자 피드백이 없어 혼란 — 기존 우상단 버튼과 동일 패턴. |
| 자동 저장(debounce) 채택 안 함 | "한 글자마다 저장"은 PUT 폭주 + 의도하지 않은 메모 commit 위험. 명시적 "저장" 클릭 시점에만 동기화하는 게 사용자 의도와 일치. |

## 추가 변경: 변형선 진입 시 EvalBar 멈춤 fix

### 무엇을

`useStockfish`의 `bestmove` 핸들러에서 `setIsEvaluating(false)`를 `latestInfoRef.current` 가드 안으로 이동. 직전 `evaluate()`가 보낸 `stop`에 대한 응답으로 도착한 빈 bestmove를 명시적으로 무시.

### 왜

사용자 보고: **변형선 진입 직후 EvalBar가 흑백 50:50 + 빈 숫자(또는 0.0)로 멈춰버린다**. Playwright + 콘솔 trace로 재현 시도 시 일반 흐름은 정상이었지만, 다음 race condition으로 50:50 멈춤이 가능하다는 분석:

1. 사용자가 cached 메인라인 수에 머무름 → `useStockfish.evaluate`가 한 번도 호출되지 않음 → `evaluation` state는 useState 초기값 `null`
2. 변형선 진입 → `cachedEvaluation=null` → `displayEvaluation = null ?? evaluation = null` → EvalBar 50:50 + 빈 텍스트
3. `evaluate(varFen)` 호출 → `engine.uci('stop')` + 새 `position`+`go` + `setIsEvaluating(true)`
4. **stop에 대한 빈 bestmove가 도착** → `latestInfoRef.current=null`이라 `setEvaluation` 호출 안 되지만 **`setIsEvaluating(false)`는 무조건 호출되어 isEvaluating이 false로 떨어짐**
5. 새 search의 첫 `info`가 도착하기 전 짧은 시간 동안 `evaluation=null`, `isEvaluating=false` → EvalBar의 표시 조건(`isEvaluating && !evaluation ? '...' : formatEval(evaluation)`)이 `formatEval(null) = ''`로 떨어져 **빈 숫자 50:50 상태로 멈춤**
6. 일반적으로는 곧 첫 info가 도착해 갱신되지만, 어떤 이유로 늦거나 안 오면 멈춤이 지속됨

### 주요 변경

`frontend/src/features/game/hooks/useStockfish.ts`:

```ts
if (line.startsWith('bestmove')) {
  // 최종 결과 확정 — latestInfoRef가 비어있으면 직전 evaluate()가 보낸 stop에 대한
  // 응답으로 도착한 빈 bestmove. 이걸 처리하면 새로 시작한 search의 isEvaluating을
  // 잘못 false로 떨어뜨려 EvalBar가 50:50 + 빈 숫자로 멈춰 보인다.
  if (latestInfoRef.current) {
    setEvaluation({ ...latestInfoRef.current })
    setIsEvaluating(false)
  }
}
```

- 정상 분석 완료(latestInfoRef truthy) → 결과 반영 + isEvaluating=false
- stop bestmove(latestInfoRef=null) → 무시. 새 search 진행 중이므로 isEvaluating 그대로 유지

### Playwright 검증

분기점(Nc3)에서 d7→d5로 변형선 진입 시 EvalBar:

| 시점 | EvalBar |
|---|---|
| 분기점 cached | Depth 18 / 0.4 |
| 변형선 진입 직후 | 0.4 유지 |
| +80ms | 0.4 유지 |
| +380ms | Depth 16 / **1.1** (라이브 결과 반영) |
| +1.9s | Depth 18 / 1.1 (depth 18 도달) |

이전 값에서 새 값으로 자연스럽게 전환 — 50:50 + 빈 숫자 멈춤 상태가 한 번도 관찰되지 않음. 145개 frontend 테스트 전체 통과.

### 주요 결정과 이유

| 결정 | 이유 |
|---|---|
| `latestInfoRef` 가드 안에서만 `setIsEvaluating(false)` | 빈 bestmove를 의도적으로 무시. 새 search가 어차피 자체 bestmove를 보내 정상 종료. 가장 작은 수술. |
| `setEvaluation(null)` 강제 reset 안 함 | 매 evaluate마다 EvalBar가 깜빡이는 부수 효과를 피함. 이전 값을 잠시 유지하는 게 시각적으로 안정적. |
| Stop 명령 자체는 유지 | 진행 중이던 search가 있을 때 중단해야 새 search가 빠르게 시작됨. stop 자체를 제거하면 엔진 큐가 길어져 응답 지연. |

## 후속 작업 (별도 PR)

- **프론트 `onError` 핸들러 추가**: `GameDetailPage.handleSaveAnnotations`에 실패 시 인라인 배너 표시 — 기존 `analysisSaveMessage` 패턴 차용. 향후 같은 버그 재발 시 사용자가 즉시 인지 가능.
- **`rowsUpdated == 0` 가드 추가**: TOCTOU(존재 검증 후 다른 트랜잭션이 삭제) 대비. 현재는 silent no-op으로 끝남.
- **`bindQuery` 공통 유틸 추출**: `GamePersistenceAdapter` / `GameAnalysisPersistenceAdapter` 양쪽에 동일 로직 중복. `shared/` 또는 어댑터 베이스 클래스로 추출 검토.
- **변형선 저장도 즉시 영속화 검토**: `saveCurrentVariation` / `deleteSavedVariation` 액션 직후에도 `onPersist` 호출 — 현재는 우상단 버튼 의존.
- **EvalBar에 라이브 분석 인디케이터 추가**: 변형선 같은 라이브 평가 중에는 `isEvaluating` 표시(작은 dot/오버레이 등)를 EvalBar에 더해 "분석 중"임을 명시. 현재는 옛 값이 그대로 보여 사용자가 멈춘 것으로 오인할 수 있음.
