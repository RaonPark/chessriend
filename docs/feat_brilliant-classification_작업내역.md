# feat/brilliant-classification 작업 내역

## 2026-04-22: Brilliant(!!) 수 분류 추가

### 무엇을
- 기존 `MoveClassification` 유니온(`'blunder' | 'mistake' | 'inaccuracy'`)에 `'brilliant'` 추가
- "더 비싼 기물로 더 싼 기물을 잡았는데 cp 손실이 거의 없는 희생 수"를 Brilliant(!!) 로 분류
- MoveList에서 Brilliant 수는 cyan 색상으로 하이라이트 + `!!` 뱃지 표시
- AnalysisSummary에 Brilliant 카운트 뱃지 추가 (전체/백/흑)

### 왜
- 기존 분류는 실수 계열(부정확/실수/대실수)만 다루어 **잘한 수**를 시각적으로 보여주지 못함
- "내 게임이니까 더 애정을 가질 수 있게"라는 프로젝트 철학에 따라, 자기 게임의 빛나는 순간(brilliant sacrifice)을 강조할 필요
- lichess/chess.com의 `!!` 분류와 동일한 사용자 경험 제공

### 분류 규칙

**Brilliant 조건:**
1. 해당 수가 **포획(capture)** 이어야 함
2. 공격 기물 점수 > 포획된 기물 점수 (희생, attacker > captured)
3. cpLoss < 20cp ("손실 없음" 또는 "거의 비슷")
4. Blunder/Mistake/Inaccuracy로 분류되지 않은 수만 Brilliant로 **승격** 가능 (실수와 공존 불가)

**기물 점수:** 폰 1, 나이트 3, 비숍 3, 룩 5, 퀸 9 (킹 제외)

**cpLoss 허용치 20cp 근거:** depth 16 Stockfish 분석에서 관측되는 자연스러운 노이즈(±10~15cp)를 약간 상회하는 보수적 경계. 진짜 좋은 희생만 Brilliant로 승격됨.

### 아키텍처

```
[useBatchAnalysis]
    ↓ mainlineFens + positionEvals + moves
[classification.ts] — computeClassifications(fens, evals, moves)
    ↓ 1) cpLoss 계산 → classifyMove() (Blunder/Mistake/Inaccuracy 또는 null)
    ↓ 2) null인 경우만: Chess(fens[i]).move(san) → {piece, captured} 추출
    ↓ 3) detectBrilliant({cpLoss, attacker, captured}) → true면 'brilliant'
[GameAnalysis] → boardStore.setAnalysis()
    ↓ classificationByMove 맵 (O(1) lookup)
[MoveList] → cyan 배경 + "!!" 뱃지
[AnalysisSummary] → brilliant 카운트 뱃지
```

**순수 함수 구성:**
- `classifyMove(cpLoss)` — cp 손실만으로 실수 분류 (단일 책임)
- `detectBrilliant({cpLoss, attacker, captured})` — 기물 컨텍스트로 희생 판정
- `computeClassifications(fens, evals, moves)` — 조합 + chess.js로 포획 정보 추출

### 변경 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `features/game/types/game.ts` | 수정 | `MoveClassification` 유니온에 `'brilliant'` 추가 |
| `features/game/utils/classification.ts` | 수정 | `PIECE_VALUES` 상수(`satisfies` 패턴), `detectBrilliant()` 순수 함수, `extractCapture()` 내부 헬퍼, `computeClassifications()` 시그니처에 `fens: string[]` 첫 파라미터 추가 |
| `features/game/utils/__tests__/classification.test.ts` | 수정 | `detectBrilliant` describe 블록 추가, `computeClassifications` 테스트를 새 시그니처로 마이그레이션 + Brilliant/equal-trade/blunder 우선순위 케이스 추가 |
| `features/game/hooks/useBatchAnalysis.ts` | 수정 | `computeClassifications(fens, positionEvals, moves)` — fens 인자 전달 |
| `features/game/components/MoveList.tsx` | 수정 | `CLASSIFICATION_BORDER/BG` 맵에 `brilliant: cyan-*` 추가, `MoveCell`에 `!!` 인라인 뱃지 |
| `features/game/components/AnalysisSummary.tsx` | 리팩터 | `Counts` 타입, `emptyCounts()`, `BADGE_CONFIG` 객체(`satisfies` 패턴), `SideCounts` 서브컴포넌트로 분리하여 확장성 확보. Brilliant 뱃지 추가 |

백엔드는 `MoveEvaluationData.classification: String?` 필드가 JSONB로 자유롭게 직렬화되므로 **스키마/코드 변경 불필요**.

### 의사결정 기록

| 결정 | 선택 | 이유 |
|------|------|------|
| cpLoss 허용치 | **20cp** | depth 16 엔진 노이즈를 넘지 않는 엄격한 경계. 20~49cp 구간 수는 Brilliant 아님 (inaccuracy 미만이지만 희생으로 볼 만큼 확실하지 않음) |
| 색상 | **cyan-500 / cyan-100** | CLAUDE.md의 기존 의미론 체계(red/orange/yellow 실수 / amber primary / indigo 변형선 / emerald 저장)와 충돌 없음. 실수 계열 대비 "빛나는" 느낌 |
| Brilliant 승격 조건 | 실수로 분류되지 않은 수(`null`)만 승격 | 실수/대실수가 Brilliant로 덮어쓰이는 모순 방지. 희생이 실제로 먹히지 않고 역공당하면 cpLoss가 커져 자동으로 실수로 분류됨 |
| 포획 판정 방식 | `chess.js`의 `move.piece` / `move.captured` | 라이브러리 기본 기능 활용, SAN 파싱·기물 식별 재구현 회피 (CLAUDE.md: "라이브러리/프레임워크 기능 적극 활용") |
| `PIECE_VALUES` 정의 | `as const satisfies Record<string, number>` | TS 6.x 권장 패턴 — 타입 추론 유지하면서 타입 호환성 검증 (`as` 타입 단언 회피) |
| `extractCapture` 반환 | `null` for 비-포획 | Brilliant 판정을 짧게 끝내고 호출부 분기 명확화 (early return) |
| `AnalysisSummary` 리팩터링 | `SideCounts` 분리 + `BADGE_CONFIG` 맵 | 분류 4종(이후 `good`/`great` 확장 가능) 반복 코드 제거. React 19 + 컴파일러가 자동 메모 처리하므로 `useMemo` 불필요 |

### UI 사용 예시 (프론트엔드 설명)

**MoveList에서:**
- 이전: `[e4] [e5] [Qxd4]` — Qxd4가 blunder면 빨간색 배경
- 이후: 추가로 Nxe5 같은 희생 수가 Brilliant로 판정되면 `[Nxe5!!]` — cyan 배경 + 굵은 `!!` 뱃지가 붙음

**AnalysisSummary에서:**
- 전체 요약 뱃지: `●Brilliant N  ●Blunder N  ●Mistake N  ●Inaccuracy N`
- 백/흑 분리: `백  N!!  NB  NM  NI   흑  N!!  NB  NM  NI`

### 테스트 커버리지 (20개 모두 통과)

- `evalToCp` (4) — mate/cp 변환
- `classifyMove` (4) — 경계값 (50/100/200) 및 `null`
- `detectBrilliant` (5) — 희생 성공/실패, 등가교환, 역희생, tolerance 경계
- `computeClassifications` (7) — 기존 blunder/mistake, 빈 입력, 메이트 전환, 음수 클램프 + **새 케이스**: 퀸 희생 Brilliant / 동가교환(폰xd폰) non-brilliant / blunder 우선순위
