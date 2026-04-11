# Frontend Coding Conventions

## Tech Stack

| 영역 | 기술 | 버전 |
|------|------|------|
| Framework | React | 19.x |
| Language | TypeScript | 6.x (strict mode) |
| Build | Vite | 8.x |
| Styling | Tailwind CSS | 4.x |
| Server State | TanStack Query (React Query) | 5.x |
| Client State | Zustand | 5.x |
| Routing | React Router | 7.x |
| Chess UI | react-chessboard | 5.x |
| Chess Logic | chess.js | 1.x |
| Test | Vitest + React Testing Library | - |
| Lint | ESLint 9 (flat config) | - |
| Package Manager | pnpm | 10.x |

---

## Project Structure

```
frontend/src/
├── app/                    # 앱 진입점, 라우터 설정, 전역 프로바이더
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx       # QueryClientProvider, RouterProvider 등
├── features/               # 도메인별 feature 모듈 (핵심)
│   ├── game/
│   │   ├── api/            # React Query hooks + API 함수
│   │   ├── components/     # feature 전용 컴포넌트
│   │   ├── hooks/          # feature 전용 커스텀 훅
│   │   ├── stores/         # Zustand store (필요 시)
│   │   ├── types/          # feature 전용 타입
│   │   └── index.ts        # public API (barrel export)
│   ├── analysis/           # (같은 구조)
│   └── review/             # (같은 구조)
├── shared/                 # feature 간 공유 코드
│   ├── api/                # API client (fetch wrapper), 공통 타입
│   ├── components/         # 공통 UI 컴포넌트 (Button, Modal, Layout 등)
│   ├── hooks/              # 공통 커스텀 훅
│   ├── types/              # 공통 타입/인터페이스
│   └── utils/              # 유틸 함수
└── main.tsx                # ReactDOM 렌더링 진입점
```

### 모듈 경계 규칙

- **feature → shared**: 허용
- **feature → 다른 feature**: 금지 (반드시 `index.ts` barrel export를 통해서만 접근)
- **shared → feature**: 금지
- **app → feature, shared**: 허용

---

## Naming Conventions

### 파일명

| 대상 | 패턴 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase.tsx | `GameList.tsx`, `ChessBoard.tsx` |
| 훅 | camelCase.ts (use 접두사) | `useGames.ts`, `useImportGames.ts` |
| API 훅 | camelCase.ts | `queries.ts`, `mutations.ts` |
| 스토어 | camelCase.ts | `gameStore.ts` |
| 타입 | camelCase.ts | `game.ts`, `api.ts` |
| 유틸 | camelCase.ts | `format.ts`, `chess.ts` |
| 테스트 | *.test.tsx / *.test.ts | `GameList.test.tsx` |

### 코드 네이밍

```typescript
// 컴포넌트: PascalCase
export function GameList() { ... }

// 훅: use 접두사 + camelCase
export function useGames() { ... }

// 타입/인터페이스: PascalCase
interface GameResponse { ... }
type GameFilter = { ... }

// 상수: UPPER_SNAKE_CASE
const MAX_PAGE_SIZE = 100

// 함수/변수: camelCase
const fetchGames = async () => { ... }
```

---

## Components

### 규칙

- **Functional components only** — class component 사용 금지
- **Named export** 우선 — `export default` 보다 `export function` 사용
- **Props 타입은 인라인 또는 같은 파일에 정의** — 재사용되는 경우만 별도 파일
- **컴포넌트 파일 하나에 컴포넌트 하나** — 헬퍼 컴포넌트는 같은 파일 내 허용

```typescript
// Good
interface GameListProps {
  source?: GameSource
  timeCategory?: TimeCategory
}

export function GameList({ source, timeCategory }: GameListProps) {
  const { data, isLoading } = useGames({ source, timeCategory })

  if (isLoading) return <LoadingSpinner />

  return (
    <ul>
      {data?.content.map(game => (
        <GameListItem key={game.id} game={game} />
      ))}
    </ul>
  )
}
```

---

## React Query (TanStack Query)

### 구조

