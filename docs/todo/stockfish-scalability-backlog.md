# 백엔드 Stockfish 분석 — 확장성 후속 백로그

현재 구현(A안): **Kotlin in-process Stockfish 프로세스 풀** + 분류 Kotlin 도메인 포팅 + **SSE 진행률 스트리밍**.
재분석 재사용은 기존 `game_analyses` UPSERT 가 담당하고, 비동기는 게임 import 와 동일한 SSE 단발로 처리한다.

아래는 **다중 사용자/상용화 단계에서** 도입을 검토할 항목이다. 지금은 개인 앱("내 게임") 규모라 의도적으로 제외했다.
출처/참고: `docs/request/stockfish_backend_architecture.md` (상용 SaaS 청사진).

`ChessEngine` 포트(`port/out/ChessEngine`)를 두었으므로, 아래 대부분은 **도메인 변경 없이 어댑터/인프라 교체**로 수용 가능하다.

## 1. 포지션 병렬 평가 (가장 가성비 좋은 성능 레버)
- 현재: 한 게임 내 포지션을 **순차** 평가(pool-size=2지만 한 분석은 1개씩 빌려 순차 사용).
- 개선: 한 게임의 포지션들을 풀의 여러 프로세스에 **동시 분배**하면 wall-clock 이 ~워커 수 배 단축(예: depth 18, 80수, 4워커 → 약 1/4).
- 포지션 평가는 서로 독립이라 안전. `RunGameAnalysisService` 의 평가 루프를 `coroutineScope { async { } }` 로 팬아웃하고 진행률 카운터를 원자적으로 갱신하면 된다.
- 주의: CPU 코어 수 대비 과도한 동시 탐색은 오히려 느려짐 → pool-size 를 코어 수에 맞춰 조정.

## 2. 비동기 큐 + 잡 영속화
- 현재: SSE 단발(클라이언트 연결 유지 동안 분석). 연결이 끊기면 분석도 취소.
- 다중 사용자/대량 분석 시: `analysis_jobs` 테이블 또는 Redis 큐 + 워커 풀로 백그라운드 처리, 진행 상태 폴링/푸시.
- 트레이드오프: 잡 상태 머신·재시도·워커 스케일 코드 필요. 현재 규모엔 과함.

## 3. Redis 캐시
- 멀티유저 시 동일 오프닝/포지션 평가 캐시: 키 `analysis:{sfVersion}:{depth}:{fenHash}`.
- 현재: 동일 사용자가 같은 게임을 재분석하는 경우는 드물고, `game_analyses`(게임당 UPSERT)가 사실상 결과 캐시. 단일 사용자는 포지션 교차 적중률이 낮아 Redis 이득이 작음.

## 4. 엔진 사이드카 분리 (평가 일관성 / CPU 격리)
- 동기: 네이티브 Stockfish 빌드와 **브라우저 WASM(`sf_18_smallnet.js`)** 평가가 미세하게 다를 수 있음(같은 FEN·depth라도).
- 옵션 A: **Node + 동일 `sf_18_smallnet.js` WASM** 사이드카(엔드포인트는 "FEN→eval" 하나) → 브라우저와 평가 완전 일치 + CPU 격리.
- 옵션 B: Python FastAPI + python-chess(참고 문서 12~14장). 단, 또 다른 평가 빌드라 일관성 이점은 없음.
- 어느 쪽이든 `ChessEngine` 포트 구현만 교체. 도메인/분류 로직 불변.

## 5. 운영/상용 기능
- 사용량 제한·티어(비로그인/무료/유료), depth/동시 분석 수 제한.
- MultiPV(후보 수 여러 개) — 학습용 추천수.
- 단일 포지션 분석 API(현재는 실시간/변형선이 브라우저 담당이라 불필요).
- 모니터링 지표: 분석 p95, 엔진 재시작 횟수, 큐 대기 시간, 캐시 hit rate.

## 6. GPL 라이선스 검토 (출시 전 필수)
- Stockfish 는 GPL 계열. **서버에서 실행해 결과만 API 제공**하는 구조와 **앱에 WASM/바이너리 동봉** 구조는 의무가 다르게 평가될 수 있음(현재 프론트는 WASM 동봉).
- 출시 전 라이선스 고지·소스 공개 의무 검토. 공식 fishnet 무단 사용 금지(직접 엔진 운영).

## 7. Docker 배포
- 현재 레포에 운영 Dockerfile 없음. 운영 이미지에 stockfish 설치 필요:
  - `apt-get install -y stockfish` 후 `CHESS_ENGINE_PATH=/usr/games/stockfish`(배포판마다 경로 상이) 설정.
  - **아키텍처 주의**: Linux x86-64 vs Mac arm64 — 단일 바이너리 동봉 금지, 이미지에서 설치.
- 환경변수: `CHESS_ENGINE_PATH`, `CHESS_ENGINE_DEPTH`, `CHESS_ENGINE_THREADS`, `CHESS_ENGINE_HASH_MB`, `CHESS_ENGINE_POOL_SIZE`, `CHESS_ENGINE_TIMEOUT_MS` (application.yml `chess.engine.*` 참고).
