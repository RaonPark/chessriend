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

## 5. LNB + 폴더 화면 (프론트)

### What
- **`GameLnb`** (목록 왼쪽, 데스크톱에서 sticky)
  - 모든 게임 / 내 폴더(게임 수, "+"·"+ 새 폴더") / 오프닝별(8개까지, 더보기)
  - 폴더 ⋯ 버튼 또는 우클릭 → 이름 변경 / 폴더 삭제 (삭제 확인 창: 게임은 "모든 게임"에 남는다고 안내)
  - 선택 중인 폴더를 지우면 "모든 게임"으로, 이름을 바꾸면 제목도 갱신
- **`FolderNameDialog`**: 새 폴더 / 이름 변경 공용 창
  - 빈 이름이면 버튼 비활성, 최대 30자
  - 409 → "같은 이름의 폴더가 이미 있어요." (창 유지)
  - 선택한 게임이 있으면 "선택한 게임 N개를 이 폴더에 넣기"(기본 체크)
- **목록 줄 (`GameListItem`)**
  - 폴더 태그 표시
  - 우클릭 → "폴더에 추가" 체크 메뉴: 들어 있는 폴더는 체크, 누르면 넣기/빼기. "+ 새 폴더…"로 만들면서 넣기
  - 폴더 목록은 메뉴를 열 때만 조회
- **목록 화면 (`GameListPage`)**
  - 2단 배치 (LNB + 본문)
  - 제목이 선택에 따라 "내 게임" / 폴더 이름 / 오프닝 이름 + 게임 수로 바뀜
  - 선택 툴바 "폴더에 추가" → 폴더 메뉴 (+ 새 폴더…)
  - **"전체 삭제"는 필터 없이 "모든 게임"을 볼 때만 노출**: 폴더를 보다가 누르면 폴더만 지워질 거라 오해할 수 있는데, 실제로는 모든 게임을 지움
  - 빈 폴더 안내 문구 추가
- **공용 `ContextMenu`** 확장: `checked`(menuitemcheckbox), `title`
- 레이아웃 최대 너비 `max-w-5xl` → `max-w-6xl` (LNB 공간, 시안 A 폭)
- 접근성: LNB 항목 이름과 게임 수 사이 공백 → "Opening 1 20"으로 읽힘 (붙이면 "Opening 120")
- 테스트용 기본 목 핸들러
  - `/api/folders`, `/api/games/openings` 추가
  - openings는 `/api/games/:id`보다 먼저 등록

## 6. 게임 줄 왼쪽 색 띠(accent rail) 제거

### What
- 목록 줄 왼쪽의 승·패·무 색 띠(`border-l-4`)를 제거. 결과는 오른쪽 배지로 표시

### Why
- 사용자 요청

### Key files
- `features/game/components/GameLnb.tsx`, `FolderNameDialog.tsx` (신규)
- `GameListItem.tsx`, `GameListPage.tsx`
- `api/folderApi.ts` (신규), `api/queries.ts`(`useFolders`, `useOpeningCounts`), `api/mutations.ts`(폴더 변경 훅 — 폴더 목록·게임 목록 캐시 함께 무효화)
- `api/queryKeys.ts`, `types/game.ts`, `utils/gameFilters.ts`(`LnbSelection`)
- `shared/components/ContextMenu.tsx`, `app/Layout.tsx`
- `test/mocks/handlers.ts`
- 테스트: `GameLnb.test.tsx`(7), `GameListItem.test.tsx`(+3), `GameListPage.test.tsx`(+3)

## 7. 필터 초기화 버튼 위치 · "통신" → "기타"

### What
- "필터 초기화"를 필터 카드 **오른쪽 위**로 이동 (필터가 걸려 있을 때만 표시)
  - 640px 미만에서는 첫 줄(플랫폼) 버튼과 겹쳐서, 카드 맨 위 별도 줄로 배치
  - 아래의 "조건에 맞는 게임 N개" 안내는 유지
- 시간 필터의 "통신" 라벨을 **"기타"**로 변경 (분류 기준 `CORRESPONDENCE`는 그대로)

### Why
- `CORRESPONDENCE`에는 실제 통신 체스 외에 다른 게임도 섞여 있어 "기타"가 더 정확함
  - 실제 통신 체스: 한 수에 하루~며칠, lichess Correspondence / chess.com Daily
  - 시간 정보가 없거나 해석하지 못한 PGN 게임 (`CreateGameFromPgnService.parseTimeControl`)

## 8. 시간 분류: "일일 체스"와 "기타" 분리 + PGN 시간 정보 해석

### What
- `TimeCategory.OTHER`(기타) 추가
  - CORRESPONDENCE는 **일일 체스**: lichess Correspondence / chess.com Daily
  - OTHER는 시간 정보가 없거나 해석할 수 없는 게임
