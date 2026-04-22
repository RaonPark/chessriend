# feat/game-viewer — 게임 뷰어 + Stockfish 평가

## 2026-04-11~12: 체스보드 뷰어 구현

### 무엇을
- react-chessboard + chess.js 기반 체스보드 뷰어
- Zustand boardStore로 수 네비게이션 (FEN 계산, 인덱스 관리)
- 수 목록 패널 (백/흑 쌍 표시, 현재 수 하이라이트)
- 네비게이션 컨트롤 (처음/이전/다음/마지막) + 키보드 단축키 (←→, Home/End)
- `GET /api/games/{id}` 응답에 `moves` 배열 포함 (`GameDetailResponse`)

### 왜
- import한 게임을 실제 체스보드로 볼 수 있어야 분석/리뷰 기능의 기반이 됨
- FEN 계산을 프론트엔드(chess.js)에서 수행하여 백엔드 체스 라이브러리 도입 없이 구현

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/adapter/in/web/GameResponse.kt` | `GameDetailResponse`, `MoveResponse` DTO 추가 |
| `game/adapter/in/web/GameController.kt` | `getGame`이 `GameDetailResponse` 반환 |
| `features/game/stores/boardStore.ts` | Zustand — chess.js로 FEN 계산, 수 네비게이션 |
| `features/game/components/GameBoard.tsx` | react-chessboard 래퍼 (orientation, 체스보드 색상) |
| `features/game/components/MoveList.tsx` | 수 목록 (번호 + 백/흑 쌍, 현재 수 amber 하이라이트, 자동 스크롤) |
| `features/game/components/BoardControls.tsx` | 네비게이션 버튼 + 키보드 단축키 |
| `features/game/components/GameViewer.tsx` | 위 컴포넌트 조합 (보드 + eval bar + 수 목록 + 컨트롤) |
| `features/game/components/GameDetailPage.tsx` | placeholder → GameViewer 교체 |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| FEN 계산 위치 | 프론트엔드 (chess.js) | 백엔드 체스 라이브러리 불필요, SAN 수를 순서대로 적용하면 FEN 계산 가능 |
| 상세 API 응답 | `GameDetailResponse` (moves 포함) | 목록 API에는 moves 미포함 (성능), 상세만 포함 |
| 보드 방향 | ownerUsername으로 자동 결정 | owner가 흑이면 보드 뒤집기 |
| react-chessboard v5 | `options` prop 방식 | v5에서 API가 변경됨 (props → options 객체) |

## 2026-04-12: Stockfish 18 WASM 평가치

### 무엇을
- `@lichess-org/stockfish-web` (sf_18_smallnet) — 브라우저에서 Stockfish 18 실행
- NNUE 네트워크 파일 (`nn-4ca89e4b3abf.nnue`, 14MB) public/에 배치
- `useStockfish` 훅 — FEN 변경 시 실시간 depth 18 평가
- `EvalBar` 컴포넌트 — lichess/chess.com 스타일 흑백 세로 바

### 왜
- 체스 리뷰 앱의 핵심 기능: 각 포지션의 엔진 평가치를 시각적으로 확인
- 브라우저 WASM으로 백엔드 변경 없이 구현 가능
- lichess가 실제 사용하는 동일 엔진 (`@lichess-org/stockfish-web`)

### Stockfish WASM 아키텍처

```
[useStockfish 훅]
    ↓ evaluate(fen)
[sf_18_smallnet.js + .wasm]  ← NNUE: nn-4ca89e4b3abf.nnue (14MB)
    ↓ UCI: "position fen ... " → "go depth 18"
    ↓ listen: "info depth 18 score cp 35" 파싱
    ↓ side-to-move 보정 (흑 차례면 부호 반전)
[EvalResult { cp, mate, depth }]  → 항상 백 관점으로 정규화
    ↓
