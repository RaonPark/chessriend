# feature/review-polish-list-analysis 작업내역

PR #24(`feature/board-arrows-settings`) 머지 이후의 후속 작업입니다.
아래 1~6번의 상세 내용은 `feat_board-arrows-settings_작업내역.md`의 11~16번에 있습니다.

## 1. 설정을 헤더 다이얼로그로 (→ 11번)
- 페이지 이동 없이 복기 중에도 설정 변경. `/settings` 페이지 제거
- fix: 다이얼로그 안에서 누른 Esc/방향키가 보드 단축키로 처리되던 문제

## 2. 상태 줄 버튼 글자 2줄 깨짐 수정 (→ 12번)

## 3. 변형선 우클릭 메뉴로 삭제 (→ 13번)
- 공용 `ContextMenu` 컴포넌트 추가

## 4. 변형선 진입 시 첫 수(또는 누른 수)로 바로 이동 (→ 14번)

## 5. 기보와 같은 수는 변형선 없이 진행 + 메모 한글 입력 안정화 (→ 15번)

## 6. cp loss 툴팁이 화면 밖으로 나가지 않도록 (→ 16번)

## 7. 게임 목록에 분석 요약 표시

### What
- `/games` 목록에서 분석이 끝난 게임은 **"분석됨" 배지 + 내 cp loss · Blunder · Mistake** 표시
  - 소유자가 없는 게임(PGN 등)은 백/흑 cp loss를 함께 표시 (`cp loss 16 / 60`)
- 백엔드
  - **도메인** `GameAnalysisSummary` / `SideAnalysisSummary`
    - 분석 결과 → 백·흑별 분류 개수 + 평균 cp loss
    - 평가를 ±1000cp로 제한하는 프론트(`analysisStats.ts`)와 같은 규칙
    - 짝수 `moveIndex` = 백 (표준 시작 포지션 기준)
  - **포트** `GameAnalysisRepository.findByGameIds(ids)`: jOOQ `IN` 쿼리 한 번으로 페이지의 분석을 일괄 조회 (N+1 방지)
  - **유스케이스** `GetGameAnalysisUseCase.findSummaries(ids)`
  - **컨트롤러** `GET /api/games`: 게임 목록과 요약을 합쳐 `GameResponse.analysisSummary`로 응답 (분석 없으면 `null`)
    - 상세 API에서 `getGame` + `findAnalysis`를 합치는 기존 방식과 같음
- 프론트: `GameResponse.analysisSummary` 타입 추가, `GameListItem`에 `AnalysisStats`

### Why
- 목록에서 어떤 게임을 이미 분석했는지, 내가 얼마나 정확하게 뒀는지를 바로 보기 위함
- 게임마다 분석을 따로 불러오면 목록 한 페이지에 요청이 수십 번 → 목록 응답에 요약을 포함
- 마이그레이션 없음 (기존 `game_analyses` 테이블 조회)

### Key files
- `game/domain/analysis/GameAnalysisSummary.kt` (신규)
- `game/port/out/GameAnalysisRepository.kt`, `game/adapter/out/persistence/GameAnalysisPersistenceAdapter.kt`
- `game/port/in/GetGameAnalysisUseCase.kt`, `game/application/GetGameAnalysisService.kt`
- `game/adapter/in/web/GameController.kt`, `GameResponse.kt`
- `frontend/src/features/game/components/GameListItem.tsx`, `types/game.ts`
- 테스트
  - `GameAnalysisSummaryTest`(5), `GetGameAnalysisServiceTest`(+2)
  - `GameAnalysisPersistenceAdapterTest`(+2, Testcontainers), `AnnotationDtoTest`(+2)
  - `GameListItem.test.tsx`(+3)