- PGN 시간 해석을 서비스에서 도메인 `TimeControl.fromPgnTag(raw, event)`로 이동하고 형식 확장
  - `600+5` 기본+증분, `180` 기본만, `*60` 모래시계
  - `40/7200(:3600)` 수/초·구간제 → 첫 구간 기준 / `1/259200`처럼 한 수에 하루 이상 → 일일 체스
  - `[Event]`에 Daily/Correspondence → 일일 체스 (그래서 `ParsedPgn.event` 추가)
  - `-`, `?`, 없음, 해석 불가 → 기타
  - 카테고리 추정(`TimeCategory.infer`)도 도메인으로 이동
- **V6 마이그레이션**: 기존 PGN 게임 중 CORRESPONDENCE로 들어가 있던 것은 일일 체스 흔적(Event Daily/Correspondence 또는 `1/초`)이 없으면 OTHER로 이동
  - 예전 파서가 `600+5` 형식만 읽었기 때문
  - 로컬 DB에서는 시간 정보 없는 PGN 게임 1개가 해당
- 가져오기 조건에 OTHER를 쓰면 400 (lichess/chess.com에는 해당 분류 없음)
- 프론트
  - `TIME_CATEGORY_LABELS`, `formatTimeControl` 공용 유틸 추가
  - 필터: "일일 체스" + "기타"
  - 목록·상세에서 영어 분류명 대신 한글 표시. 기타는 시간 없이 "기타"만

### Key files
- `game/domain/TimeControl.kt`, `ParsedPgn.kt`, `application/CreateGameFromPgnService.kt`
- `adapter/out/chess/ChesslibAdapter.kt`(Event 추출), `LichessClient.kt`, `ChessComClient.kt`
- `db/migration/V6__reclassify_pgn_time_category.sql`
- `frontend/.../utils/timeCategory.ts`(신규), `GameFilters.tsx`, `GameListItem.tsx`, `GameInfoPanel.tsx`, `types/game.ts`
- 테스트: `TimeControlTest`(+7), `CreateGameFromPgnServiceTest`(+1), `ChesslibAdapterTest`(Event), `timeCategory.test.ts`(2)

## 9. fix: 체크메이트로 끝낸 수가 Blunder로 나오던 문제 (+ 평균 cp loss 왜곡)

### 증상
- Evergreen game(PGN)의 마지막 수 **24.Bxe7#**이 blunder (cpLoss 19999)
- 이긴 Anderssen의 평균 cp loss(113)가 진 Dufresne(70)보다 높게 나옴

### 원인
- UCI는 메이트된 포지션을 **부호 없는 `mate 0`**으로 준다. 백 관점으로 뒤집어도 0이라 **누가 이겼는지 정보가 사라짐**
- 분석기(`MoveClassifier.evalToCp`)는 `mate 0`을 "백이 메이트당함"(-10000)으로 해석
  → 백이 메이트시킨 수가 최대 손실로 계산됨
- 평균 cp loss 계산(백엔드 `GameAnalysisSummary`, 프론트 `cpLoss.ts`)도 같은 이유로 그 수를 2000점 손실로 반영

### What
- 규칙: **수를 둔 직후 평가가 `mate 0`이면 방금 둔 쪽이 메이트시킨 것**
  - 분류: `MoveClassifier.evalAfterMoveToCp(score, moverIsWhite)`를 `GameAnalyzer`에 적용
  - 평균 cp loss: 백엔드 `GameAnalysisSummary`, 프론트 `moveCpLoss` 모두 적용
- **V7 마이그레이션**: 이미 저장된 분석에서 수 직후 `mate 0`인 수를 cpLoss 0 + 분류 없음으로 보정 (재분석 불필요)
- 로컬 DB 확인 (Evergreen)
  - 24.Bxe7# → cpLoss 0, 분류 없음
  - 평균 cp loss: Anderssen 113 → **30**, Dufresne 70 (그대로)

### Key files
- `domain/analysis/MoveClassifier.kt`, `GameAnalyzer.kt`, `GameAnalysisSummary.kt`
- `frontend/.../utils/cpLoss.ts`
- `db/migration/V7__fix_checkmate_move_classification.sql`
- 테스트: `GameAnalyzerTest`(+1, 백·흑), `GameAnalysisSummaryTest`(+1), `cpLoss.test.ts`(+1)

## 10. 기보 기호 표시 (!! / ?? / ? / ?!)

### What
- 수 목록에서 분석 분류에 따라 수 옆에 기보 기호 표시
  - Brilliant `!!`, Blunder `??`, Mistake `?`, Inaccuracy `?!`
  - 예전에는 Brilliant만 `!!`
- 대국자 바: Blunder·Mistake만 보이던 것을 **네 분류 모두 기호로 표시** (`!! 0 ?? 1 ? 0 ?! 2 cp loss 40`)
  - 공간 문제로 두 개만 넣었던 것을 기호로 줄여서 전부 들어가게 함
  - 기호에 마우스를 올리면 이름(title), 화면 낭독기는 aria-label("Blunder 1")
- 공용 `MOVE_SYMBOLS` 유틸 (기호·이름·색)

### Key files
- `frontend/.../utils/moveSymbols.ts` (신규), `MoveList.tsx`, `PlayerBar.tsx`
- 테스트: `moveSymbols.test.ts`, `MoveList.test.tsx`(+1), `PlayerBar.test.tsx`(수정)
