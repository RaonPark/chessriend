# Chessriend — 다음 작업 목록

> 마지막 업데이트: 2026-04-15

---

## 완료된 작업

| # | 작업 | 완료일 |
|---|------|--------|
| 1 | GlobalExceptionHandler | 2026-04-11 |
| 2 | lichess API 에러 처리 | 2026-04-11 |
| 3 | 게임 목록 조회 API (페이지네이션+필터) | 2026-04-11 |
| 4 | 프론트엔드 게임 Import + 목록 + 삭제 | 2026-04-11 |
| 5 | chess.com 게임 가져오기 | 2026-04-11 |
| 6 | ownerUsername + 내 관점 승패 표시 | 2026-04-11 |
| 7 | 체스 테마 UI + 커스텀 컴포넌트 (ConfirmDialog, Dropdown, ChessKing SVG) | 2026-04-11 |
| 8 | 게임 뷰어 (react-chessboard + chess.js + 수 네비게이션) | 2026-04-12 |
| 9 | Stockfish 18 WASM 실시간 평가 + EvalBar | 2026-04-12 |
| 10 | 인터랙티브 분석 (기물 이동 + 변형선 분기/복귀) | 2026-04-12 |
| 11 | Annotation 백엔드 (GameAnnotation 도메인 + DB + CRUD API) | 2026-04-15 |

---

## 다음 작업

### 1. 프론트엔드: 메모 입력 UI + 변형선 저장
- **상태**: 백엔드 API 준비 완료 (`PUT /api/games/{id}/annotations`)
- **해야할 것**:
  - 수 클릭 시 메모 입력 패널 표시
  - 변형선 저장 버튼 (현재 분석 변형선 → 서버 저장)
  - 저장된 변형선/메모 불러와서 MoveList에 표시
  - React Query mutation으로 저장, 캐시 무효화
- **관련 파일**: GameViewer, MoveList, boardStore, gameApi

### 2. Blunder/Mistake/Inaccuracy 분류
- **해야할 것**:
  - 전체 게임을 Stockfish로 분석하여 각 수의 평가치 차이 계산
  - centipawn loss 기준으로 분류:
    - Inaccuracy: 50~100cp loss
    - Mistake: 100~200cp loss
    - Blunder: 200cp+ loss
  - MoveList에서 해당 수를 색상으로 하이라이트 (노랑/주황/빨강)
  - 게임 요약 (Blunder x개, Mistake x개, Inaccuracy x개)

### 3. 전체 게임 평가 그래프
- **해야할 것**:
  - 전 수에 대한 Stockfish 평가치 그래프 (lichess 스타일)
  - X축: 수 번호, Y축: centipawn (백 관점)
  - 그래프 클릭 시 해당 수로 이동
  - Blunder/Mistake 지점 마커 표시
- **후보 라이브러리**: recharts 또는 직접 SVG

### 4. Review 도메인 확장
- **해야할 것**:
  - 게임 단위 리뷰 노트 (전체 게임에 대한 소감)
  - 태그/라벨 기능 (예: "오프닝 실수", "엔드게임 연습", "좋은 게임")
  - 리뷰 완료/미완료 상태 관리

### 5. 프론트엔드 추가 기능
- **해야할 것**:
  - 홈페이지 (대시보드: 최근 게임, 통계 요약)
  - 게임 검색 (상대방 이름, 오프닝, 날짜 범위)
  - 반응형 모바일 UI 최적화
  - Vitest + Testing Library 테스트 환경 구축

### 6. 인프라/공통
- **해야할 것**:
  - OpenAPI 문서 (SpringDoc 설정 + 엔드포인트 설명)
  - Move FEN 백엔드 계산 (현재 프론트에서 chess.js로 처리 중, 필요 시 백엔드 전환)
  - 사용자 인증 시스템 (추후 계정 연결 시 필요)

---

## 권장 작업 순서

1. **메모 입력 UI + 변형선 저장** — 백엔드 준비 완료, 프론트만 구현하면 핵심 리뷰 기능 완성
2. **Blunder/Mistake 분류** — Stockfish 평가 인프라 이미 있음, 분류 로직만 추가
3. **전체 게임 평가 그래프** — 위 2번의 데이터를 시각화
4. **Review 확장 (노트, 태그)** — 리뷰 경험 강화
5. **홈/검색/모바일** — 사용성 개선
6. **인프라 (OpenAPI, 인증)** — 배포 준비
