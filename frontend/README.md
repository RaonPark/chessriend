# Chessriend Frontend

React 19 + TypeScript + Vite 기반의 체스 리뷰 UI. 백엔드(Spring, `:8081`)와 REST + SSE로 통신한다.

> 컨벤션 상세: [`CONVENTIONS.md`](CONVENTIONS.md) · 디자인 토큰: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) · 테스트: [`TESTING.md`](TESTING.md)

---

## 실행 / 빌드 / 테스트

```bash
pnpm install
pnpm dev            # http://localhost:5173 ('/api' → http://localhost:8081 프록시)
pnpm build          # tsc -b 타입체크 + Vite 번들 → dist/
pnpm lint           # eslint
pnpm test           # vitest watch
pnpm test:run       # 1회 실행
pnpm test:coverage
```

> **백엔드가 떠 있어야** 데이터가 보인다(`pnpm dev`는 `/api`를 8081로 프록시). 백엔드 기동은 루트 [`README.md`](../README.md) 참고.
> Stockfish WASM 멀티스레드를 위해 dev 서버는 `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` 헤더를 설정한다(`vite.config.ts`).

---

## 디렉터리 구조

```
src/
├── app/                    # 앱 셸
│   ├── providers.tsx       # React Query QueryClient + RouterProvider
│   ├── router.tsx          # 라우트 정의
│   └── Layout.tsx          # 헤더/네비/푸터 (amber 체스 테마)
├── features/game/          # 게임 도메인 (단일 feature)
│   ├── api/                # HTTP·SSE 호출, React Query 훅, 쿼리키
│   ├── components/         # 페이지 + 보드/리뷰 UI
│   ├── hooks/              # useStockfish, useBatchAnalysis, useGameImport
│   ├── stores/             # boardStore (Zustand)
│   ├── types/game.ts       # 도메인 타입
│   ├── utils/              # classification, outcome
│   ├── constants.ts        # ANALYSIS_DEPTH 등
│   └── index.ts            # 배럴 export
├── shared/                 # 공용
│   ├── api/apiClient.ts    # fetch 래퍼 + ApiError
│   ├── components/         # Dropdown, ConfirmDialog, LoadingSpinner, ErrorMessage, ChessKing
│   ├── hooks/useConfirm.ts # Promise 기반 확인 다이얼로그
│   └── types/api.ts        # PagedResponse 등
└── test/                   # vitest setup, MSW 핸들러, test-utils
```

---

## 라우팅 (`app/router.tsx`)

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | → `/games` 리다이렉트 | |
| `/games` | `GameListPage` | 목록·필터·페이지네이션·일괄 삭제 |
| `/games/:id` | `GameDetailPage` → `GameViewer` | 보드·기보·분석·메모 |
| `/import` | `ImportPage` | 온라인 가져오기 + PGN 붙여넣기 |

---

## 상태 관리

### 서버 상태 — React Query

- 모든 서버 데이터는 `useQuery` / `useMutation`(`features/game/api/`)으로 다룬다.
- 쿼리키 팩토리는 `queryKeys.ts`에 중앙화(`gameKeys.list(filters)`, `gameKeys.detail(id)`).
- 뮤테이션 성공 시 관련 키를 무효화(삭제 → `gameKeys.lists()`, 주석/분석 → `gameKeys.detail(id)`).

### 클라이언트 상태 — Zustand (`stores/boardStore.ts`)

보드 뷰 상태 전용. **개별 셀렉터로만 구독**한다(`useBoardStore((s) => s.currentFen)`) — 전체 store 구독은 불필요한 리렌더를 유발.

관리하는 4개 영역:
- **메인라인**: `mainlineMoves`, `mainlineFens`, `currentIndex`, `currentFen`
- **변형선**: `isInVariation`, `variationMoves/Fens`, `variationStartIndex` (드래그로 분기 탐색)
- **주석**: `moveComments`, `savedVariations`, `annotationsDirty`
- **분석**: 백엔드 `analysis`, 수별 `classificationByMove`

`makeMove(from, to)`는 chess.js로 합법수 검증 후, 분석 완료 상태면 변형선을 생성한다.

---

## API 호출 (`features/game/api/`, `shared/api/apiClient.ts`)

- `apiClient.ts`의 `apiFetch<T>()`가 fetch를 감싸 비2xx 응답을 `ApiError`로 던지고 204를 처리.
- `gameApi.ts`가 엔드포인트별 함수 + **EventSource(SSE)** 두 종을 제공:
  - `GET /api/games/{id}/analysis/run` — 백엔드 분석 진행률/결과
  - `GET /api/games/import?source=...` — 가져오기 스트림
- `queries.ts`(`useGames`, `useGame`), `mutations.ts`(삭제·주석·분석 저장).

