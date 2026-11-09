# 메모 삭제 버튼 (수별 메모 + 게임 메모)

## What
- **수별 메모**(기보·메모 탭의 메모 패널)와 **게임 메모**(경기 정보 탭)에 휴지통 모양 삭제 버튼을 추가했다.
- 수별 메모는 메인라인 수와 저장된 변형선 수 모두 지울 수 있다.
- 누르면 확인 창(`ConfirmDialog`, danger)이 뜨고, "삭제"를 눌러야 지워진 뒤 바로 서버에 저장된다.

## Why
- 지금까지는 글을 모두 지우고 저장해야만 메모가 사라졌다. 이 방법을 알기 어렵다.
- 긴 메모를 실수로 날리지 않도록 확인 창을 거친다 (사용자 선택).

## 설계 결정
| 항목 | 결정 | 이유 |
|---|---|---|
| 백엔드 | 변경 없음 | 수별 메모: 빈 메모를 저장하면 store에서 키를 지우고 PUT annotations. 게임 메모: `GameNote.of`가 빈 값/`null`을 `null`로 저장 |
| 버튼 노출 | 저장된 메모가 있을 때만 | 지울 게 없는 수에 버튼을 보이지 않으려고 |
| 저장 전 변형선 | 해당 없음 | 저장 전 변형선의 수에는 메모가 있을 수 없음 (메모를 저장하면 변형선이 먼저 저장됨) |
| 삭제 대상 | 버튼을 누른 시점의 수 | 확인 창이 떠 있는 동안 방향키로 수가 바뀌어도 엉뚱한 메모를 지우지 않게 |
| 게임 메모 삭제 | `{ nickname: 기존 값, memo: null }` PUT | 애칭은 그대로 유지 |
| 색 | 평소 회색, hover 시 red | 위험 동작은 red (ui.md 시맨틱 색). 평소엔 눈에 덜 띄게 |

## 주요 파일
- `frontend/src/shared/components/TrashIcon.tsx` (신규)
  - 삭제 버튼용 휴지통 SVG. `currentColor`를 따르고 `aria-hidden`이다
  - 두 곳에서 쓰므로 공용 컴포넌트로 분리했다
- `frontend/src/features/game/components/CommentPanel.tsx`
  - 보기 모드에서 메모 버튼 오른쪽에 `메모 삭제` 버튼을 둔다 (`aria-label="메모 삭제"`)
  - `handleDelete`: 확인 → `setMoveComment(i, '')` 또는 `setVariationMoveComment(i, '')` → `onPersist()`
  - 저장 중(`isPersisting`)에는 비활성화한다
- `frontend/src/features/game/components/GameNote.tsx` (`GameMemoSection`)
  - 머리글의 ✎(수정) 옆에 `메모 삭제` 버튼을 둔다
  - `remove`: 확인 → `useUpdateGameNote`로 `memo: null` 저장
  - 저장 중(`update.isPending`)에는 비활성화한다

## 테스트
- `CommentPanel.test.tsx`
  - 메인라인 메모: 확인 후 삭제, `onPersist` 호출, "메모 추가..."로 복귀
  - 취소하면 메모 유지
  - 저장된 변형선의 수 메모 삭제
  - 메모 없는 수에는 버튼 없음
- `GameNote.test.tsx`
  - 확인 후 `{ nickname: 기존, memo: null }` PUT
  - 취소하면 요청 없음
  - 메모 없으면 버튼 없음

## 검증
- 프론트 `pnpm test` 310건 통과, `pnpm build`(tsc) 통과, `pnpm lint` 통과
- 브라우저(Playwright)
  - 브랜치 백엔드를 8091, 프론트를 5174에 따로 띄워 확인
  - 경기 338827999937822720에 검증용 수 메모(`4.Bd3`)와 게임 메모를 넣었다
  - 각각 휴지통 → 확인 창 문구 확인 → "삭제"
  - 서버에서 해당 메모만 지워지고 기존 메모(`12.Ne5`)는 남은 것 확인
  - 게임 메모 자리에 "게임 메모 추가"가 다시 보이는 것 확인
  - 최종 데이터가 검증 전 백업과 동일함을 확인
