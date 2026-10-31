# feature/game-folders-filters 작업내역

게임 목록 개편 — 피그마 시안 **A안(LNB + 펼친 필터)** 기준.
시안: https://www.figma.com/design/2l64N2RGEDFCWoxP1J6B70/?node-id=9-386

## 결정 사항 (A안 시안 기준)
- 레이팅 필터: 상대/나 전환 가능, 기본은 **상대** 레이팅
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
