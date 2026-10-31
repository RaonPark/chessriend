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
├── features/game/          # 게임: 목록·가져오기·복기·폴더
│   ├── api/                # HTTP·SSE 호출(gameApi, folderApi), React Query 훅, 쿼리키
│   ├── components/         # 페이지 + 보드/복기 UI + 목록 LNB·필터
│   ├── hooks/              # useStockfish, useBatchAnalysis, useGameImport
│   ├── stores/             # boardStore (Zustand)
│   ├── types/game.ts       # 도메인 타입
│   ├── utils/              # 분석 요약·cp loss·기보 기호·화살표·수 번호·필터·시간 분류 등
│   ├── constants.ts        # ANALYSIS_DEPTH 등
│   └── index.ts            # 배럴 export
├── features/settings/      # 브라우저별 설정 (헤더 "설정" 다이얼로그)
│   ├── components/         # SettingsDialog
│   ├── hooks/              # useThemeSync (테마 → <html class="dark">)
│   ├── stores/             # settingsStore (Zustand persist → localStorage)
│   └── utils/              # theme (resolveTheme, applyTheme)
├── shared/                 # 공용
│   ├── api/apiClient.ts    # fetch 래퍼 + ApiError
│   ├── components/         # Dropdown, ConfirmDialog, ContextMenu(우클릭 메뉴), LoadingSpinner, ErrorMessage, ChessKing
│   ├── hooks/useConfirm.ts # Promise 기반 확인 다이얼로그
│   └── types/api.ts        # PagedResponse 등
└── test/                   # vitest setup, MSW 핸들러, test-utils
```

---

## 라우팅 (`app/router.tsx`)

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/` | → `/games` 리다이렉트 | |
| `/games` | `GameListPage` | LNB(내 폴더·오프닝별) + 필터 + 목록·페이지네이션·일괄 삭제/폴더에 추가 |
| `/games/:id` | `GameDetailPage` → `GameViewer` | 애칭 + 대국자 바·보드 + 기보·메모 / 경기 정보 탭 |
| `/import` | `ImportPage` | 온라인 가져오기 + PGN 붙여넣기 |

설정은 페이지가 아니라 헤더의 **"설정" 다이얼로그**(`SettingsDialog`)다 — 복기 중에도 보드 상태를 잃지 않고 열 수 있다.

---

## 상태 관리

### 서버 상태 — React Query

- 모든 서버 데이터는 `useQuery` / `useMutation`(`features/game/api/`)으로 다룬다.
- 쿼리키 팩토리는 `queryKeys.ts`에 중앙화(`gameKeys.list(filters)`, `gameKeys.detail(id)`, `gameKeys.openings()`, `folderKeys.all`).
- 뮤테이션 성공 시 관련 키를 무효화(삭제 → `gameKeys.lists()`, 주석/분석/애칭·메모 → `gameKeys.detail(id)`, 폴더 변경 → `folderKeys.all` + `gameKeys.lists()`).

### 클라이언트 상태 — Zustand (`stores/boardStore.ts`)

보드 뷰 상태 전용. **개별 셀렉터로만 구독**한다(`useBoardStore((s) => s.currentFen)`) — 전체 store 구독은 불필요한 리렌더를 유발.

관리하는 영역:
- **메인라인**: `mainlineMoves`, `mainlineFens`, `currentIndex`, `currentFen`
- **변형선**: `isInVariation`, `variationMoves/Fens`, `variationStartIndex`, `activeVariationIndex`(저장된 변형선 안이면 그 인덱스)
- **주석**: `moveComments`, `savedVariations`, `annotationsDirty`
- **화살표**: `moveArrows`(메인라인), 저장된 변형선의 `moveArrows`, `draftVariationArrows`(저장 전 변형선) — `selectCurrentArrows`
- **분석**: 백엔드 `analysis`, 수별 `classificationByMove`

`makeMove(from, to)`는 chess.js로 합법수 검증 후,
- 메인라인에서 다음 기보 수와 같으면 **변형선 없이 한 수 앞으로**(분석 전에도),
- 다르면 분석 완료 상태일 때 변형선을 생성한다. 저장된 변형선 중간에서 다른 수를 두면 원본은 두고 새 변형선으로 분기한다.

설정은 별도 `settingsStore`(엔진 최선수 화살표, 화면 테마)로 localStorage에 저장한다.

---

## API 호출 (`features/game/api/`, `shared/api/apiClient.ts`)