[EvalBar] — sigmoid 변환 → 흑/백 비율 → 세로 바
```

**UCI side-to-move 보정**: Stockfish는 항상 현재 차례 관점으로 평가치를 반환한다.
흑 차례에 `+1150cp`이면 "흑이 11.5 유리"이므로, FEN의 차례(`w`/`b`)를 확인하여
흑 차례면 부호를 반전(`* -1`)하여 항상 백 관점으로 정규화한다.

### 변경 파일
| 파일 | 설명 |
|------|------|
| `features/game/hooks/useStockfish.ts` | Stockfish WASM 초기화, NNUE 로드, UCI 통신, 평가 파싱 |
| `features/game/components/EvalBar.tsx` | 흑백 세로 바 (sigmoid 변환, 방향 자동 조정, 유리한 쪽에 숫자 표시) |
| `features/game/components/GameViewer.tsx` | eval 통합 (FEN 변경 → 실시간 평가 → EvalBar 갱신) |
| `vite.config.ts` | COOP/COEP 헤더 + optimizeDeps exclude |
| `frontend/.gitignore` | `*.nnue` 파일 제외 |
| `package.json` | `@lichess-org/stockfish-web` 의존성 추가 |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| Stockfish 실행 위치 | 브라우저 WASM | 백엔드 변경 없이 바로 적용, Stockfish 설치 불필요 |
| 패키지 | `@lichess-org/stockfish-web` | lichess가 사용하는 엔진, 5.4MB로 가벼움. `stockfish` npm(251MB)은 OOM 발생 |
| 엔진 빌드 | sf_18_smallnet | NNUE 1개만 필요 (14MB), 성능과 크기의 균형 |
| 평가 depth | 18 | 브라우저에서 합리적인 분석 깊이. 데스크톱 Stockfish는 보통 20+ |
| EvalBar 변환 | sigmoid (`2/(1+e^(-0.004*cp))-1`) | lichess 스타일, ±400cp에서 거의 끝단 |

### NNUE 다운로드 안내
```bash
# public/ 디렉토리에서 실행
curl -sL -o nn-4ca89e4b3abf.nnue "https://tests.stockfishchess.org/api/nn/nn-4ca89e4b3abf.nnue"
```

### TODO
- [x] 인터랙티브 분석 (기물 이동 + 원래 기보로 복귀)
- [ ] Blunder/Mistake/Inaccuracy 분류
- [ ] 전체 게임 평가 그래프

## 2026-04-12~15: 인터랙티브 분석 + Annotation 백엔드

### 무엇을
- 체스보드에서 기물 드래그 이동 → 변형선(variation) 분기
- 원래 기보로 복귀 (Esc, 버튼, ← 자동 복귀)
- 변형선을 MoveList에서 분기 지점 바로 아래에 인라인 표시
- `GameAnnotation` 도메인 + DB(JSONB) + CRUD API (`PUT /api/games/{id}/annotations`)
- 수 단위 메모 + 변형선 단위 메모 데이터 구조

### 왜
- 분석 시 "여기서 다른 수를 뒀으면 어땠을까" 탐색이 체스 리뷰의 핵심
- 변형선과 메모를 저장해야 나중에 복습할 수 있음

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/domain/Annotation.kt` | `GameAnnotation`, `Variation` 도메인 객체 |
| `game/domain/Game.kt` | `annotations: GameAnnotation` 필드 추가 |
| `V3__add_annotations.sql` | `annotations` JSONB 컬럼 추가 |
| `GameEntity.kt` | `annotations: Json` 필드 |
| `GamePersistenceAdapter.kt` | annotations JSONB 직렬화/역직렬화, `updateAnnotations` |
| `GameRepository.kt` | `updateAnnotations` 메서드 추가 |
| `GetGameUseCase.kt` | `updateAnnotations` 메서드 추가 |
| `GetGameService.kt` | `updateAnnotations` 구현 |
| `GameController.kt` | `PUT /api/games/{id}/annotations` 엔드포인트 |
| `GameResponse.kt` | `AnnotationRequest/Response`, `VariationRequest/Response` DTO |
| `boardStore.ts` | mainline + variation 분리, `makeMove`, `exitVariation` |
| `GameBoard.tsx` | `allowDragging: true`, `onPieceDrop` 핸들링 |
| `MoveList.tsx` | 변형선 인라인 표시 (분기 지점 바로 아래) |
| `BoardControls.tsx` | ↑↓ 단축키, Esc 변형선 복귀 |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| Annotation 이름 | `GameAnnotation` | `Annotation`은 `kotlin.Annotation`과 충돌 |
| 저장 구조 | Game 도메인에 annotations JSONB 추가 | 별도 Review 도메인보다 간단, Game과 항상 함께 로드 |
| 메모 단위 | 수 단위 + 변형선 단위 모두 지원 | 사용자가 원하는 곳에 자유롭게 메모 |
| 변형선 표시 | MoveList 분기 지점 바로 아래 인라인 | 별도 영역보다 기보 흐름에서 자연스럽게 보임 |
| 단축키 | ←→ (수 이동), ↑↓ (처음/끝), Esc (변형선 복귀) | 방향키가 직관적 |