---

## 커스텀 훅 (`features/game/hooks/`)

| 훅 | 역할 |
|----|------|
| `useStockfish` | 브라우저 Stockfish WASM(`@lichess-org/stockfish-web`) 초기화·NNUE 로드·FEN 평가(depth 18, 백 관점 정규화). 시작 포지션/사용자 변형선의 **실시간** 평가에 사용 |
| `useBatchAnalysis` | `/analysis/run` SSE 구독 → `progress` 누적, `complete`에서 전체 `GameAnalysis` 수신. 취소 시 generation 으로 stale 이벤트 무시 |
| `useGameImport` | `/import` SSE 구독 → 게임 1개씩 수신·표시, `complete`에서 목록 무효화 |
| `shared/hooks/useConfirm` | 네이티브 `confirm()` 대체. `Promise<boolean>` 반환(`ConfirmDialog`와 연동) |

> **평가 캐싱**: 분석 완료 후 메인라인 수는 저장된 `evalAfter`를 재사용(재평가 안 함). 시작 포지션·새 변형선만 `useStockfish`로 실시간 평가.

---

## 주요 컴포넌트 (`features/game/components/`)

| 컴포넌트 | 역할 |
|----------|------|
| `GameListPage` / `GameListItem` | 목록·필터·페이지네이션·선택 삭제 / 카드 |
| `ImportPage` / `PgnImportForm` | 온라인 가져오기 + PGN 붙여넣기 폼 |
| `GameDetailPage` | 플레이어·결과·메타 정보 + `GameViewer` 마운트 |
| `GameViewer` | **핵심 컨테이너** — 보드/기보/분석/메모 조립, 분석 SSE 트리거, 캐시 무효화 |
| `GameBoard` | react-chessboard 래퍼(드래그 → `makeMove`) |
| `MoveList` | 2열 기보, 변형선 삽입·저장 목록, 분류 배지 |
| `EvalBar` | 백/흑 승률 막대 |
| `AnalysisProgress` / `AnalysisSummary` | 분석 진행률 / 진영별 실수 집계 |
| `CommentPanel` | 수별 코멘트 편집(분석 후 활성) |
| `BoardControls` | 처음/이전/다음/끝 + 메모 저장 |

---

## 타입 / 유틸

- **타입**: `features/game/types/game.ts`(`GameSource`, `TimeCategory`, `MoveClassification`, `GameAnalysis`, `MoveEvaluation`, `VariationResponse` 등), 공용 `shared/types/api.ts`(`PagedResponse<T>`).
- **`utils/classification.ts`**: `evalToCp`, `winPercent`(시그모이드), `classifyMove`(승률 손실 기준 Blunder/Mistake/Inaccuracy), `detectBrilliant`(희생 + 승률 손실 < 2%p), `computeClassifications`.
- **`utils/outcome.ts`**: `getOwnerOutcome`(소유자 기준 승/패/무), `getResultLabel`.

---

## 스타일

- **Tailwind CSS v4** — `@tailwindcss/vite` 플러그인, `index.css`의 `@import "tailwindcss";`. 별도 config 파일 없이 동작.
- **UI 라이브러리 금지**(MUI/shadcn 등) — 네이티브 HTML + Tailwind 커스텀 컴포넌트만.
- **네이티브 브라우저 UI 금지** — `<select>`·`confirm()`·`alert()` 대신 `shared/components`의 `Dropdown`·`ConfirmDialog` 사용.
- amber 브랜드 + 다크모드(`dark:`) 필수. 분류 색: Brilliant=cyan, Blunder=red, Mistake=orange, Inaccuracy=yellow.
- 토큰·패턴 전체는 [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

---

## 테스트

- **Vitest**(jsdom) + **Testing Library** + **MSW**(API 모킹).
- 셋업 `src/test/setup.ts`, 핸들러 `src/test/mocks/handlers.ts`, 커스텀 렌더 `src/test/test-utils.tsx`(Provider 래핑).
- api / components / hooks / stores / utils 각 계층에 `__tests__/`.

---

## 변경 시 주의사항

- **백엔드 계약 일치**: 엔드포인트·DTO 변경은 백엔드 `GameResponse.kt`·컨트롤러와 맞춰야 한다(SSE는 `text/event-stream`, import는 `GET`).
- **분석 깊이 동기화**: `constants.ts`의 `ANALYSIS_DEPTH`는 백엔드 `application.yml`의 `chess.engine.depth`와 lockstep(현재 18).
- **Zustand 구독**: 전체 store 구독 금지 — 개별 셀렉터만.
- **SSE 취소**: 새 import/analysis 시작 시 이전 EventSource를 닫고 generation을 증가시켜 stale 이벤트를 막을 것.