각 feature의 `api/` 디렉토리에 API 함수와 Query 훅을 함께 관리한다.

```
features/game/api/
├── gameApi.ts          # 순수 API 함수 (fetch 호출)
├── queries.ts          # useQuery 훅
├── mutations.ts        # useMutation 훅 (필요 시)
└── queryKeys.ts        # Query key factory
```

### Query Key Factory 패턴

```typescript
// queryKeys.ts
export const gameKeys = {
  all: ['games'] as const,
  lists: () => [...gameKeys.all, 'list'] as const,
  list: (filters: GameFilter) => [...gameKeys.lists(), filters] as const,
  details: () => [...gameKeys.all, 'detail'] as const,
  detail: (id: number) => [...gameKeys.details(), id] as const,
}
```

### API 함수와 Query 훅 분리

```typescript
// gameApi.ts — 순수 fetch 함수
export async function fetchGames(params: GameFilter): Promise<PagedGameResponse> {
  const query = new URLSearchParams()
  // ...
  const res = await fetch(`/api/games?${query}`)
  if (!res.ok) throw new ApiError(res)
  return res.json()
}

// queries.ts — React Query 훅
export function useGames(filters: GameFilter = {}) {
  return useQuery({
    queryKey: gameKeys.list(filters),
    queryFn: () => fetchGames(filters),
  })
}
```

### 규칙

- **API 함수는 React에 의존하지 않는다** — 순수 async 함수로 작성
- **Query 훅은 컴포넌트에서 직접 호출** — wrapper 훅은 필요한 경우에만
- **staleTime은 feature별로 적절히 설정** — 게임 목록은 변경이 적으므로 길게
- **Error/Loading 처리는 컴포넌트에서** — 전역 에러 핸들러는 QueryClient 레벨에서 설정

---

## Zustand

클라이언트 전용 상태 (서버 데이터가 아닌 것)에만 사용한다.

### 사용 예시

- 체스보드 현재 수 번호 (네비게이션 상태)
- 사이드바 열림/닫힘
- 필터 UI 상태

### 규칙

- **서버 데이터는 React Query로** — Zustand에 서버 응답을 캐싱하지 않는다
- **스토어는 feature 단위로 분리** — 전역 스토어 남용 금지
- **슬라이스 패턴** — 스토어가 커지면 슬라이스로 분리

```typescript
// stores/boardStore.ts
interface BoardState {
  currentMoveIndex: number
  setMoveIndex: (index: number) => void
  nextMove: () => void
  prevMove: () => void
}

export const useBoardStore = create<BoardState>((set) => ({
  currentMoveIndex: 0,
  setMoveIndex: (index) => set({ currentMoveIndex: index }),
  nextMove: () => set((s) => ({ currentMoveIndex: s.currentMoveIndex + 1 })),
  prevMove: () => set((s) => ({ currentMoveIndex: Math.max(0, s.currentMoveIndex - 1) })),
}))
```

---

## Styling (Tailwind CSS)

### 규칙

- **유틸리티 클래스 우선** — 커스텀 CSS는 최소화
- **반복되는 스타일 조합은 컴포넌트로 추출** — `@apply` 남용 금지
- **다크 모드 지원** — `dark:` 프리픽스 사용
- **반응형** — mobile-first (`sm:`, `md:`, `lg:`)

```tsx
// Good: 컴포넌트로 추출
function Badge({ children, variant }: BadgeProps) {
  const base = 'px-2 py-1 rounded text-sm font-medium'
  const variants = {
    win: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    loss: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    draw: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  }
  return <span className={`${base} ${variants[variant]}`}>{children}</span>
}
```

---

## Routing (React Router)

### 라우트 구조

```typescript
// app/router.tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'games', element: <GameListPage /> },
      { path: 'games/:id', element: <GameDetailPage /> },
      { path: 'import', element: <ImportPage /> },
    ],
  },
])
```

### 규칙

- **페이지 컴포넌트는 feature의 components에 위치** — 별도 `pages/` 디렉토리 불필요
- **URL 파라미터 타입은 명시적으로 파싱** — `Number(params.id)` 등
- **라우트 상수 관리** — 매직 스트링 대신 경로 상수 사용