## 2026-04-16: 메모 입력 UI + 변형선 저장 (프론트엔드)

### 무엇을
- Annotation 백엔드 API를 프론트엔드에 연결 (타입, API 함수, React Query mutation)
- boardStore에 annotation 상태 추가 (moveComments, savedVariations, dirty 플래그)
- CommentPanel 컴포넌트 — MoveList 하단에 수별 메모 입력/수정/삭제 패널
- MoveList 개선:
  - 저장된 변형선을 분기 지점 아래에 인라인 표시 (emerald 색상)
  - 변형선 클릭으로 재생, 삭제 버튼 (hover 시 표시)
  - 현재 분석 중인 변형선에 "저장" 버튼 추가
  - 메모가 있는 수에 연필 아이콘(✎) 표시
- GameViewer에 "저장 (Ctrl+S)" 버튼 + 변경 감지 (annotationsDirty)
- GameDetailPage에서 useUpdateAnnotations mutation 연결

### 왜
- Annotation 백엔드가 완성되었으나 프론트엔드에서 사용할 수 없었음
- 수별 메모 + 변형선 저장은 체스 리뷰 앱의 핵심 기능
- "내 게임을 분석하고 기록하는" 경험 완성

### 변경 파일
| 파일 | 설명 |
|------|------|
| `features/game/types/game.ts` | `AnnotationResponse`, `VariationResponse`, `AnnotationRequest` 타입 추가, `GameDetailResponse.annotations` 필드 |
| `features/game/api/gameApi.ts` | `updateAnnotations()` API 함수 |
| `features/game/api/mutations.ts` | `useUpdateAnnotations` mutation (캐시 무효화 포함) |
| `features/game/stores/boardStore.ts` | annotation 상태 (moveComments, savedVariations, dirty), loadAnnotations, setMoveComment, saveCurrentVariation, deleteSavedVariation, enterSavedVariation |
| `features/game/components/CommentPanel.tsx` | 신규 — MoveList 하단 메모 입력 패널 (Ctrl+Enter 저장, Esc 취소) |
| `features/game/components/MoveList.tsx` | 저장된 변형선 인라인 표시, 메모 아이콘, 변형선 저장 버튼 |
| `features/game/components/GameViewer.tsx` | annotations prop, 저장 버튼(Ctrl+S), loadAnnotations 연결 |
| `features/game/components/GameDetailPage.tsx` | useUpdateAnnotations mutation 연결, 저장 핸들러 |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| 메모 패널 위치 | MoveList 하단 | 시선 이동 최소화, lichess 스타일과 유사 |
| 저장된 변형선 표시 | 인라인 (emerald 색상) | 현재 분석 변형선(indigo)과 시각 구분, 기보 흐름에서 자연스럽게 표시 |
| 저장 방식 | 수동 저장 (Ctrl+S + 버튼) | 메모 입력 중 자동저장은 API 호출이 잦아짐, dirty 플래그로 변경 감지 |
| 메모 편집 | 클릭 → 편집 모드 전환 | 항상 텍스트 영역을 보여주면 공간 낭비 |

## 2026-04-16: EvalBar orientation 버그 수정

### 무엇을
- EvalBar가 `orientation='black'`일 때 평가치를 반대로 표시하던 버그 수정
- 상단/하단 영역의 색상을 보드 방향에 따라 동적으로 뒤집도록 변경