- `apiClient.ts`의 `apiFetch<T>()`가 fetch를 감싸 비2xx 응답을 `ApiError`로 던지고 204를 처리.
- `gameApi.ts`가 엔드포인트별 함수 + **EventSource(SSE)** 두 종을 제공:
  - `GET /api/games/{id}/analysis/run` — 백엔드 분석 진행률/결과
  - `GET /api/games/import?source=...` — 가져오기 스트림
- `folderApi.ts`: 폴더 목록·생성·이름 변경·삭제·게임 넣기/빼기.
- `queries.ts`(`useGames`, `useGame`, `useFolders`, `useOpeningCounts`), `mutations.ts`(삭제·주석·분석·애칭/메모 저장, 폴더 변경).

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
| `GameListPage` | LNB + 필터 + 목록·페이지네이션·선택 삭제·"폴더에 추가" |
| `GameLnb` | 모든 게임 / 내 폴더(생성·이름 변경·삭제) / 오프닝별 |
| `GameFilters` | 플랫폼·시간·결과·상대 레이팅 필터 + 필터 초기화 |
| `GameListItem` | 목록 카드 — 애칭·메모 표시, 분석 요약·폴더 태그(항상 별도 줄), 우클릭 메뉴(게임 이름 변경 / 폴더에 추가) |
| `NameDialog` | 이름 입력 창 — 새 폴더 · 폴더 이름 변경(중복 409 안내) · 게임 이름 변경(비우면 삭제) 공용 |
| `ImportPage` / `PgnImportForm` | 온라인 가져오기 + PGN 붙여넣기 폼 |
| `GameDetailPage` | 게임 이름 표시(`GameNicknameHeader`, 표시 전용) + `GameViewer` 마운트 (수 없는 게임은 대국자 바 + 경기 정보만) |
| `GameViewer` | **핵심 컨테이너** — 대국자 바·보드·탭(기보·메모 / 경기 정보) 조립, 분석 SSE 트리거, 엔진 최선수 |
| `PlayerBar` | 보드 위·아래 대국자 바 — 결과 배지, `!! ?? ? ?!` 개수, 평균 cp loss |
| `GameBoard` | react-chessboard 래퍼 — 둘 수 있는 칸 표시, 클릭/드래그로 두기, 우클릭 드래그 화살표, 엔진 최선수 화살표 |
| `MoveList` | 2열 기보(기보 기호), 변형선 표시·저장·우클릭 삭제, 수 번호 |
| `EvalBar` | 백/흑 승률 막대 |
| `AnalysisProgress` / `AnalysisSummary` | 분석 진행률 / 진영별 분류·평균 cp loss 표(설명 툴팁) |
| `CommentPanel` | 수별 메모 편집(분석 후 활성, 저장 전 변형선은 메모 저장 시 변형선도 저장) |
| `GameInfoPanel` | "경기 정보" 탭 — 게임 메모(`GameMemoSection`)·메타·분석 표·게임 삭제 |
| `GameNote` | `GameNicknameHeader`(게임 이름 표시 — 변경은 목록 우클릭) / `GameMemoSection`(게임 메모 편집) |
| `BoardControls` | 처음/이전/다음/끝 + 키보드 단축키(다이얼로그·메뉴 안 입력은 무시) |

---

## 타입 / 유틸

- **타입**: `features/game/types/game.ts`(`GameSource`, `TimeCategory`, `MoveClassification`, `GameAnalysis`, `MoveEvaluation`, `VariationResponse` 등), 공용 `shared/types/api.ts`(`PagedResponse<T>`).
- **`utils/classification.ts`**: `evalToCp`, `winPercent`(시그모이드), `classifyMove`, `detectBrilliant`, `computeClassifications` — 수 분류는 현재 백엔드에서 계산하므로 `computeClassifications`는 미사용.
- **`utils/cpLoss.ts` / `analysisStats.ts`**: 수별 cp loss(±1000 제한, 수 직후 `mate 0`은 둔 쪽 승) / 백·흑 분류 개수·평균 cp loss — 백엔드 `GameAnalysisSummary`와 같은 규칙.
- **`utils/moveSymbols.ts`**: 기보 기호(`!!` `??` `?` `?!`)·이름·색.
- **`utils/outcome.ts`**: `getOwnerOutcome`(소유자 기준 승/패/무), `getResultLabel`, `getPlayerBadge`(대국자 바 결과 배지).
- 기타: `arrows.ts`(화살표 색·최선수 화살표·중복 제거), `moveHints.ts`(둘 수 있는 칸), `moveNumber.ts`(`2...Bc5`), `gameFilters.ts`(필터 값·LNB 선택), `timeCategory.ts`(시간 분류 한글 이름).

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
