# 수마다 쓴 시간·남은 시계 표시

## What
- **대국자 바**: 현재 포지션에서 각 플레이어의 남은 시계를 보여준다. 둘 차례인 쪽은 amber로 강조한다.
- **수 목록**: 각 수 오른쪽에 그 수에 쓴 시간을 작게 표시한다 (`0.8s`, `12s`, `1:05`).

## Why
- 수마다의 시간 사용을 보면 "어디서 시간을 썼고, 어디서 급하게 뒀는지"를 함께 돌아볼 수 있다.
- 기존 상태
  - chess.com 가져오기는 PGN의 `{[%clk ...]}`를 건너뛰었다.
  - lichess는 쓴 시간만 초 단위로 저장했고, API·화면에는 내보내지 않았다.

## 설계 결정
| 항목 | 결정 | 이유 |
|---|---|---|
| 데이터 출처 | **저장된 원본 PGN의 `%clk`를 조회 시점에 읽음** | 이미 가져온 게임도 재가져오기·마이그레이션 없이 바로 표시. chess.com·lichess·`%clk` 있는 PGN 입력이 같은 코드로 처리됨. 로컬 DB의 chess.com 게임 60개 모두 `%clk` 포함 확인 |
| 쓴 시간 계산 | `직전 내 시계(첫 수는 초기 시간) − 남은 시계 + 증가 시간`, 음수는 0 | `%clk`는 증가 시간이 더해진 뒤의 값이므로 증가 시간을 다시 더해야 실제 쓴 시간 |
| 시계 개수 ≠ 수 개수 | **모두 표시 안 함** | 어느 수의 시계인지 확신할 수 없으면 틀린 값을 보이지 않는다 |
| 변형선(괄호) 안 `%clk` | 무시 | 본선 수에만 대응 |
| 아직 두지 않은 쪽 | 초기 시계(`initialClockMs`) 표시 | 시작 포지션에서도 양쪽 시계가 보이게 |
| 변형선 진입 중 | 분기 지점의 시계 표시, 차례 강조 끔 | 변형선은 실제 대국 흐름이 아님 |
| 표시 형식 | 남은 시계 `2:41` / `1:02:03` / 10초 미만 `0:08.3`. 쓴 시간 `3.2s` / `12s` / `1:05` | lichess·chess.com 관례. 소수점은 반올림 없이 버림 |

## 백엔드
- `domain/MoveClock.kt` (신규)
  - `MoveClock(remaining, spent?)`
  - `PgnClocks.parseMainline(pgn)`: 헤더 태그를 제거하고 본선 수마다 뒤 코멘트의 `%clk`를 읽는다.
    - 변형선 괄호, `;` 줄 코멘트, NAG(`$1`), 결과 토큰은 건너뛴다.
    - `1.e4`처럼 수 번호가 붙은 토큰도 수로 센다.
    - 소수점 시계(chess.com `0:04:59.9`)와 정수 시계(lichess `0:09:58`) 모두 읽는다.
- `domain/Game.kt`: `moveClocks(): List<MoveClock?>`
- `adapter/in/web/GameResponse.kt`
  - `MoveResponse`에 `clockMs`, `timeSpentMs` 추가 (ms, 없으면 null)
  - `GameDetailResponse`에 `initialClockMs` 추가 (시계가 있는 게임만)
- 기존 lichess `Move.timeSpent`(초 단위 저장값)는 쓰지 않는다. lichess PGN에도 `%clk`가 들어 있어 같은 경로로 처리된다.

## 프론트엔드
- `utils/clock.ts` (신규)
  - `formatClock`, `formatSpent`: 표시 형식
  - `clockAt(moves, currentIndex, color, initialClockMs)`: 그 색이 현재 수까지 마지막으로 둔 수의 시계. 아직 두지 않았으면 초기 시계, 없으면 null
  - `sideToMove(currentIndex)`: 둘 차례인 색
- `types/game.ts`: `MoveResponse.clockMs/timeSpentMs`, `GameDetailResponse.initialClockMs`
- `components/PlayerBar.tsx`
  - `clockMs`, `isToMove` props 추가
  - 오른쪽 끝에 고정폭 숫자 시계를 둔다 (`data-testid="player-clock-{color}"`, `aria-label="남은 시간 2:41 (둘 차례)"`)
- `components/GameViewer.tsx`: 현재 수 기준으로 `clockAt`/`sideToMove`를 계산해 대국자 바에 전달한다
- `components/MoveList.tsx`: `MoveCell` 오른쪽 끝에 쓴 시간을 표시한다 (`ml-auto`, 회색, `tabular-nums`)

## 테스트
- 백엔드
  - `MoveClockTest` 11건: 형식 2종, 변형선 무시, 시계 없는 수, 수 번호 붙은 토큰, 1시간 이상, 쓴 시간 계산·음수 절단·초기 시간 없음·개수 불일치·시계 없음
  - `AnnotationDtoTest`: 상세 응답의 `clockMs`/`timeSpentMs`
- 프론트
  - `clock.test.ts` 19건
  - `PlayerBar.test.tsx`: 시계 표시·차례 강조·없을 때 숨김
  - `MoveList.test.tsx`: 쓴 시간 표시

## 검증
- 백엔드 `./gradlew test` 통과
- 프론트 `pnpm test` 332건, `pnpm build`(tsc), `pnpm lint` 통과
- 브랜치 서버(8091/5174)로 확인
  - 로컬 게임 61개 중 chess.com 60개 모두 수별 시계가 나옴 (나머지 1개는 시계 없는 PGN 입력)
  - 화면: `6.Bf4` 이후 흑 시계 `4:51` 강조, 백 `4:55`, 수 목록에 쓴 시간 표시 확인

## 후속
- lichess 게임은 로컬 DB에 없어 실제 데이터로는 확인하지 못했다 (테스트 데이터 형식으로만 확인).
- 시간 사용 그래프는 하지 않았다 (선택하지 않은 안).
- lichess 클라이언트가 계산하는 `Move.timeSpent`는 이제 쓰이지 않는다. 정리 여부는 별도로 판단한다.

## 문서
- `README.md` 게임 화면 소개: 대국자 바의 남은 시계, 기보의 수별 쓴 시간 설명 추가.
