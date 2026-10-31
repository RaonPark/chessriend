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

## 3. 목록 화면 정리 + 게임 이름 변경을 목록 우클릭으로 이동

### What
- **목록 줄 레이아웃**
  - 분석 요약(`분석됨` · cp loss · Blunder · Mistake)과 폴더 태그를 **항상 오프닝 줄 아래 별도 줄**로
    - 예전에는 줄 길이에 따라 오프닝 줄에 붙었다가(PGN 게임) 다음 줄로 넘어갔다가(가져온 게임) 해서 모양이 들쭉날쭉했음
  - 카드 안쪽 여백 `p-4` → `px-5 py-4`, 줄 간격 `space-y-1.5`, 카드 사이 간격 `space-y-2` → `space-y-3`
  - fix: 왼쪽 정보가 길어지면 오른쪽 결과 배지가 "패/배"로 세로로 깨지고 날짜가 두 줄로 접히던 문제 (오른쪽 `shrink-0` + `whitespace-nowrap`)
- **게임 이름 변경**
  - 상세 화면의 "+ 게임 이름 붙이기"·수정 버튼을 없애고, `/games` 목록에서 **우클릭 → "게임 이름 변경"**으로 이동
  - 비우고 저장하면 이름 삭제, 기존 게임 메모는 함께 보내 유지
  - 상세 화면의 이름은 표시 전용(`GameNicknameHeader`)
- 우클릭 메뉴 구성: 게임 이름 변경 → 구분선 → "폴더에 추가" 체크 목록
  - 공용 `ContextMenu`에 `separator`·`heading` 항목 추가. 방향키 이동은 실행 항목만
  - 폴더 목록이 도착하기 전에도 메뉴가 바로 열림
- `FolderNameDialog` → **`NameDialog`**로 일반화
  - 입력칸 이름·최대 길이·안내 문구·빈 값 허용·409 문구를 props로 받음
  - 폴더 생성·폴더 이름 변경·게임 이름 변경에서 공용

### Why
- 사용자 요청
  - "분석됨"이 게임마다 다른 줄에 있음 → 별도 줄로, 여백을 더
  - 게임 이름은 목록에서 우클릭으로 붙이고 싶음

### Key files
- `frontend/.../components/GameListItem.tsx`, `NameDialog.tsx`(← `FolderNameDialog.tsx`), `GameNote.tsx`, `GameDetailPage.tsx`, `GameListPage.tsx`, `GameLnb.tsx`
- `shared/components/ContextMenu.tsx`
- 테스트: `GameListItem.test.tsx`(+3), `GameNote.test.tsx`(애칭 표시 전용으로 변경), `ContextMenu.test.tsx`(+1)

## 4. README 사용 가이드 + 스크린샷

### What
- 루트 README를 **사용 순서대로 된 가이드**로 재구성 (가져오기 → 목록 정리 → 분석·복기 → 기록 → 설정)
- 화면 사진 10장 (`docs/images/guide/`)
  - 가져오기(온라인·PGN), 게임 목록, 우클릭 메뉴, 이름 변경, 복기, 변형선과 메모, 경기 정보, 다크 모드, 설정
- PGN 시간 해석 표는 접이식(`<details>`)으로

### 스크린샷을 만든 방법
- **게임 목록**: 실제 사용자 게임에는 상대 플레이어 닉네임이 있어 공개 저장소에 올리지 않고, **가상 데모 데이터**(alice, bob 등)로 촬영
- **복기 화면**: 공개 명국 *Evergreen Game*(1852)의 실제 분석 데이터
  - 최신 코드 백엔드를 8082에 임시로 띄워 조회 (사용자 백엔드 8081은 건드리지 않음)
  - 애칭·메모·21수 화살표는 응답에만 덧씌움 (쓰기 요청은 브라우저에서 가로채 **DB 변경 없음**)
  - 촬영 후 8082 종료

### 알려진 문제 (이번 범위 밖)
- PGN 날짜가 `1852.??.??`처럼 월·일이 비어 있으면 해석에 실패해 **가져온 시각**이 대국 날짜로 저장됨 (Evergreen이 2026년으로 표시)
