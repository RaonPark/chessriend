# feat/frontend-game — 프론트엔드 게임 Import + 목록

## 2026-04-11: 프론트엔드 초기 구축 + 게임 Import/목록/상세 페이지

### 무엇을
- React 프론트엔드 프로젝트를 feature-based 구조로 재구성
- Tailwind CSS 4, TanStack Query 5, Zustand 5, React Router 7 도입
- 게임 목록 페이지 (페이지네이션 + source/timeCategory 필터링)
- 게임 상세 페이지 (대국자 정보, 메타 정보 표시)
- 게임 Import 페이지 (SSE EventSource 스트리밍으로 실시간 import 진행 표시)
- 프론트엔드 코딩 컨벤션 문서 (`frontend/CONVENTIONS.md`)

### 왜
- 백엔드 Game API (import SSE + 목록 조회 + 단건 조회)와 연동하여 실제 사용 가능한 UI 확보
- TanStack Query로 서버 상태와 클라이언트 상태를 명확히 분리하여 데이터 흐름 단순화
- Tailwind CSS로 빠른 UI 프로토타이핑 + 다크 모드 기본 지원

### 기술 스택 선정 이유

#### TanStack Query (React Query)
React Query는 **서버 상태 관리** 라이브러리이다. 기존에 `useEffect` + `fetch` + `useState`로 직접 관리하던 "API에서 가져온 데이터"를 자동으로 관리해준다.

**핵심 기능:**
- **자동 캐싱**: 같은 API를 여러 컴포넌트에서 호출해도 실제 네트워크 요청은 1번만
- **자동 리페칭**: 탭 전환, 네트워크 재연결 시 자동으로 최신 데이터 가져옴
- **staleTime**: "이 데이터는 5분간 신선하다" → 5분 안에 같은 쿼리 호출하면 캐시에서 즉시 반환
- **loading/error 상태**: `isLoading`, `error`, `data`를 자동 제공
- **쿼리 무효화**: import 완료 시 `invalidateQueries`로 게임 목록 캐시를 자동 갱신

**사용 전/후 비교:**
```typescript
// Before: 직접 상태 관리 (복잡)
const [games, setGames] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
useEffect(() => {
  fetch('/api/games').then(r => r.json()).then(setGames).catch(setError).finally(() => setLoading(false))
}, [])

// After: React Query (간결)
const { data, isLoading, error } = useGames()
```

**Query Key Factory 패턴:**
```typescript
gameKeys.list({ source: 'LICHESS' })  // → ['games', 'list', { source: 'LICHESS' }]
gameKeys.detail(42)                     // → ['games', 'detail', 42]
```
키가 다르면 별도 캐시, 같으면 공유. 필터가 바뀌면 새 캐시 엔트리가 생기고 이전 것은 staleTime 후 자동 정리.

#### Zustand
Zustand는 **클라이언트 전용 상태 관리** 라이브러리이다. Redux보다 훨씬 간단하다.

**React Query와의 역할 분리:**
| 상태 유형 | 관리 도구 | 예시 |
|-----------|-----------|------|
| 서버 데이터 | React Query | 게임 목록, 게임 상세 |
| UI 상태 | Zustand | 체스보드 현재 수 번호, 사이드바 열림/닫힘 |

**사용법:**
```typescript
// 스토어 생성 (한 줄로 상태 + 액션 정의)
const useBoardStore = create((set) => ({
  currentMove: 0,
  nextMove: () => set((s) => ({ currentMove: s.currentMove + 1 })),
}))

// 컴포넌트에서 사용 (Hook처럼)
const currentMove = useBoardStore((s) => s.currentMove)
```

아직 이번 작업에서는 Zustand를 직접 사용하지 않았다. 체스보드 뷰어 구현 시 사용 예정.

#### Tailwind CSS 4
Tailwind는 **유틸리티 우선(Utility-first) CSS 프레임워크**이다. 미리 정의된 작은 클래스를 조합하여 스타일을 만든다.

**핵심 개념:**
```html
<!-- 전통 CSS: 클래스명을 만들고, 별도 CSS 파일에서 스타일 작성 -->
<div class="game-card">...</div>
/* game-card { padding: 16px; border-radius: 8px; border: 1px solid #ddd; } */

<!-- Tailwind: HTML에서 직접 유틸리티 클래스 조합 -->
<div class="p-4 rounded-lg border border-gray-200">...</div>
```

- `p-4` → padding 16px
- `rounded-lg` → border-radius 8px
- `border border-gray-200` → 1px solid 회색 테두리
- `dark:bg-gray-800` → 다크 모드일 때 배경색 변경
- `hover:border-indigo-300` → 마우스 올리면 테두리색 변경
- `md:grid-cols-4` → 중간 화면 이상에서 4열 그리드

**Tailwind 4 변경점:** 설정 파일(tailwind.config.js) 없이 CSS import만으로 동작. `@import "tailwindcss"` 한 줄로 설정 완료.

