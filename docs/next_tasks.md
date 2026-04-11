# Chessriend — 다음 작업 목록

> Game 도메인 (Domain → Port → Application → Adapter → Test) 완료 기준으로 정리
> 마지막 업데이트: 2026-04-11

---

## 1. Game 도메인 미완료 TODO

### 1-1. Move FEN 계산
- **현재**: `LichessClient`에서 Move.fen을 빈 문자열(`""`)로 설정
- **해야할 것**: 체스 라이브러리 도입 후 SAN → FEN 실제 계산
- **후보 라이브러리**: [chariot](https://github.com/tors42/chariot) (Java), 또는 직접 구현
- **관련 파일**: `LichessClient.kt:129` (`// TODO: 백엔드 체스 라이브러리 도입 후 실제 FEN 계산으로 교체`)

### ~~1-2. lichess API 에러 처리~~ ✅ 완료 (2026-04-11)
- ~~**현재**: 에러 응답(429 rate limit, 404 user not found) 미처리~~
- `LichessClient`에 `onStatus` 에러 핸들링 추가 + `GlobalExceptionHandler` 구현 완료

### 1-3. SSE → 프론트엔드 EventSource 연동
- **현재**: 백엔드 SSE 엔드포인트만 구현, 프론트 미구현
- **해야할 것**: React에서 `EventSource` or `fetch` + `ReadableStream` 연동

---

## 2. 신규 도메인 개발 (Hexagonal 구조 동일)

### 2-1. chess.com 게임 가져오기
- `ChessComClient` Adapter 구현 (chess.com Public API)
- `GameSource.CHESS_COM` 지원
- chess.com API 구조 분석 필요 (PGN 기반, lichess와 다름)

### 2-2. Analysis 도메인
- Stockfish UCI 프로토콜 연동
- 포지션별 evaluation (centipawn)
- Blunder/Mistake/Inaccuracy 분류
- 체크리스트: Domain → Port → Application → Adapter → Test

### 2-3. Review 도메인
- 수 단위 메모/코멘트 CRUD
- 게임 단위 리뷰 노트
- 체크리스트: Domain → Port → Application → Adapter → Test

---

## 3. 프론트엔드

### 3-1. 게임 Import UI
- SSE EventSource 연동
- import 진행 상태 실시간 표시
- 게임 목록 렌더링

### 3-2. 게임 뷰어
- react-chessboard + chess.js 기반 체스보드
- 수 이동 (앞/뒤 네비게이션)
- 오프닝 정보 표시

### 3-3. 분석/리뷰 UI
- Stockfish 평가 그래프
- Blunder/Mistake 하이라이트
- 수 단위 메모 입력/수정

---

## 4. 인프라/공통

### ~~4-1. GlobalExceptionHandler~~ ✅ 완료 (2026-04-11)
- ~~`shared/exception/` 커스텀 예외 클래스 정의~~
- ~~`@RestControllerAdvice` + `@ExceptionHandler` 중앙 처리~~
- 일반화된 예외 클래스 + GlobalExceptionHandler + 테스트 완료

### 4-2. OpenAPI 문서
- SpringDoc 설정 확인 + API 문서 자동 생성 검증
- 엔드포인트별 설명 추가

### 4-3. 페이지네이션/정렬
- 게임 목록 조회 API (played_at DESC, 필터링)
- `GameRepository`에 조회 메서드 추가

---

## 권장 작업 순서

1. ~~**GlobalExceptionHandler**~~ ✅ 완료
2. ~~**lichess API 에러 처리**~~ ✅ 완료
3. **게임 목록 조회 API** — import한 게임을 볼 수 있어야 다음 단계 진행 가능
4. **프론트엔드 게임 Import + 목록** — 백엔드 API와 연동
5. **chess.com 지원** 또는 **Analysis 도메인** (우선순위에 따라)
