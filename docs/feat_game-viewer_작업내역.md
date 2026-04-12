# feat/game-viewer — 게임 뷰어 + Stockfish 평가

## 2026-04-11~12: 체스보드 뷰어 구현

### 무엇을
- react-chessboard + chess.js 기반 체스보드 뷰어
- Zustand boardStore로 수 네비게이션 (FEN 계산, 인덱스 관리)
- 수 목록 패널 (백/흑 쌍 표시, 현재 수 하이라이트)
- 네비게이션 컨트롤 (처음/이전/다음/마지막) + 키보드 단축키 (←→, Home/End)
- `GET /api/games/{id}` 응답에 `moves` 배열 포함 (`GameDetailResponse`)

### 왜
- import한 게임을 실제 체스보드로 볼 수 있어야 분석/리뷰 기능의 기반이 됨
- FEN 계산을 프론트엔드(chess.js)에서 수행하여 백엔드 체스 라이브러리 도입 없이 구현

### 변경 파일
| 파일 | 설명 |
|------|------|
| `game/adapter/in/web/GameResponse.kt` | `GameDetailResponse`, `MoveResponse` DTO 추가 |
| `game/adapter/in/web/GameController.kt` | `getGame`이 `GameDetailResponse` 반환 |
| `features/game/stores/boardStore.ts` | Zustand — chess.js로 FEN 계산, 수 네비게이션 |
| `features/game/components/GameBoard.tsx` | react-chessboard 래퍼 (orientation, 체스보드 색상) |
| `features/game/components/MoveList.tsx` | 수 목록 (번호 + 백/흑 쌍, 현재 수 amber 하이라이트, 자동 스크롤) |
| `features/game/components/BoardControls.tsx` | 네비게이션 버튼 + 키보드 단축키 |
| `features/game/components/GameViewer.tsx` | 위 컴포넌트 조합 (보드 + eval bar + 수 목록 + 컨트롤) |
| `features/game/components/GameDetailPage.tsx` | placeholder → GameViewer 교체 |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| FEN 계산 위치 | 프론트엔드 (chess.js) | 백엔드 체스 라이브러리 불필요, SAN 수를 순서대로 적용하면 FEN 계산 가능 |
| 상세 API 응답 | `GameDetailResponse` (moves 포함) | 목록 API에는 moves 미포함 (성능), 상세만 포함 |
| 보드 방향 | ownerUsername으로 자동 결정 | owner가 흑이면 보드 뒤집기 |
| react-chessboard v5 | `options` prop 방식 | v5에서 API가 변경됨 (props → options 객체) |

## 2026-04-12: Stockfish 18 WASM 평가치

### 무엇을
- `@lichess-org/stockfish-web` (sf_18_smallnet) — 브라우저에서 Stockfish 18 실행
- NNUE 네트워크 파일 (`nn-4ca89e4b3abf.nnue`, 14MB) public/에 배치
- `useStockfish` 훅 — FEN 변경 시 실시간 depth 18 평가
- `EvalBar` 컴포넌트 — lichess/chess.com 스타일 흑백 세로 바

### 왜
- 체스 리뷰 앱의 핵심 기능: 각 포지션의 엔진 평가치를 시각적으로 확인
- 브라우저 WASM으로 백엔드 변경 없이 구현 가능
- lichess가 실제 사용하는 동일 엔진 (`@lichess-org/stockfish-web`)

### Stockfish WASM 아키텍처

```
[useStockfish 훅]
    ↓ evaluate(fen)
[sf_18_smallnet.js + .wasm]  ← NNUE: nn-4ca89e4b3abf.nnue (14MB)
    ↓ UCI: "position fen ... " → "go depth 18"
    ↓ listen: "info depth 18 score cp 35" 파싱
    ↓ side-to-move 보정 (흑 차례면 부호 반전)
[EvalResult { cp, mate, depth }]  → 항상 백 관점으로 정규화
    ↓
[EvalBar] — sigmoid 변환 → 흑/백 비율 → 세로 바
```

**UCI side-to-move 보정**: Stockfish는 항상 현재 차례 관점으로 평가치를 반환한다.
흑 차례에 `+1150cp`이면 "흑이 11.5 유리"이므로, FEN의 차례(`w`/`b`)를 확인하여
흑 차례면 부호를 반전(`* -1`)하여 항상 백 관점으로 정규화한다.

### 변경 파일
| 파일 | 설명 |
|------|------|
| `features/game/hooks/useStockfish.ts` | Stockfish WASM 초기화, NNUE 로드, UCI 통신, 평가 파싱 |
| `features/game/components/EvalBar.tsx` | 흑백 세로 바 (sigmoid 변환, 방향 자동 조정, 유리한 쪽에 숫자 표시) |
| `features/game/components/GameViewer.tsx` | eval 통합 (FEN 변경 → 실시간 평가 → EvalBar 갱신) |
| `vite.config.ts` | COOP/COEP 헤더 + optimizeDeps exclude |
| `frontend/.gitignore` | `*.nnue` 파일 제외 |
| `package.json` | `@lichess-org/stockfish-web` 의존성 추가 |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| Stockfish 실행 위치 | 브라우저 WASM | 백엔드 변경 없이 바로 적용, Stockfish 설치 불필요 |
| 패키지 | `@lichess-org/stockfish-web` | lichess가 사용하는 엔진, 5.4MB로 가벼움. `stockfish` npm(251MB)은 OOM 발생 |
| 엔진 빌드 | sf_18_smallnet | NNUE 1개만 필요 (14MB), 성능과 크기의 균형 |
| 평가 depth | 18 | 브라우저에서 합리적인 분석 깊이. 데스크톱 Stockfish는 보통 20+ |
| EvalBar 변환 | sigmoid (`2/(1+e^(-0.004*cp))-1`) | lichess 스타일, ±400cp에서 거의 끝단 |

### NNUE 다운로드 안내
```bash
# public/ 디렉토리에서 실행
curl -sL -o nn-4ca89e4b3abf.nnue "https://tests.stockfishchess.org/api/nn/nn-4ca89e4b3abf.nnue"
```

### TODO
- [ ] 인터랙티브 분석 (기물 이동 + 원래 기보로 복귀)
- [ ] Blunder/Mistake/Inaccuracy 분류
- [ ] 전체 게임 평가 그래프
