# feature/game-folders-filters 작업내역

게임 목록 개편 — 피그마 시안 **A안(LNB + 펼친 필터)** 기준.
시안: https://www.figma.com/design/2l64N2RGEDFCWoxP1J6B70/?node-id=9-386

## 결정 사항 (A안 시안 기준)
- 레이팅 필터: **상대 레이팅** 기준 (처음엔 상대/나 전환 토글을 넣었으나 사용자 요청으로 제거 → #1-1)
- 결과 필터: **소유자 관점**. 소유자가 없는 게임(PGN 등)은 승·패에 걸리지 않고 무승부만 결과로 판단
- 레이팅 필터: 소유자가 없는 게임은 "상대/나"를 정할 수 없어 걸리지 않음 (레이팅 없음 포함)
- 폴더: 게임 하나가 여러 폴더에 속할 수 있음 / 오프닝별 묶음은 오프닝 이름 기준
- 드래그 앤 드롭으로 폴더에 넣기는 이번 범위에서 제외 (우클릭 메뉴·선택 툴바로 대체)

## 1. 결과·레이팅 필터

### What
- 백엔드
  - **도메인** `GameSearchCriteria`: 플랫폼·시간·결과(`OwnerOutcome` WIN/LOSS/DRAW)·레이팅 구간(`RatingBand`)·기준(`RatingBasis` OPPONENT/ME)
    - 레이팅 구간: ~1199 / 1200–1499 / 1500–1799 / 1800–2099 / 2100+ / UNRATED
  - `GameRepository.findAll/count`, `GetGameUseCase.getGames`를 개별 인자에서 **조건 객체** 하나로 변경 (뒤에 오프닝·폴더 조건을 같은 방식으로 추가하기 위함)
  - jOOQ 조건(`conditionOf`)
    - 소유자 쪽 판별: `lower(white_name) = lower(owner_username)` (owner가 빈 문자열이면 false)
    - 기준 쪽 레이팅은 `CASE`로 선택
    - `bindQuery`가 null 파라미터를 못 받으므로 null 비교는 `isNull()`만 사용
  - `GET /api/games`에 `outcome`, `ratingBand`, `ratingBasis`(기본 OPPONENT) 파라미터 추가
- 프론트
  - `GameFilters` 컴포넌트: 플랫폼·시간·결과·레이팅(상대/나 토글) 버튼 줄
    - 접근성: `radiogroup`/`radio`
    - 기존 플랫폼·시간 필터도 같은 컴포넌트로 통일
  - 필터 사용 중: "조건에 맞는 게임 N개" + "필터 초기화"
  - 필터 결과 0개면 "가져온 게임 없음" 대신 "조건에 맞는 게임이 없습니다"
  - `fetchGames`: 레이팅 구간이 있을 때만 `ratingBasis` 전송

### Key files
- `game/domain/GameSearchCriteria.kt` (신규), `GamePersistenceAdapter.kt`, `GameRepository.kt`
- `GetGameUseCase.kt`, `GetGameService.kt`, `GameController.kt`
- `frontend/.../components/GameFilters.tsx` (신규), `utils/gameFilters.ts` (신규), `GameListPage.tsx`, `api/gameApi.ts`, `types/game.ts`
- 테스트
  - `GamePersistenceAdapterTest.SearchCriteria`(5, Testcontainers. 테스트마다 고유 접두어로 데이터 격리)
  - 기존 호출부를 조건 객체로 변경
  - `GameListPage.test.tsx`(+5), `gameApi.test.ts`(+2)

## 2. 오프닝별 묶음 (백엔드)

### What
- `GET /api/games/openings`: 오프닝 이름별 게임 수 (많은 순, 같으면 이름순, 오프닝 없는 게임 제외) → LNB "오프닝별" 목록
  - 컨트롤러 테스트로 `/{id}` 경로와 충돌하지 않음을 확인
- 검색 조건 `opening`(오프닝 이름 정확히 일치) 추가 → `GET /api/games?opening=...`
- 도메인 `OpeningCount`, `GameRepository.countByOpening`, `GetGameUseCase.getOpeningCounts`

### Key files
- `GameSearchCriteria.kt`, `GamePersistenceAdapter.kt`(`countByOpening`, 조건 추가)
- `GameRepository.kt`, `GetGameUseCase.kt`, `GetGameService.kt`, `GameController.kt`, `GameResponse.kt`(`OpeningCountResponse`)
- 테스트: `GamePersistenceAdapterTest.Openings`(2), `GetGameServiceTest`(+1), `GameControllerTest`(+1)

## 1-1. 레이팅 필터를 상대 레이팅으로 고정

### What
- 상대/나 전환 토글과 `RatingBasis`(백엔드 enum, `ratingBasis` 파라미터, 프론트 타입)를 제거
- 레이팅 구간은 항상 **상대(소유자 반대편) 레이팅** 기준. 필터 줄 이름도 "상대 레이팅"으로 변경

### Why
- 사용자 피드백: 상대/나 전환이 굳이 필요 없음 → 상대 레이팅으로 고정 (상대 수준별 복기가 주 용도)

## 3. 폴더 (백엔드)

### What
- **DB** `V5__create_folders.sql`
  - `folders(id, name UNIQUE, created_at, updated_at)`
  - `game_folders(game_id, folder_id)`: 다대다, PK (game_id, folder_id), 양쪽 FK `ON DELETE CASCADE`
  - → 폴더를 지워도 게임은 남고 연결만 삭제. 게임을 지우면 폴더 연결도 삭제
- **도메인** `Folder`(이름 trim, 1~30자 — 어기면 400), `FolderSummary`(폴더 + 게임 수)
- **포트** `FolderRepository`, `ManageFolderUseCase` / **서비스** `FolderService`
  - 이름 중복 사전 검사 → 409, 없는 폴더 → 404
  - 생성·이름 변경·삭제는 `@Transactional` (이 코드베이스에서 처음 사용. R2DBC 트랜잭션 매니저로 정상 동작 확인)
- **어댑터** `FolderPersistenceAdapter` (jOOQ + R2DBC)
  - 게임 넣기는 `INSERT ... SELECT FROM games WHERE id IN (...) ON CONFLICT DO NOTHING` → 없는 게임·이미 들어 있는 게임 무시
  - 동시 생성으로 유니크 제약 위반(`DuplicateKeyException`) 시 `DuplicateFolderNameException`으로 변환
- **API** `/api/folders`

  | 메서드 | 경로 | 응답 |
  |---|---|---|
  | GET | `/api/folders` | 목록 + 게임 수 (생성 순) |
  | POST | `/api/folders` | `{name, gameIds?}` → 201 |
  | PATCH | `/api/folders/{id}` | 이름 변경 |
  | DELETE | `/api/folders/{id}` | 204 |
  | POST | `/api/folders/{id}/games` | 게임 넣기 (body: ID 배열) → 204 |
  | DELETE | `/api/folders/{id}/games` | 게임 빼기 → 204 |

- **게임 목록**
  - `GET /api/games?folderId=` 필터 (`IN (SELECT game_id FROM game_folders ...)`)
  - 응답 `GameResponse.folders`(폴더 태그 `{id, name}`). 페이지 단위 일괄 조회

### Why
- 게임 하나가 여러 폴더에 속할 수 있어야 함 (예: "시실리안 연구"이면서 "블리츠 패배 복기") → 다대다 연결 테이블
- 이름 대소문자는 구분 (단일 사용자 앱이라 단순하게)

### Key files
- `db/migration/V5__create_folders.sql`
- `game/domain/Folder.kt`
- `port/out/FolderRepository.kt`, `port/in/ManageFolderUseCase.kt`, `application/FolderService.kt`
- `adapter/out/persistence/FolderPersistenceAdapter.kt`, `adapter/in/web/FolderController.kt`
- `GameController.kt`, `GameResponse.kt`, `GamePersistenceAdapter.kt`(folderId 조건)
- `shared/exception/Exceptions.kt`(`FolderNotFoundException`, `DuplicateFolderNameException`)
- 테스트
  - `FolderTest`(3), `FolderServiceTest`(8)
  - `FolderPersistenceAdapterTest`(7, Testcontainers), `FolderControllerTest`(3, API 통합)

## 4. 화면 테마 설정 (시스템 / 라이트 / 다크)

### What
- 설정 다이얼로그에 "화면 > 테마" 추가 (기본: 시스템). 선택 즉시 적용, localStorage에 저장
- Tailwind `dark:` 변형을 OS 설정(`prefers-color-scheme`) 기준에서 **`<html class="dark">` 기준**으로 변경 (`index.css`의 `@custom-variant dark`)
- `useThemeSync`(Layout에서 호출)
  - 설정값 → `<html>`의 `dark` 클래스와 `color-scheme` 반영
  - "시스템"이면 OS 설정 변경(`matchMedia` change)도 따라감
- 깜빡임 방지: `index.html` 인라인 스크립트가 React보다 먼저 저장된 테마를 적용 (새로고침 시 라이트로 잠깐 보였다 바뀌는 현상 방지)

### Why
- 사용자 요청: OS 설정과 무관하게 앱 테마를 직접 고르고 싶음
- 브라우저 확인
  - 다크 선택 즉시 적용, 새로고침 후에도 유지
  - 시스템 모드에서 OS를 다크로 바꾸면 바로 다크로 바뀜

### Key files
- `features/settings/utils/theme.ts`(`resolveTheme`, `applyTheme`), `hooks/useThemeSync.ts`
- `stores/settingsStore.ts`(`theme`), `components/SettingsDialog.tsx`
- `app/Layout.tsx`, `index.css`, `index.html`
- 테스트: `theme.test.ts`(3), `SettingsDialog.test.tsx`(+1)
