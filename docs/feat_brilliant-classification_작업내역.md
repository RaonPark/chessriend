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
2. 공격 기물 점수 > 포획된 기물 점수 (nominal 불리한 교환)
3. **희생 조건**: 이동 후 공격 기물이 놓인 square를 공격하는 상대 기물 중 **가장 싼 기물의 가치 < 공격 기물의 가치** (즉 상대가 이득 보는 재포획이 가능해야 진짜 희생)
   - 킹이 공격자이면 가치 0으로 취급 — 킹으로 잡으면 상대는 손실 없이 우리 기물만 가져감
4. cpLoss < 20cp ("손실 없음" 또는 "거의 비슷")
5. Blunder/Mistake/Inaccuracy로 분류되지 않은 수만 Brilliant로 **승격** 가능 (실수와 공존 불가)

**기물 점수:** 폰 1, 나이트 3, 비숍 3, 룩 5, 퀸 9 (킹 제외)

**cpLoss 허용치 20cp 근거:** depth 16 Stockfish 분석에서 관측되는 자연스러운 노이즈(±10~15cp)를 약간 상회하는 보수적 경계. 진짜 좋은 희생만 Brilliant로 승격됨.

**희생 판정 근거 (SEE-lite):** 단순히 "비싼 기물로 싼 기물 잡음" 만으로는 부족함. 예: Italian Game에서 Bxf7+(비숍 희생)과 Nxe5+(안전한 나이트 포획) 둘 다 attacker > captured 지만, 전자는 킹에게만 공격받아 lose (희생 ✓), 후자는 동가치 Nc6에게만 공격받아 even trade (희생 ✗). chess.js `attackers(square, opponentColor)` 로 목적지 square 공격자 목록을 얻어 **가장 싼 공격자 value < attacker value** 를 검사. 킹은 "잃을 것 없는 공격자"이므로 value 0.

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
- `detectBrilliant({cpLoss, attacker, captured, isSacrifice})` — 기물 컨텍스트 + 희생 여부로 판정
- `extractCapture(fenBefore, san)` — chess.js로 포획 정보 + 목적지 square 공격자 분석 → `isSacrifice` 계산
- `cheapestAttackerValue(chess, squares)` — 공격자 목록 중 최저 가치 반환 (킹은 0)
- `computeClassifications(fens, evals, moves)` — 조합

### 변경 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `features/game/types/game.ts` | 수정 | `MoveClassification` 유니온에 `'brilliant'` 추가 |
| `features/game/utils/classification.ts` | 수정 | `PIECE_VALUES` 상수(`satisfies` 패턴), `detectBrilliant()` 순수 함수 (희생 판정 포함), `extractCapture()` 헬퍼 — chess.js `attackers()` API로 목적지 square 공격자 분석, `cheapestAttackerValue()` 헬퍼, `computeClassifications()` 시그니처에 `fens: string[]` 첫 파라미터 추가 |
| `features/game/utils/__tests__/classification.test.ts` | 수정 | `detectBrilliant` describe (`isSacrifice` 포함 6 케이스), `computeClassifications`에 실전 Italian Bxf7+(brilliant) vs Nxe5(not brilliant) 시나리오 등 신규 케이스 |
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
| 희생 판정 방식 | SEE-lite: 목적지 square의 가장 싼 상대 공격자 value < 공격 기물 value | 완전한 SEE는 과도함. 이 단순 규칙만으로 Italian Bxf7+(킹=0 < 비숍=3 → 희생) / Nxe5+(Nc6=3 == 나이트=3 → 비-희생) 케이스를 정확히 구분. 수비수 존재 여부는 cpLoss가 이미 반영 |
| 킹의 교환 가치 | `KING_AS_ATTACKER_VALUE = 0` | 킹은 잡혀도 잃지 않으므로 "lose-less attacker". 상수로 추출해 의도 명시 |
| `AnalysisSummary` 리팩터링 | `SideCounts` 분리 + `BADGE_CONFIG` 맵 | 분류 4종(이후 `good`/`great` 확장 가능) 반복 코드 제거. React 19 + 컴파일러가 자동 메모 처리하므로 `useMemo` 불필요 |

### UI 사용 예시 (프론트엔드 설명)

**MoveList에서:**
- 이전: `[e4] [e5] [Qxd4]` — Qxd4가 blunder면 빨간색 배경
- 이후: 추가로 Nxe5 같은 희생 수가 Brilliant로 판정되면 `[Nxe5!!]` — cyan 배경 + 굵은 `!!` 뱃지가 붙음

**AnalysisSummary에서:**
- 전체 요약 뱃지: `●Brilliant N  ●Blunder N  ●Mistake N  ●Inaccuracy N`
- 백/흑 분리: `백  N!!  NB  NM  NI   흑  N!!  NB  NM  NI`

### 테스트 커버리지 (21개 모두 통과)

- `evalToCp` (4) — mate/cp 변환
- `classifyMove` (4) — 경계값 (50/100/200) 및 `null`
- `detectBrilliant` (6) — 희생 성공/실패, `isSacrifice=false`, 등가교환, 역희생, tolerance 경계
- `computeClassifications` (8) — 기존 blunder/mistake, 빈 입력, 메이트 전환, 음수 클램프 + **새 실전 케이스**: Italian Bxf7+ Brilliant / Nxe5 (동가치 공격자) non-brilliant / 동가교환(exd5) non-brilliant / blunder 우선순위

### 브라우저 검증 (실 게임 269194157396852736, Italian)

Playwright MCP로 실제 게임 분석 실행 후 확인:
- **5. Bxf7+** → `bg-cyan-100` + `!!` 뱃지 (brilliant) ✓
- **6. Nxe5+** → 분류 없음 (일반 수) ✓ — 수정 전에는 brilliant로 오분류되던 수
- 4. Na5(blunder/red), 3...h6(inaccuracy/yellow), 6...Ke6(inaccuracy/yellow), 8...Kc6(mistake/orange) 등 기존 분류 정상 유지
- AnalysisSummary: `1 Brilliant · 1 Blunder · 1 Mistake · 2 Inaccuracy` 카운트 일치