---

## API Communication

### 규칙

- **base URL은 Vite proxy 또는 환경변수로 관리** — 하드코딩 금지
- **에러 응답은 공통 타입으로 파싱** — 백엔드 `ErrorResponse`와 일치

```typescript
// shared/api/apiClient.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => null)
    throw new ApiError(res.status, error?.message ?? res.statusText)
  }

  return res.json()
}
```

### SSE (Server-Sent Events)

게임 import처럼 스트리밍이 필요한 경우 `EventSource` 또는 `fetch` + `ReadableStream` 사용.

```typescript
// EventSource 패턴
function useGameImport() {
  // EventSource로 SSE 스트리밍 수신
  // onmessage에서 React Query cache를 직접 업데이트
}
```

---

## TypeScript

### 규칙

- **`any` 사용 금지** — `unknown`으로 대체 후 타입 가드 사용
- **`as` 타입 단언 최소화** — 타입 가드 또는 제네릭으로 해결
- **`interface` vs `type`**: API 응답/Props는 `interface`, 유니온/유틸리티는 `type`
- **`enum` 사용 금지** — `as const` 객체 또는 union type 사용

```typescript
// Good: union type
type GameSource = 'LICHESS' | 'CHESS_COM'
type GameResult = 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW'

// Good: as const
const TIME_CATEGORIES = ['ULTRABULLET', 'BULLET', 'BLITZ', 'RAPID', 'CLASSICAL', 'CORRESPONDENCE'] as const
type TimeCategory = typeof TIME_CATEGORIES[number]

// Bad: enum
enum GameSource { LICHESS, CHESS_COM }
```

---

## Testing (Vitest + React Testing Library)

### 구조

테스트 파일은 소스 파일 옆에 위치한다.

```
features/game/components/
├── GameList.tsx
├── GameList.test.tsx
```

### 규칙

- **사용자 행동 기반 테스트** — 구현 디테일(state, props) 테스트 금지
- **`screen` + `userEvent` 우선** — `container.querySelector` 사용 금지
- **API 호출은 MSW로 모킹** — fetch/axios를 직접 모킹하지 않는다
- **테스트 설명은 한국어 허용** — `it('게임 목록을 렌더링한다', ...)`

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('GameList', () => {
  it('게임 목록을 렌더링한다', async () => {
    render(<GameList />, { wrapper: TestProviders })

    expect(await screen.findByText('Magnus vs Hikaru')).toBeInTheDocument()
  })
})
```

---

## Import 순서

```typescript
// 1. React / 외부 라이브러리
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Chess } from 'chess.js'

// 2. shared 모듈 (@/ alias)
import { apiFetch } from '@/shared/api/apiClient'
import { Button } from '@/shared/components/Button'

// 3. feature 내부 모듈
import { useGames } from '../api/queries'
import { GameListItem } from './GameListItem'

// 4. 타입 (type-only import)
import type { GameResponse } from '../types/game'

// 5. 스타일 (있는 경우)
import './GameList.css'
```

> **참고**: TypeScript 6에서 `baseUrl`/`paths`가 deprecated이지만 `ignoreDeprecations: "6.0"`으로 계속 사용 가능합니다.
> TS 7 이전에 `#` prefix alias (package.json `imports` 필드)로 마이그레이션 필요합니다.

---

## 금지 패턴

```typescript
// ❌ any 사용
const data: any = await fetch(...)

// ❌ 컴포넌트 안에서 직접 fetch
function GameList() {
  useEffect(() => { fetch('/api/games').then(...) }, [])  // React Query 사용할 것
}

// ❌ 서버 데이터를 Zustand에 저장
const useStore = create((set) => ({
  games: [],  // React Query로 관리할 것
  setGames: (games) => set({ games }),
}))

// ❌ index.ts 없이 feature 간 직접 import
import { GameList } from '../game/components/GameList'  // index.ts를 통해서만

// ❌ default export
export default function GameList() { ... }  // named export 사용

// ❌ enum
enum Color { WHITE, BLACK }  // union type 사용
```
