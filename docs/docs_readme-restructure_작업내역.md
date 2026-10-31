# docs/readme-restructure 작업내역

## 1. README 재구성: 체스 사용자용 루트 README + 기술 문서 `src/README.md`

### What
- **루트 `README.md`**: 앱이 무엇이고 어떤 체스 기능이 있는지 위주로 새로 작성
  - 할 수 있는 것
    - 게임 가져오기 (Lichess·Chess.com·PGN, PGN 시간 분류 해석)
    - 목록 정리 (분석 요약·필터·폴더·오프닝별·애칭/메모)
    - 복기 (대국자 바·둘 수 있는 칸·화살표·엔진 최선수·변형선·메모·단축키)
    - 엔진 분석, 설정
  - 분석 결과 읽는 법
    - 기보 기호 `!! ?! ? ??`와 Win% 손실 기준 (10/20/30%p, Brilliant 2%p 미만)
    - 평균 cp loss (±1000 제한, 메이트 처리, Evergreen 예시)
  - 체스 용어 (PGN, FEN, 변형선, 평가, 일일 체스, ECO), 짧은 시작하기, 문서 안내
- **`src/README.md`** (신규): 기존 루트 README의 기술 내용을 옮기고 낡은 부분을 함께 갱신
  - REST API를 게임/분석/폴더로 나눠 전부 정리
    - 이전에는 `/openings`, `/note`, `/api/folders`, 목록 필터 파라미터, import 쿼리가 빠져 있었음
  - DB 마이그레이션 표 V1~V8 (이전 디렉터리 요약은 V1~V4)
  - 트랜잭션: "`@Transactional` 미사용" → `FolderService` 사용으로 정정
  - `bindQuery`의 null 바인딩(`bindNull`), 검색 조건(`GameSearchCriteria`)
  - 마이그레이션 후 백엔드 재시작 안내, 훅 표에 `readme-check.sh`, MCP에 playwright
  - 링크 경로를 `src/` 기준으로 변경

## 2. 낡은 문서 정리

### What
- 레이어 README 5개: 빠진 클래스·메서드를 추가하고 바뀐 시그니처를 갱신
  - `game/domain`: `Folder`, `GameNote`, `GameSearchCriteria`, `GameAnalysisSummary`, `BoardArrow`, `TimeCategory.OTHER`·`fromPgnTag`, 메이트 처리
  - "분석 로직은 프론트 `classification.ts`와 동일해야 한다" → 분류는 백엔드에서만 계산(프론트 함수는 미사용), **평균 cp loss 규칙은 백엔드 `GameAnalysisSummary`와 프론트 `cpLoss.ts`가 같아야 함**으로 정정
  - `game/port`: `getGames(…criteria)`, `getOpeningCounts`, `updateNote`, `findSummaries`, `ManageFolderUseCase`, `FolderRepository`, `findByGameIds`
  - `game/application`: `FolderService`, 트랜잭션 설명 정정, PGN 시간 해석
  - `game/adapter`: `FolderController`, `FolderPersistenceAdapter`, 엔드포인트, DTO, `bindQuery` 예시(null 처리)
  - `shared`: 예외 표에 `FolderNotFoundException`(404), `DuplicateFolderNameException`(409)
- `frontend/README.md`
  - `features/settings`, `ContextMenu`, 새 컴포넌트(LNB·필터·대국자 바·폴더·애칭/메모), 새 유틸
  - 보드 상태(화살표·기보 일치 수 처리), 쿼리키·무효화 규칙, 설정 다이얼로그
  - 틀린 설명 정정: `BoardControls` "메모 저장" → 키보드 단축키
- `docs/architecture.md`: 프론트 구조에서 **실제로 없는 `analysis/`, `review/` feature** 제거 (`game/`에 통합된 배경 한 줄 추가)

### Why
- PR #24~#26으로 기능이 크게 늘었지만 README는 초기 상태라 기능 소개와 API가 실제와 달랐음
- 사용자 요청: 루트 README는 체스 기능 소개 위주로, 기술 내용은 `src/README.md`로 분리
- 작업 내역(`docs/*_작업내역.md`)은 당시 기록이라 고치지 않음 (예: 지금은 없어진 `/settings` 페이지 언급)

### Key files
- `README.md`, `src/README.md`(신규)
- `src/main/kotlin/.../game/{domain,application,port,adapter}/README.md`, `shared/README.md`
- `frontend/README.md`, `docs/architecture.md`

### 확인
- 레이어 README마다 해당 패키지의 모든 `.kt` 클래스 이름이 언급되는지 스크립트로 확인 → 누락 0
- README 4개의 상대 링크가 모두 실제 파일을 가리키는지 확인 → 깨진 링크 0