### 왜
- 기존 코드는 `topPercent`만 뒤집고 상단/하단 색상은 하드코딩 (상단=흑, 하단=백)
- `orientation='black'`에서 상단은 백, 하단은 흑이어야 하는데 색상이 고정이라 반대로 보임
- 예: 초기 포지션(백 약간 유리)에서 흑이 유리하게 표시됨

### 변경 파일
| 파일 | 설명 |
|------|------|
| `features/game/components/EvalBar.tsx` | orientation에 따라 상단/하단 배경색, 텍스트 색상을 동적으로 전환 |

## 2026-04-16: 변형선 수별 메모 + 다중 변형선

### 무엇을
- **백엔드**: `Variation` 도메인에 `moveComments` 필드 추가 (JSONB이라 DB 마이그레이션 불필요)
- **프론트엔드**: 
  - 저장된 변형선에 진입 시 `activeVariationIndex` 추적
  - `setVariationMoveComment` 액션으로 변형선 수별 메모 CRUD
  - CommentPanel이 메인라인/변형선 모드 모두 지원 (변형선은 emerald 색상)
  - MoveList에서 저장된 변형선 수의 메모 아이콘(✎) 표시
  - 같은 분기점에서 여러 변형선 저장 가능 (구조적으로 이미 지원, UI 확인)

### 왜
- 변형선 분석 시 각 수에 대한 메모가 없으면 나중에 왜 그 변형선을 탐색했는지 기억하기 어려움
- 같은 지점에서 여러 후보수를 비교하는 것이 체스 분석의 핵심

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/domain/Annotation.kt` | `Variation.moveComments` 필드 추가 |
| `game/adapter/in/web/GameResponse.kt` | `VariationRequest/Response.moveComments` 추가 |
| `features/game/types/game.ts` | `VariationResponse.moveComments` 추가 |
| `features/game/stores/boardStore.ts` | `activeVariationIndex`, `setVariationMoveComment` 추가, 변형선 진입/복귀 시 인덱스 관리 |
| `features/game/components/CommentPanel.tsx` | 메인라인/변형선 양쪽 모드 지원, 색상 분기 |
| `features/game/components/MoveList.tsx` | `enterSavedVariation`에 index 전달, 변형선 수 메모 아이콘 |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| 변형선 구조 | flat (중첩 미지원) | 현재 사용 패턴에 충분, 트리 구조는 복잡도 대비 이점이 적음 |
| 변형선 메모 저장 | VariationResponse 내부 moveComments | 메인라인 메모와 동일한 패턴, 별도 모델 불필요 |
| DB 마이그레이션 | 불필요 | JSONB 컬럼이라 새 필드가 자동으로 직렬화/역직렬화됨 |

## 2026-04-17: Blunder/Mistake/Inaccuracy 분류

### 무엇을
- 전체 게임을 Stockfish WASM으로 일괄 분석하여 각 수의 centipawn loss 계산
- 분류 기준: Inaccuracy (50-100cp), Mistake (100-200cp), Blunder (200+cp)
- MoveList에서 분류된 수를 색상으로 하이라이트:
  - Blunder: 빨강 (`bg-red-100`), 활성 수는 왼쪽 빨강 보더
  - Mistake: 주황 (`bg-orange-100`), 활성 수는 왼쪽 주황 보더
  - Inaccuracy: 노랑 (`bg-yellow-100`), 활성 수는 왼쪽 노랑 보더
- AnalysisSummary 컴포넌트: 전체/백/흑 별 분류 카운트 표시
- AnalysisProgress 컴포넌트: 분석 진행 바 + 취소 버튼
- "게임 분석" 버튼으로 수동 시작, 분석 결과는 annotation으로 저장/복원
- 별도 Stockfish 인스턴스로 배치 분석 (라이브 평가와 독립)

### 왜
- 자신의 실수를 한눈에 파악하는 것이 체스 리뷰의 핵심 기능
- lichess/chess.com의 게임 분석과 동일한 핵심 기능
- 기존 Stockfish WASM 인프라를 재활용하여 추가 백엔드 없이 구현

### 아키텍처

```
[GameViewer] → "게임 분석" 버튼 클릭
    ↓
