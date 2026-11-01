# update/move-list-accent-rail-removal 작업 내역

## 2026-11-01: 복기 수 목록의 좌측 컬러 바(accent rail) 제거

### 무엇을
- `MoveList.tsx`의 `CLASSIFICATION_BORDER` 맵과, 활성 수에 `border-l-2`를 붙이던 `classificationBorder` 로직을 제거.
- 활성 수는 amber 배경만 남고, 분류는 기호(`!!`/`??` 등)와 비활성 수의 배경색으로 표시된다.

### 왜
- 사용자 요청: 수 분류 기호 시안을 정리하면서 "복기 수에 붙는 accent rails"를 없애기로 결정.
- 기호와 배경색만으로 분류가 전달되고, 활성 수에서만 좌측 바가 생기는 건 일관성이 떨어진다.

### 변경 파일
| 파일 | 변경 |
|------|------|
| `frontend/src/features/game/components/MoveList.tsx` | `CLASSIFICATION_BORDER` 및 `classificationBorder` 제거 |

### 검증
- `tsc -b --noEmit`, `eslint MoveList.tsx` 통과, 컴포넌트 테스트 12파일 104개 통과.
- 해당 클래스를 참조하는 테스트는 없었음.

### 참고
- `DESIGN_SYSTEM.md`의 "승패 표시 `border-l-4`" 안내는 게임 목록용이며 목록 쪽 띠는 이미 제거된 상태(`feature_game-folders-filters_작업내역.md`). 이번 작업 범위 밖이라 그대로 둠.
