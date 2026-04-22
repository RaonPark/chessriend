# fix/chesscom-import-latest-first 작업 내역

> 현재 브랜치(`feat/brilliant-classification`)에서 발견한 임포트 버그. 별도 fix 브랜치로 분리 권장.

## 2026-04-22: chess.com 임포트가 최신 게임을 놓치는 문제 수정

### 증상
- 사용자가 4/21, 4/22에 chess.com에서 경기했는데 임포트하면 들어오지 않음
- 이미 임포트된 4/17 이전 게임만 반복 시도되는 듯한 동작

### 원인 (두 가지 결함이 결합)

1. **chess.com PubAPI 자체가 oldest-first 반환** (월 내부)
   - `/pub/player/{u}/games/{YYYY}/{MM}` 은 `end_time` 오름차순으로 고정
   - 쿼리 파라미터로 순서 변경 불가
   - `ChessComClient.fetchGames`는 **월 목록만 `.reversed()`** 했고, 월 내부 게임 순서는 그대로 emit → 4월 아카이브의 1일 게임부터 emit됨

2. **`max`가 중복 제거 이전에 적용**
   - `ChessComClient`가 내부에서 `emitted >= criteria.max` 로 자체 제한
   - `ImportGameService`는 이후에 `existsBySourceGameId`로 중복을 걸러냄
   - 즉 `max=N` 의미가 "API가 반환한 앞쪽 N개" 였고, 그 N개가 전부 기존 게임이면 실제 저장 0개
   - 사용자가 이미 4/17 이전 게임을 갖고 있으면, chess.com이 4/1부터 순차 반환 → 모두 중복 → 새 게임 저장 0, 최신 게임까지 도달조차 못 함

### 수정 (의미를 "저장될 최신 N개"로 정정)

**계약 변경:**
- `max`는 **서비스 계층**이 authoritative 하게 적용
- 클라이언트는 criteria에 맞는 게임을 **newest-first 순서로** 전체 emit
- Flow 취소가 상류 WebClient까지 전파되어 API 호출이 조기 중단됨

**코드 변경:**

| 파일 | 변경 |
|------|------|
| `ChessComClient.fetchGames` | 내부 `max` 제한 제거. 바깥 loop만 남김 |
| `ChessComClient.fetchMonthlyGames` | 반환 직전 `.asReversed()` — 계약을 "newest-first 리스트"로 명시 (Kdoc 추가) |
| `LichessClient.fetchGames` | API 쿼리 파라미터 `max` 제거. lichess는 기본이 newest-first 스트림이라 재정렬 불필요 |
| `ImportGameService.importGames` | dedup 필터 뒤에 `criteria.max?.let { take(it) }` 추가. 이후 `save` |

**순서 일관성:**
- lichess: API가 기본 newest-first → 그대로 stream
- chess.com: API가 oldest-first → `fetchMonthlyGames`가 뒤집어 newest-first 보장
- 두 클라이언트 모두 "newest-first emit" 계약 통일 → 서비스의 `take(max)`가 "최신 N개"로 정확히 작동

### 테스트 변경

| 파일 | 변경 |
|------|------|
| `ChessComClientTest` | "max 파라미터로 게임 수를 제한한다" → 둘로 분리: (a) 월 내부 newest-first 순서 검증 (end_time 다른 3개 게임 시나리오), (b) max 지정해도 클라이언트는 전체 emit함을 검증 |
| `ImportGameServiceTest` | 추가: "max는 중복 제거 후 적용된다" (interleave된 existing/new 게임에서 max=2가 새 게임 2개를 반환), "max보다 적은 새 게임", "max가 null이면 전체" |
| `LichessClientTest` | 쿼리 파라미터 검증: `max=10` 대신 `max=` 부재 검증 |

전체 백엔드 테스트 통과 확인.

### 의사결정 기록

| 결정 | 선택 | 이유 |
|------|------|------|
| `max` 책임 위치 | 서비스 계층 (`ImportGameService`) | `max`의 의미가 "저장될 게임 수"라는 비즈니스 개념이므로 도메인 서비스가 owning. 어댑터는 "API로부터 newest-first 스트림 제공"만 책임 — 단일 책임 원칙 |
| newest-first 보장 위치 | 각 클라이언트 내부 | 어댑터의 특수성(chess.com은 월별 + oldest-first / lichess는 newest-first 스트림)을 서비스가 알지 않아도 됨. 포트 계약으로 일관된 순서 약속 |
| `fetchMonthlyGames` reverse 위치 | 함수 반환 직전 `.asReversed()` | 호출부에서 뒤집는 것보다 함수 계약으로 고정. Kdoc에 "newest → oldest 순" 명시 |
| lichess API `max` 제거 | 쿼리 파라미터 삭제, stream cancellation 의존 | 중복 게임으로 carpet 잘리는 현상을 원천 차단. WebClient는 Flow 취소 시 HTTP 조기 종료하므로 낭비 없음 |
| Flow 연산자 | `.take(max)` (이미 kotlinx.coroutines 표준) | 수동 카운팅 없이 취소 전파. `criteria.max?.let { take(it) }` 로 null 분기 처리 |

### 체크리스트

- [x] Domain: 변경 없음 (`GameFetchCriteria.max` 의미만 서비스가 재정의)
- [x] Port: 인터페이스 변경 없음 (계약에 "newest-first" 추가 문서화 가능)
- [x] Application: `ImportGameService`에 `.take(max)` 추가
- [x] Adapter out/client: `ChessComClient` reverse / `LichessClient` max 쿼리 제거
- [x] Test: ChessComClient, LichessClient, ImportGameService 모두 업데이트 + 신규 케이스
