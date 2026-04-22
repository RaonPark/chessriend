# bugfix/import-game-count 작업내역

## 게임 임포트 시 중복 게임만 있을 때 잘못된 에러 메시지 표시 버그 수정

### 문제
- 100경기를 먼저 가져온 후, 같은 사용자명으로 10/50경기를 가져오려 하면 "사용자명을 확인해주세요" 에러 발생
- 200경기는 정상 동작 (100개 이후의 새 게임이 포함되므로)

### 원인
- ChessComClient가 `max` 개수만큼 최신 게임을 API에서 가져옴
- ImportGameService에서 DB 중복 체크로 이미 존재하는 게임을 필터링
- 모든 게임이 중복이면 SSE 스트림에 0개 emit → 정상 종료
- 프론트엔드는 `receivedCount === 0`이면 무조건 사용자명 에러로 판단 (잘못된 판단)

### 해결
- **백엔드 (GameController)**: `ServerSentEvent`로 래핑하여 스트림 정상 완료 시 `complete` 이벤트 전송
  - 예외 발생 시(사용자명 오류 등)에는 `complete` 이벤트가 전송되지 않음
- **프론트엔드 (useGameImport)**: `complete` 이벤트 리스너 추가
  - `complete` + 0개 수신 → "새로 가져올 게임이 없습니다. 이미 모두 가져온 상태입니다."
  - `complete` 없이 에러 + 0개 수신 → "사용자명을 확인해주세요." (진짜 에러)

### 변경 파일
- `src/main/kotlin/.../game/adapter/in/web/GameController.kt` — `Flow<ServerSentEvent<GameResponse>>` 반환, `onCompletion` 추가
- `frontend/src/features/game/hooks/useGameImport.ts` — `complete` 이벤트 리스너 추가, 에러 메시지 분기
