# feature/game_analysis_save 작업 내역

## 무엇을 했나

브라우저 Stockfish 배치 분석 결과를 **분석 완료 즉시 백엔드에 자동 POST**하도록 프론트엔드 cutover. 다음 페이지 진입부터는 백엔드가 임베드해서 내려주는 분석을 그대로 그리므로 브라우저 Stockfish가 다시 돌지 않는다.

## 왜

직전 PR(`feat/flyway-v4-analysis`)에서 백엔드 영속화 경로(`POST/GET /api/games/{id}/analysis` + `game_analyses` 테이블)는 깔렸지만, 프론트는 여전히:

- 분석 결과를 Zustand 메모리에만 보관 (페이지 이탈 시 휘발).
- Ctrl+S 저장 시 `analysis`를 `PUT /api/games/{id}/annotations`에 끼워 보내고 있었는데 **백엔드는 그 필드를 silently drop**. 즉 어떤 경로로도 분석이 DB에 들어가지 않음.

결과: 게임 상세 페이지를 새로 열 때마다 "게임 분석" 버튼을 다시 눌러야 하고, 깊이 16의 80~150 위치 분석이 매번 반복됨.

## 주요 변경

### 분석 저장 자동화 (쓰기 경로)
- `frontend/src/features/game/api/gameApi.ts`
  - `submitAnalysis(id, analysis)` 추가. `POST /api/games/{id}/analysis`. 본문은 `GameAnalysis`를 그대로 직렬화 (백엔드 DTO 필드명과 1:1 일치).
- `frontend/src/features/game/api/mutations.ts`
  - `useSubmitAnalysis(gameId)` 추가. 기존 `useUpdateAnnotations` 패턴과 동일 — `onSuccess`에서 `gameKeys.detail(gameId)` 무효화.
- `frontend/src/features/game/components/GameViewer.tsx`
  - prop `gameId: string` 신설.
  - 배치 분석 완료 effect를 확장: `setAnalysis` → `submitAnalysisMutation.mutate(...)` 자동 호출.
  - 인라인 배너 상태(`analysisSaveMessage`) 추가. 성공/실패에 따라 emerald/red 배너 표시, 3초 후 자동 해제.
- `frontend/src/features/game/components/GameDetailPage.tsx`
  - `<GameViewer gameId={id!} ... />` prop 전달.

### Annotation / Analysis 라이프사이클 분리
- `frontend/src/features/game/stores/boardStore.ts`
  - `setAnalysis`/`clearAnalysis`에서 `annotationsDirty: true` 플립 제거. 분석은 자동 POST 경로로 빠지므로 메모/변형선 dirty와 분리.
  - `getAnnotationsSnapshot()` 반환값에서 `analysis` 제거 → `{ moveComments, variations }`만. 인터페이스 시그니처 동기화.
- `frontend/src/features/game/types/game.ts`
  - `AnnotationRequest`에서 `analysis?: GameAnalysis` 필드 제거 (백엔드가 drop하던 데드 바이트). `AnnotationResponse.analysis?`는 읽기 임베드용으로 유지.

### 테스트
- `frontend/src/features/game/api/__tests__/gameApi.test.ts`
  - `submitAnalysis` 그룹 신설:
    - `POST /api/games/:id/analysis` URL/메서드/body 검증.
    - 404 응답 시 `ApiError` throw 검증.
- `frontend/src/features/game/stores/__tests__/boardStore.test.ts`
  - `setAnalysis` / `clearAnalysis` 테스트: `annotationsDirty` 기대를 `true` → `false`로 변경.
  - 신규 테스트: `setAnalysis는 기존 annotationsDirty 값을 변경하지 않는다` (메모로 dirty=true 만든 뒤 setAnalysis 호출해도 그대로 true; clean 후 setAnalysis 호출해도 false 유지).
  - 신규 테스트: `getAnnotationsSnapshot에는 analysis가 포함되지 않는다` (기존 2개 테스트 통합 리네임).

## 주요 결정과 이유

| 결정 | 이유 |
|---|---|
| 분석 완료 즉시 자동 POST (Ctrl+S와 분리) | 분석은 캐시 성격의 무거운 컴퓨트 산출물 — 사용자 액션 없이 자동 저장이 자연스럽다. 메모/변형선은 의도적 편집이라 명시적 저장 유지. |
| 읽기 경로는 기존 임베드 유지 | 백엔드가 `GET /api/games/{id}` 응답의 `annotations.analysis`에 join해서 내려주고 있고, 프론트 `loadAnnotations`가 이미 처리. 추가 fetch 없음. 후속 PR에서 분리 검토. |
| POST 실패 시 인라인 토스트 + 로컬 분석 유지 | 사용자가 보고 있던 분석이 사라지면 혼란. 다음 분석 시 자연스럽게 재시도되는 모델. |
| 별도 query key 신설 안 함 (`gameKeys.detail` 무효화로 처리) | 임베드 경로로 충분. 키 추가는 별도 fetch 분리할 때. |
| 글로벌 토스트 시스템 미도입 | 프로젝트에 토스트 컴포넌트 부재 — 이번 PR 범위 밖. `GameViewer` 내부 인라인 배너로 최소 구현. |
| Redis 미도입 | `game_analyses` 단일행 JSONB 조회로 ms 단위. 개인 리뷰 앱 트래픽 규모에서 Redis는 과한 인프라. 트래픽 증가 시 별도 PR. |
| 백엔드 검증/분류 로직 이전 안 함 | 본 PR 스코프는 저장/캐시 cutover. 도메인 강화는 별도 PR. |

## 후속 작업 (별도 PR)

- **백엔드 도메인 강화**: `SaveGameAnalysisService`에 본문 검증 추가(`depth` 범위, `moveIndex` 범위, `analyzedAt` 형식). 분류 로직(`classification.ts`)을 도메인으로 이전해 단일 소스 오브 트루스 확립.
- 백엔드 호환 코드 정리: `AnnotationRequest.analysis` silent-drop 필드 제거, `GET /api/games/{id}` 임베드 제거, 프론트 `useAnalysis(id)`로 분리.
- 글로벌 토스트 시스템 도입.
- Stockfish 엔진 버전/NNUE 가중치 해시 메타데이터로 무효화 정책.
- Redis 캐시 레이어 (트래픽 증가 시).