[useBatchAnalysis 훅] — 전용 Stockfish WASM 인스턴스
    ↓ mainlineFens 배열 순차 평가 (depth 16)
    ↓ 각 포지션: "position fen X" → "go depth 16" → bestmove 대기
    ↓ UCI score → 백 관점으로 정규화
[classification.ts] — computeClassifications()
    ↓ positionEvals[i] vs [i+1] → cpLoss 계산
    ↓ 백의 수: cpLoss = evalBefore - evalAfter
    ↓ 흑의 수: cpLoss = evalAfter - evalBefore
    ↓ mate 처리: mate-in-N → ±(10000 - |N|) centipawn
[GameAnalysis] → boardStore.setAnalysis()
    ↓ classificationByMove 맵 구축 (O(1) lookup)
    ↓ annotationsDirty = true → 저장 가능
[MoveList] → classificationByMove로 색상 적용
[AnalysisSummary] → B/M/I 카운트 + 백/흑 분리
```

### 변경 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `features/game/types/game.ts` | 수정 | `MoveClassification`, `MoveEvaluation`, `GameAnalysis`, `EvalScore` 타입 추가, `AnnotationResponse/Request`에 optional `analysis` 필드 |
| `features/game/utils/classification.ts` | 신규 | `evalToCp()`, `classifyMove()`, `computeClassifications()` 순수 함수 |
| `features/game/hooks/useBatchAnalysis.ts` | 신규 | 전용 Stockfish 인스턴스, 순차 FEN 평가, 진행률 추적, 취소 지원 |
| `features/game/stores/boardStore.ts` | 수정 | `analysis`, `classificationByMove` 상태, `setAnalysis()`, `clearAnalysis()`, `loadAnnotations()` 복원, `getAnnotationsSnapshot()` 포함 |
| `features/game/components/AnalysisProgress.tsx` | 신규 | 진행 바 (amber 테마) + 취소 버튼 |
| `features/game/components/AnalysisSummary.tsx` | 신규 | B/M/I 카운트 (빨강/주황/노랑 dot), 백/흑 분리, 재분석 버튼 |
| `features/game/components/MoveList.tsx` | 수정 | MoveCell에 `classification` prop, 비활성 수에 분류 배경색, 활성 수에 왼쪽 컬러 보더 |
| `features/game/components/GameViewer.tsx` | 수정 | `useBatchAnalysis` 연결, "게임 분석" 버튼, AnalysisProgress/AnalysisSummary 조건부 렌더링 |
| `game/domain/Annotation.kt` | 수정 | `GameAnalysisData`, `MoveEvaluationData`, `EvalScore` 도메인 클래스, `GameAnnotation.analysis` 필드 |
| `game/adapter/in/web/GameResponse.kt` | 수정 | 분석 관련 Request/Response DTO + 매핑 |
| `game/adapter/out/persistence/GamePersistenceAdapter.kt` | 수정 | `parseAnnotations`를 ObjectMapper `readValue` 직접 역직렬화로 변경 (수동 캐스팅 제거) |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| 분석 Stockfish 인스턴스 | 별도 인스턴스 | 라이브 평가(depth 18)와 독립 실행, 사용자가 수를 탐색하면서 배치 분석 동시 진행 가능 |
| 배치 분석 depth | 16 | depth 18보다 ~2배 빠르면서 분류 정확도 충분 |
| 분석 트리거 | 수동 ("게임 분석" 버튼) | 40수 게임 = 81 포지션 × 1~3초 = 수 분 소요, 자동 실행은 부담 |
| 분류 기준 | 50/100/200 cp | lichess/chess.com 표준과 동일 |
| Mate 처리 | ±(10000 - \|N\|) cp 변환 | mate-in-1 = 9999cp, mate-in-5 = 9995cp로 연속적 비교 가능 |
| 분류 결과 저장 | annotations.analysis 필드 | 기존 annotation 저장 플로우 재활용, JSONB라 DB 마이그레이션 불필요 |
| parseAnnotations 방식 | ObjectMapper readValue 직접 | 수동 캐스팅 제거, CLAUDE.md 코딩 컨벤션에 반영 |