#### React Router 7
React Router는 **SPA(Single Page Application) 라우팅** 라이브러리이다. URL 경로에 따라 다른 컴포넌트를 보여준다.

**핵심 구조:**
```
/ → GameListPage (리다이렉트)
/games → GameListPage (게임 목록)
/games/42 → GameDetailPage (게임 상세, id=42)
/import → ImportPage (게임 가져오기)
```

- `<Outlet />`: 부모 레이아웃(Layout)에서 자식 라우트를 렌더링하는 위치
- `<Link to="/games">`: 페이지 새로고침 없이 URL 이동
- `useParams()`: URL 파라미터 추출 (`/games/:id` → `{ id: '42' }`)

### 변경 파일
| 파일 | 설명 |
|------|------|
| `package.json` | TanStack Query, Zustand, React Router, Tailwind CSS 의존성 추가 |
| `vite.config.ts` | Tailwind CSS 플러그인 + `/api` 프록시 설정 |
| `tsconfig.app.json` | TypeScript 6 호환 (deprecated `baseUrl` 제거) |
| `src/index.css` | Tailwind CSS import로 교체 |
| `src/main.tsx` | AppProviders로 진입점 변경 |
| `src/app/providers.tsx` | QueryClientProvider + RouterProvider |
| `src/app/router.tsx` | 라우트 정의 (/, /games, /games/:id, /import) |
| `src/app/Layout.tsx` | 공통 레이아웃 (헤더 + 네비게이션) |
| `src/shared/api/apiClient.ts` | fetch wrapper + ApiError 클래스 |
| `src/shared/types/api.ts` | PagedResponse, ErrorResponse 타입 |
| `src/shared/components/LoadingSpinner.tsx` | 로딩 스피너 |
| `src/shared/components/ErrorMessage.tsx` | 에러 메시지 + 재시도 버튼 |
| `src/features/game/types/game.ts` | GameResponse, GameFilter, ImportParams 타입 |
| `src/features/game/api/queryKeys.ts` | Query Key Factory |
| `src/features/game/api/gameApi.ts` | 순수 API 함수 (fetchGames, fetchGame, createImportEventSource) |
| `src/features/game/api/queries.ts` | useGames, useGame React Query 훅 |
| `src/features/game/hooks/useGameImport.ts` | SSE import 커스텀 훅 (EventSource + 실시간 상태) |
| `src/features/game/components/GameListPage.tsx` | 게임 목록 (필터, 페이지네이션) |
| `src/features/game/components/GameListItem.tsx` | 게임 목록 항목 (결과 뱃지, 오프닝, 날짜) |
| `src/features/game/components/GameDetailPage.tsx` | 게임 상세 (대국자, 메타 정보, 체스보드 placeholder) |
| `src/features/game/components/ImportPage.tsx` | 게임 Import (폼 + SSE 실시간 진행) |
| `src/features/game/index.ts` | barrel export |
| `frontend/CONVENTIONS.md` | 프론트엔드 코딩 컨벤션 문서 |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| 상태 관리 분리 | React Query (서버) + Zustand (클라이언트) | 서버 캐시와 UI 상태를 명확히 분리, 각자의 역할에 최적화된 도구 사용 |
| 스타일링 | Tailwind CSS 4 | 빠른 프로토타이핑, 다크 모드 기본 지원, 설정 파일 불필요 (v4) |
| SSE 처리 | 커스텀 훅 (useGameImport) | EventSource 생명주기 + React Query 캐시 무효화를 한 곳에서 관리 |
| import alias | `@/` + `ignoreDeprecations: "6.0"` | TypeScript 6에서 `baseUrl`/`paths` deprecated이지만 동작함. `#` subpath imports는 `moduleResolution: "bundler"`와 호환 문제 확인, TS 7 전에 재검토 |
| 페이지 구조 | feature 내부에 페이지 컴포넌트 배치 | 별도 `pages/` 디렉토리 없이 feature 단위로 응집도 유지 |
| QueryClient staleTime | 5분 | 게임 데이터는 import 후 잘 변하지 않으므로 긴 캐시 유효 시간 |

### SSE (Server-Sent Events) 연동 설계

```
[ImportPage] → startImport(params)
    ↓
[useGameImport] → new EventSource('/api/games/import?...')
    ↓
onmessage: 게임 하나씩 수신 → importedGames 배열에 추가 → UI 즉시 반영
    ↓
onerror (stream 종료): EventSource.close() → queryClient.invalidateQueries(['games', 'list'])
    → 게임 목록 페이지로 돌아가면 최신 데이터 자동 로드
```

### TODO
- [ ] 체스보드 뷰어 구현 (react-chessboard + chess.js)
- [ ] Vitest + Testing Library 테스트 환경 구축
- [ ] MSW(Mock Service Worker) 설정
