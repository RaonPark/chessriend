# feat/frontend-test — 프론트엔드 테스트 환경 구축

## 2026-04-13: 테스트 인프라 + 전체 테스트 코드 작성

### 무엇을

프론트엔드 테스트 환경을 처음부터 구축하고, 기존 모든 컴포넌트/훅/API 함수에 대한 테스트를 작성했다.

**테스트 인프라:**
- Vitest 4.1.4 + jsdom 29.0.2 테스트 러너 세팅
- @testing-library/react 16.3.2 (React 19 호환)
- MSW 2.13.2 API 모킹 인프라
- `renderWithProviders` 테스트 유틸리티 (QueryClient + MemoryRouter)
- 테스트 데이터 팩토리 (`createGameResponse`, `createPagedResponse`)
- jsdom `<dialog>` showModal/close polyfill

**테스트 코드 (12 파일, 82 테스트):**
- 단위 테스트: `apiClient` (7), `gameApi` (11)
- 훅 테스트: `useConfirm` (4), `useGameImport` (6)
- 공통 컴포넌트: `ConfirmDialog` (8), `Dropdown` (6), `ErrorMessage` (4), `LoadingSpinner` (1)
- 페이지 컴포넌트: `GameListItem` (9), `GameListPage` (9), `GameDetailPage` (8), `ImportPage` (8)

**문서:**
- `frontend/TESTING.md` — 테스트 가이드 (실행법, 패턴, 컨벤션)

### 왜
- Analysis/Review 도메인 추가 전에 테스트 패턴을 확립하여 이후 개발 시 재사용
- 리팩터링 안전망 확보 — UI 변경 시 기존 동작이 깨지는 것을 빠르게 감지
- MSW 기반 API 모킹으로 백엔드 의존 없이 프론트엔드 독립 테스트 가능

### 기술 스택 선정 이유

#### Vitest 4.1.4
Jest 대신 Vitest를 선택한 이유:
- **Vite 네이티브 호환**: vite.config.ts의 alias, 플러그인 설정을 그대로 공유
- **ESM 우선**: TypeScript + ESM 프로젝트에서 별도 변환 설정 불필요
- **속도**: Vite의 모듈 변환 파이프라인 활용으로 Jest 대비 빠른 실행
- **Vitest 4.x**: Vite 8과 네이티브 호환, Node.js 20+ 요구

#### MSW 2.x (Mock Service Worker)
`vi.mock('fetch')` 대신 MSW를 선택한 이유:
- **네트워크 레벨 모킹**: fetch를 직접 모킹하면 구현 세부사항에 종속됨. MSW는 실제 네트워크 요청을 인터셉트하여 더 안정적
- **핸들러 재사용**: 기본 핸들러를 정의하고, 개별 테스트에서 `server.use()`로 오버라이드
- **MSW 2.x**: Fetch API Response 인스턴스 사용, `msw/node` entrypoint 분리

#### @testing-library/react 16.3.x
- React 19 호환
- "사용자 관점 테스트" 철학 — DOM 구현이 아닌 사용자가 보고 상호작용하는 것을 테스트

### 변경 파일

| 파일 | 설명 |
|------|------|
| `package.json` | test dependencies + scripts 추가 |
| `vitest.config.ts` | Vitest 설정 (jsdom, globals, coverage) |
| `src/test/setup.ts` | jest-dom, MSW lifecycle, dialog polyfill |
| `src/test/test-utils.tsx` | renderWithProviders wrapper |
| `src/test/mocks/server.ts` | MSW setupServer |
| `src/test/mocks/handlers.ts` | 기본 API 핸들러 |
| `src/test/mocks/fixtures.ts` | 테스트 데이터 팩토리 |
| `src/shared/api/__tests__/apiClient.test.ts` | apiFetch, ApiError 단위 테스트 |
| `src/features/game/api/__tests__/gameApi.test.ts` | fetchGames, deleteGame 등 단위 테스트 |
| `src/shared/hooks/__tests__/useConfirm.test.ts` | useConfirm 훅 테스트 |
| `src/features/game/hooks/__tests__/useGameImport.test.ts` | useGameImport 훅 테스트 |
| `src/shared/components/__tests__/ConfirmDialog.test.tsx` | ConfirmDialog 컴포넌트 테스트 |
| `src/shared/components/__tests__/Dropdown.test.tsx` | Dropdown 컴포넌트 테스트 |
| `src/shared/components/__tests__/ErrorMessage.test.tsx` | ErrorMessage 컴포넌트 테스트 |
| `src/shared/components/__tests__/LoadingSpinner.test.tsx` | LoadingSpinner 컴포넌트 테스트 |
| `src/features/game/components/__tests__/GameListItem.test.tsx` | GameListItem 컴포넌트 테스트 |
| `src/features/game/components/__tests__/GameListPage.test.tsx` | GameListPage 페이지 테스트 |
| `src/features/game/components/__tests__/GameDetailPage.test.tsx` | GameDetailPage 페이지 테스트 |
| `src/features/game/components/__tests__/ImportPage.test.tsx` | ImportPage 페이지 테스트 |
| `frontend/TESTING.md` | 테스트 가이드 문서 |

### 의사결정 기록

| 결정 | 선택 | 이유 |
|------|------|------|
| 테스트 러너 | Vitest 4.x | Vite 8 네이티브 호환, ESM 우선, 빠른 속도 |
| API 모킹 | MSW 2.x | 네트워크 레벨 모킹으로 구현 종속성 최소화 |
| 컴포넌트 테스트 | @testing-library/react | 사용자 관점 테스트 철학 |
| dialog polyfill | setup.ts에서 전역 추가 | jsdom이 `<dialog>` 미지원 |
| EventSource 모킹 | 테스트 내 MockEventSource 클래스 | jsdom 미지원 + 이벤트 핸들러 직접 호출로 제어 가능 |
| MSW 모드 | `onUnhandledRequest: 'error'` | 누락된 모킹을 즉시 발견하여 테스트 신뢰성 향상 |
| 테스트 설명 언어 | 한국어 | CLAUDE.md 컨벤션 — 한국어 주석 허용, UI도 한국어 |
| 파일 배치 | `__tests__/` 디렉토리 | feature-based 구조에 맞춰 테스트도 feature 내부 배치 |

### TODO
- [ ] MSW 핸들러에 SSE 스트리밍 응답 추가 (ImportPage 통합 테스트용)
- [ ] Analysis/Review 도메인 추가 시 해당 도메인 테스트 패턴 재사용
- [ ] CI 파이프라인에 `pnpm test:run` 스텝 추가
