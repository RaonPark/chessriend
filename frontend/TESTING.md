# 프론트엔드 테스트 가이드

## Tech Stack

| 패키지 | 버전 | 역할 |
|--------|------|------|
| Vitest | 4.1.x | 테스트 러너 (Vite 8 네이티브 호환) |
| @testing-library/react | 16.3.x | React 19 컴포넌트 테스트 |
| @testing-library/jest-dom | 6.9.x | DOM matcher 확장 (`toBeInTheDocument()` 등) |
| @testing-library/user-event | 14.6.x | 사용자 인터랙션 시뮬레이션 |
| MSW (Mock Service Worker) | 2.13.x | API 모킹 (fetch 인터셉트) |
| jsdom | 29.x | 브라우저 환경 시뮬레이션 |
| @vitest/coverage-v8 | 4.1.x | 코드 커버리지 |

## 실행 방법

```bash
cd frontend

# watch 모드 (개발 중)
pnpm test

# 단일 실행 (CI)
pnpm test:run

# 커버리지 리포트
pnpm test:coverage

# 특정 파일만 실행
npx vitest run src/shared/api/__tests__/apiClient.test.ts
```

## 디렉토리 구조

```
src/
├── test/                         # 테스트 인프라
│   ├── setup.ts                  # 전역 셋업 (jest-dom, MSW lifecycle, dialog polyfill)
│   ├── test-utils.tsx            # renderWithProviders (QueryClient + MemoryRouter)
│   └── mocks/
│       ├── server.ts             # MSW setupServer
│       ├── handlers.ts           # 기본 API 핸들러
│       └── fixtures.ts           # 테스트 데이터 팩토리
├── shared/
│   ├── api/__tests__/            # apiClient 단위 테스트
│   ├── hooks/__tests__/          # useConfirm 훅 테스트
│   └── components/__tests__/     # 공통 컴포넌트 테스트
└── features/game/
    ├── api/__tests__/            # gameApi 단위 테스트
    ├── hooks/__tests__/          # useGameImport 훅 테스트
    └── components/__tests__/     # 페이지 컴포넌트 테스트
```

## 테스트 패턴

### 1. 컴포넌트 테스트: `renderWithProviders`

React Query, React Router 등 Provider가 필요한 컴포넌트는 `renderWithProviders`를 사용한다.

```tsx
import { renderWithProviders } from '@/test/test-utils'

it('게임 목록을 렌더링한다', async () => {
  renderWithProviders(<GameListPage />)
  await waitFor(() => {
    expect(screen.getByText('내 게임')).toBeInTheDocument()
  })
})
```

`initialEntries`로 라우트 파라미터를 지정할 수 있다:

```tsx
renderWithProviders(
  <Routes>
    <Route path="/games/:id" element={<GameDetailPage />} />
  </Routes>,
  { initialEntries: ['/games/42'] },
)
```

### 2. API 모킹: MSW

기본 핸들러(`handlers.ts`)로 일반적인 API를 모킹하고, 개별 테스트에서 `server.use()`로 오버라이드한다.

```tsx
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'

it('에러 시 에러 메시지를 표시한다', async () => {
  server.use(
    http.get('/api/games', () => HttpResponse.json({ message: 'Error' }, { status: 500 })),
  )
  renderWithProviders(<GameListPage />)
  await waitFor(() => {
    expect(screen.getByText('게임 목록을 불러오지 못했습니다.')).toBeInTheDocument()
  })
})
```

### 3. 테스트 데이터: Fixture Factory

`fixtures.ts`의 팩토리 함수로 테스트 데이터를 생성한다. `overrides`로 필요한 필드만 커스터마이즈한다.

```tsx
import { createGameResponse, createPagedResponse } from '@/test/mocks/fixtures'

const game = createGameResponse({
  ownerUsername: 'alice',
  white: { name: 'Alice', rating: 1500 },
  result: '1-0',
})
```

### 4. 사용자 인터랙션: userEvent

`@testing-library/user-event`를 사용한다. `fireEvent`보다 실제 사용자 행동에 가깝다.

```tsx
const user = userEvent.setup()
await user.click(screen.getByText('삭제'))
await user.type(screen.getByPlaceholderText('닉네임'), 'testuser')
```

### 5. 훅 테스트: renderHook

React 훅은 `renderHook`으로 독립 테스트한다.

```tsx
const { result } = renderHook(() => useConfirm())

act(() => {
  result.current.confirm({ title: '제목', message: '내용' })
})

expect(result.current.dialogProps.open).toBe(true)
```

## 컨벤션

- **파일 위치**: `__tests__/` 디렉토리에 `{원본파일명}.test.{ts,tsx}` 형식
- **테스트 설명**: 한국어로 작성 ("~한다", "~를 표시한다")
- **테스트 구조**: `describe` (모듈명) > `it` (구체적 동작)
- **비동기 데이터**: MSW + `waitFor`로 데이터 로딩 대기
- **DOM 쿼리 우선순위**: `getByRole` > `getByText` > `getByPlaceholderText` > `container.textContent`
  - 텍스트가 여러 요소에 분산된 경우 `container.textContent`를 사용
  - HTML entity 포함 텍스트는 정규식(`/게임 목록/`) 사용

## 알려진 제한사항

- **jsdom `<dialog>` 미지원**: `setup.ts`에서 `showModal()`/`close()` polyfill 추가
- **EventSource 미지원**: 테스트에서 직접 MockEventSource 클래스를 정의하여 사용
- **MSW `onUnhandledRequest: 'error'`**: 모킹하지 않은 API 호출 시 테스트 실패 — 의도적으로 누락된 모킹을 빠르게 발견
