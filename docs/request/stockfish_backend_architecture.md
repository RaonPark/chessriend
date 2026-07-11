# 백엔드에서 Stockfish 돌리기 설계 정리

## 1. 핵심 개념

백엔드에서 Stockfish를 돌린다는 것은 다음 구조를 의미한다.

```text
백엔드 서버
→ Stockfish 바이너리 실행
→ UCI 프로토콜로 stdin/stdout 통신
→ 분석 결과 파싱
→ API 응답 또는 DB 저장
```

Stockfish는 일반적인 HTTP 서버가 아니라 **UCI 엔진**이다.  
따라서 백엔드는 Stockfish 프로세스를 실행한 뒤, 표준 입력으로 명령을 보내고 표준 출력으로 결과를 읽어야 한다.

UCI는 Universal Chess Interface의 약자로, 체스 GUI나 분석 도구가 체스 엔진과 통신하기 위한 텍스트 기반 프로토콜이다.

---

## 2. 추천 전체 구조

앱에서 직접 Stockfish를 돌리지 말고, 서버에서 분석을 담당하는 구조가 좋다.

```text
모바일/웹 앱
  ↓
내 백엔드 API
  ↓
분석 요청 큐
  ↓
Stockfish Worker Pool
  ↓
분석 결과 DB/Redis 저장
  ↓
앱에 반환
```

MVP 단계에서는 큐 없이 단순 API로 시작할 수 있다.

```text
POST /api/analysis/position
→ 백엔드에서 Stockfish 프로세스에 FEN 전달
→ depth 12~16 분석
→ bestmove / eval / pv 반환
```

하지만 게임 전체 분석은 오래 걸리므로, 출시용 서비스에서는 비동기 큐 기반 처리를 권장한다.

---

## 3. 서버에 Stockfish 설치

### Ubuntu 기준

```bash
sudo apt update
sudo apt install stockfish
which stockfish
stockfish
```

환경에 따라 실행 경로는 다를 수 있다.

예시:

```text
/usr/games/stockfish
/usr/local/bin/stockfish
/app/engines/stockfish
```

직접 최신 바이너리를 받아서 서버에 올려도 된다.

---

## 4. Stockfish 실행 확인

터미널에서 Stockfish를 실행한다.

```bash
stockfish
```

또는 경로를 직접 지정한다.

```bash
/usr/games/stockfish
```

입력:

```text
uci
```

정상이라면 엔진 정보와 옵션들이 출력되고 마지막에 다음이 나온다.

```text
uciok
```

그 다음 입력:

```text
isready
```

정상 응답:

```text
readyok
```

종료:

```text
quit
```

---

## 5. UCI 기본 명령 흐름

단일 포지션 분석 흐름은 대략 다음과 같다.

```text
uci
isready
ucinewgame
position fen <FEN>
go depth 15
```

Stockfish는 분석 중 여러 `info` 라인을 출력한다.

예시:

```text
info depth 15 score cp 34 pv e2e4 e7e5 g1f3
```

의미:

```text
depth 15       → 15 depth까지 분석
score cp 34    → 백 기준 대략 +0.34
pv             → principal variation, 엔진이 보는 주요 라인
```

메이트가 보이면 다음처럼 나온다.

```text
info depth 15 score mate 3 pv ...
```

마지막에는 다음 형식의 줄이 나온다.

```text
bestmove e2e4 ponder e7e5
```

---

## 6. API 설계 예시

### 6.1 단일 포지션 분석

요청:

```http
POST /api/analysis/position
Content-Type: application/json
```

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "depth": 15
}
```

응답:

```json
{
  "bestMove": "e2e4",
  "scoreCp": 34,
  "mateIn": null,
  "pv": ["e2e4", "e7e5", "g1f3"],
  "depth": 15
}
```

---

### 6.2 게임 전체 분석

요청:

```http
POST /api/analysis/games
Content-Type: application/json
```

```json
{
  "pgn": "...",
  "depth": 15
}
```

응답:

```json
{
  "analysisId": "abc123",
  "status": "QUEUED"
}
```

조회:

```http
GET /api/analysis/games/abc123
```

완료 응답 예시:

```json
{
  "status": "DONE",
  "moves": [
    {
      "ply": 1,
      "move": "e4",
      "beforeCp": 20,
      "afterCp": 34,
      "bestMove": "e2e4",
      "classification": "best"
    }
  ]
}
```

게임 전체 분석은 반드시 비동기 처리하는 것이 좋다.

---

## 7. Kotlin/Spring에서 직접 Stockfish 붙이기

Kotlin/Spring 백엔드에서 `ProcessBuilder`를 사용하면 Stockfish 프로세스와 직접 통신할 수 있다.

### 7.1 분석 결과 DTO

```kotlin
data class EngineEval(
    val bestMove: String?,
    val scoreCp: Int?,
    val mateIn: Int?,
    val pv: List<String>,
    val depth: Int?
)
```

---

### 7.2 StockfishClient 예시

```kotlin
class StockfishClient(
    private val stockfishPath: String
) : AutoCloseable {

    private val process: Process = ProcessBuilder(stockfishPath)
        .redirectErrorStream(true)
        .start()

    private val writer = process.outputStream.bufferedWriter()
    private val reader = process.inputStream.bufferedReader()

    init {
        send("uci")
        readUntil { it == "uciok" }

        send("isready")
        readUntil { it == "readyok" }

        send("setoption name Threads value 1")
        send("setoption name Hash value 128")
        send("isready")
        readUntil { it == "readyok" }
    }

    @Synchronized
    fun analyzeFen(fen: String, depth: Int = 15): EngineEval {
        send("ucinewgame")
        send("isready")
        readUntil { it == "readyok" }

        send("position fen $fen")
        send("go depth $depth")

        var bestMove: String? = null
        var scoreCp: Int? = null
        var mateIn: Int? = null
        var pv: List<String> = emptyList()
        var lastDepth: Int? = null

        while (true) {
            val line = reader.readLine() ?: break

            if (line.startsWith("info ")) {
                val tokens = line.split(" ")

                val depthIdx = tokens.indexOf("depth")
                if (depthIdx >= 0 && depthIdx + 1 < tokens.size) {
                    lastDepth = tokens[depthIdx + 1].toIntOrNull()
                }

                val scoreIdx = tokens.indexOf("score")
                if (scoreIdx >= 0 && scoreIdx + 2 < tokens.size) {
                    when (tokens[scoreIdx + 1]) {
                        "cp" -> {
                            scoreCp = tokens[scoreIdx + 2].toIntOrNull()
                            mateIn = null
                        }
                        "mate" -> {
                            mateIn = tokens[scoreIdx + 2].toIntOrNull()
                            scoreCp = null
                        }
                    }
                }

                val pvIdx = tokens.indexOf("pv")
                if (pvIdx >= 0 && pvIdx + 1 < tokens.size) {
                    pv = tokens.drop(pvIdx + 1)
                }
            }

            if (line.startsWith("bestmove ")) {
                bestMove = line.split(" ").getOrNull(1)
                break
            }
        }

        return EngineEval(
            bestMove = bestMove,
            scoreCp = scoreCp,
            mateIn = mateIn,
            pv = pv,
            depth = lastDepth
        )
    }

    private fun send(command: String) {
        writer.write(command)
        writer.newLine()
        writer.flush()
    }

    private fun readUntil(predicate: (String) -> Boolean): List<String> {
        val lines = mutableListOf<String>()
        while (true) {
            val line = reader.readLine() ?: break
            lines += line
            if (predicate(line)) break
        }
        return lines
    }

    override fun close() {
        runCatching {
            send("quit")
        }
        process.destroy()
    }
}
```

사용 예시:

```kotlin
val engine = StockfishClient("/usr/games/stockfish")

val result = engine.analyzeFen(
    fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    depth = 15
)

println(result)
```

주의: 실제 사용 시 FEN 유효성 검증이 필요하다.

---

## 8. 요청마다 프로세스를 새로 띄우면 안 됨

나쁜 구조:

```text
요청 1개
→ Stockfish 프로세스 새로 실행
→ 분석
→ 종료
```

이 방식은 느리고 서버 자원을 많이 잡아먹는다.

좋은 구조:

```text
서버 시작 시 Stockfish 프로세스 N개 생성
→ 요청이 오면 놀고 있는 엔진 하나를 빌림
→ 분석
→ 응답
→ 엔진 반납
```

즉, **Stockfish 프로세스 풀**이 필요하다.

---

## 9. Stockfish Pool 예시

```kotlin
class StockfishPool(
    stockfishPath: String,
    size: Int
) : AutoCloseable {

    private val pool = java.util.concurrent.ArrayBlockingQueue<StockfishClient>(size)

    init {
        repeat(size) {
            pool.put(StockfishClient(stockfishPath))
        }
    }

    fun <T> borrow(block: (StockfishClient) -> T): T {
        val client = pool.take()
        return try {
            block(client)
        } finally {
            pool.put(client)
        }
    }

    override fun close() {
        while (pool.isNotEmpty()) {
            pool.poll()?.close()
        }
    }
}
```

사용:

```kotlin
val pool = StockfishPool("/usr/games/stockfish", size = 4)

val result = pool.borrow { engine ->
    engine.analyzeFen(fen, depth = 15)
}
```

---

## 10. Threads / Hash 설정

Stockfish에서 운영상 중요한 옵션은 다음 두 가지다.

```text
Threads
Hash
```

### 10.1 기본 원칙

API 서버에서는 보통 다음 구성이 안정적이다.

```text
Stockfish 프로세스 여러 개
각 프로세스 Threads=1
Hash=64~256MB
```

예시:

| 서버 스펙 | 추천 설정 |
|---|---|
| 2 vCPU | 프로세스 1~2개, Threads=1, Hash=64 |
| 4 vCPU | 프로세스 2~4개, Threads=1, Hash=128 |
| 8 vCPU | 프로세스 4~8개, Threads=1, Hash=128~256 |

깊은 분석을 적은 수의 요청에 제공한다면:

```text
프로세스 수를 줄이고
각 엔진의 Threads를 2~4로 증가
```

할 수 있다.

하지만 일반 사용자 API라면 보통 **Threads=1 + 프로세스 풀**이 관리하기 쉽다.

---

## 11. Kotlin 직접 연동의 장단점

### 장점

```text
Spring 서버 안에서 바로 처리 가능
서비스 구조가 단순함
추가 마이크로서비스가 필요 없음
```

### 단점

```text
UCI 파싱을 직접 구현해야 함
PGN/FEN/체스 룰 처리 라이브러리가 Python보다 불편할 수 있음
엔진 프로세스 관리 코드가 비즈니스 코드와 섞일 수 있음
```

---

## 12. Python FastAPI 마이크로서비스 분리 방식

출시 속도와 유지보수를 생각하면 Python 분석 서비스를 분리하는 방식도 좋다.

구조:

```text
Spring API 서버
→ HTTP 또는 MQ
→ Python FastAPI Stockfish 분석 서비스
→ Stockfish
→ 분석 결과 반환
```

Python은 `python-chess`가 UCI 엔진 통신과 체스 포지션 처리를 잘 지원한다.

---

## 13. Python FastAPI 예시

### 13.1 requirements.txt

```text
fastapi
uvicorn
python-chess
pydantic
```

---

### 13.2 main.py

```python
import chess
import chess.engine
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

STOCKFISH_PATH = "/usr/games/stockfish"
engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)

class AnalyzeRequest(BaseModel):
    fen: str
    depth: int = 15

@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    board = chess.Board(req.fen)

    info = engine.analyse(
        board,
        chess.engine.Limit(depth=req.depth)
    )

    score = info["score"].white()
    pv = info.get("pv", [])

    if score.is_mate():
        score_cp = None
        mate_in = score.mate()
    else:
        score_cp = score.score()
        mate_in = None

    return {
        "scoreCp": score_cp,
        "mateIn": mate_in,
        "pv": [move.uci() for move in pv],
        "depth": info.get("depth")
    }
```

실행:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

요청:

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "depth": 15
  }'
```

---

## 14. Docker 구성 예시

### Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y stockfish \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

빌드:

```bash
docker build -t chess-analyzer .
```

실행:

```bash
docker run -p 8000:8000 chess-analyzer
```

---

## 15. 캐싱 전략

같은 포지션은 매우 자주 등장한다.

따라서 Redis 캐싱을 거의 필수로 보는 것이 좋다.

### 15.1 캐시 키

```text
analysis:{stockfishVersion}:{depth}:{multipv}:{fenHash}
```

예시:

```text
analysis:sf16.1:15:1:9f2a8c...
```

### 15.2 TTL

| 분석 종류 | 추천 TTL |
|---|---|
| 단일 포지션 | 7~30일 |
| 오프닝 포지션 | 장기 보관 |
| 게임 전체 분석 | 영구 보관 가능 |
| 사용자 무료 분석 | 제한적으로 보관 |

---

## 16. 타임아웃 전략

Stockfish 분석은 반드시 타임아웃을 걸어야 한다.

예시:

```text
단일 포지션 무료 분석: 2~5초
유료 분석: 10~30초
게임 전체 분석: 큐 기반, 작업 단위별 제한
```

UCI에서는 depth 대신 시간 기준으로 분석할 수도 있다.

```text
go movetime 3000
```

의미:

```text
3초 동안 분석
```

depth 기반:

```text
go depth 15
```

시간 기반:

```text
go movetime 3000
```

운영에서는 시간 기반이 서버 부하 관리에 더 유리할 수 있다.

---

## 17. MultiPV

여러 후보수를 받고 싶으면 `MultiPV` 옵션을 사용한다.

```text
setoption name MultiPV value 3
```

그 다음 분석하면 상위 3개 후보 라인을 받을 수 있다.

주의:

```text
MultiPV를 늘리면 분석 비용이 증가한다.
```

추천:

| 기능 | MultiPV |
|---|---|
| 무료 단일 분석 | 1 |
| 유료 분석 | 3 |
| 학습용 추천 후보 | 3~5 |

---

## 18. 게임 전체 분석 로직

한 수의 품질을 평가하려면 보통 다음 두 값을 본다.

```text
수 두기 전 포지션 평가
수 둔 뒤 포지션 평가
```

흐름:

```text
position before move
→ Stockfish 분석
→ bestMove, beforeEval 저장

실제 move 적용

position after move
→ Stockfish 분석
→ afterEval 저장

eval 차이 계산
→ move classification
```

주의할 점:

```text
평가값은 반드시 백 기준으로 통일한다.
```

내부 표현 추천:

```text
evalCpWhitePerspective
+면 백 유리
-면 흑 유리
```

---

## 19. CP → Win% 변환

Lichess식으로 단순 centipawn loss 대신 Win% 또는 expected score proxy로 바꾸면 좋다.

예시 공식:

```text
Win% = 50 + 50 * (2 / (1 + exp(-k * cp)) - 1)
```

Lichess의 현재 계수 예시:

```text
k ≈ 0.00368208
```

이 값은 절대 법칙이 아니라 고수 게임 데이터와 엔진 평가를 바탕으로 피팅한 경험적 계수다.

---

## 20. Accuracy 계산

Win% 손실을 기반으로 수 정확도를 계산할 수 있다.

예시:

```text
winDiff = winPercentBefore - winPercentAfter
```

Lichess식 예시:

```text
Accuracy% = 103.1668 * exp(-0.04354 * winDiff) - 3.1669
```

실제 구현에서는 0~100 사이로 clamp한다.

```kotlin
fun clampAccuracy(value: Double): Double {
    return value.coerceIn(0.0, 100.0)
}
```

---

## 21. Inaccuracy / Mistake / Blunder 분류 예시

직접 앱에서 분류 기준을 만들 수 있다.

### 21.1 Win% 손실 기반 예시

| 분류 | Win% 손실 |
|---|---:|
| Best / Excellent | 0~2 |
| Good | 2~5 |
| Inaccuracy | 5~10 |
| Mistake | 10~20 |
| Blunder | 20+ |

### 21.2 Accuracy 기반 예시

| 분류 | Move Accuracy |
|---|---:|
| Best / Excellent | 90~100 |
| Good | 75~90 |
| Inaccuracy | 60~75 |
| Mistake | 40~60 |
| Blunder | 0~40 |

이 기준은 앱의 UX 목적에 맞게 조정하면 된다.

---

## 22. 큐 기반 비동기 분석

게임 전체 분석은 다음처럼 큐로 처리하는 것을 추천한다.

```text
API 서버
→ analysis_jobs 테이블 또는 Redis Queue
→ Worker가 작업 가져감
→ Stockfish 분석
→ analysis_results 저장
→ 사용자에게 완료 표시
```

### 22.1 DB 테이블 예시

```sql
CREATE TABLE analysis_jobs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    pgn TEXT NOT NULL,
    depth INT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    error_message TEXT NULL
);
```

```sql
CREATE TABLE analysis_moves (
    id BIGSERIAL PRIMARY KEY,
    analysis_job_id BIGINT NOT NULL,
    ply INT NOT NULL,
    move_uci VARCHAR(10) NOT NULL,
    fen_before TEXT NOT NULL,
    fen_after TEXT NOT NULL,
    before_cp INT NULL,
    after_cp INT NULL,
    best_move VARCHAR(10) NULL,
    classification VARCHAR(30) NULL,
    accuracy NUMERIC(5, 2) NULL
);
```

---

## 23. 사용량 제한

Stockfish 분석은 CPU 비용이 크기 때문에 반드시 제한이 필요하다.

예시:

| 사용자 유형 | 제한 |
|---|---|
| 비로그인 | 단일 포지션 몇 회 |
| 무료 회원 | 하루 N회 분석 |
| 유료 회원 | 더 높은 depth / 게임 전체 분석 |
| 관리자 | 제한 없음 |

제한 기준:

```text
일일 분석 횟수
분석 depth
게임 전체 분석 개수
MultiPV 개수
최대 ply 수
동시 분석 작업 수
```

---

## 24. 보안 체크

사용자 입력으로 FEN/PGN을 받기 때문에 검증이 필요하다.

### 24.1 FEN 검증

Python:

```python
import chess

try:
    board = chess.Board(fen)
except ValueError:
    raise InvalidFenException()
```

Kotlin/Java에서는 chess library를 쓰거나, 최소한 길이/문자 검증을 해야 한다.

### 24.2 PGN 검증

너무 큰 PGN을 막아야 한다.

```text
최대 파일 크기 제한
최대 게임 수 제한
최대 ply 제한
비정상 문자 필터링
```

### 24.3 프로세스 격리

Stockfish 프로세스가 과도한 자원을 사용하지 않도록 제한한다.

```text
Docker CPU limit
Docker memory limit
프로세스 풀 크기 제한
타임아웃
```

---

## 25. 운영 모니터링

다음 지표를 수집하면 좋다.

```text
분석 요청 수
평균 분석 시간
p95 분석 시간
분석 실패 수
Stockfish 프로세스 재시작 횟수
큐 대기 시간
캐시 hit rate
CPU 사용률
메모리 사용률
```

---

## 26. 추천 MVP 구현 순서

```text
1. 서버에 Stockfish 설치
2. 단일 FEN 분석 API 구현
3. FEN 유효성 검증
4. Stockfish 프로세스 재사용
5. Stockfish 프로세스 풀 구현
6. timeout 추가
7. Redis 캐시 추가
8. PGN 파싱
9. 게임 전체 분석 비동기 처리
10. CP → Win% 변환
11. Accuracy 계산
12. Inaccuracy / Mistake / Blunder 분류
13. 사용자별 사용량 제한
14. 유료 기능 분리
```

---

## 27. 추천 아키텍처

출시용으로 가장 무난한 구조:

```text
Spring/Kotlin API 서버
→ Redis 또는 DB 기반 Analysis Queue
→ Python FastAPI Stockfish Analyzer
→ Stockfish Process Pool
→ Redis Cache
→ PostgreSQL/MySQL 저장
```

이 구조의 장점:

```text
Spring은 인증/결제/사용자/비즈니스 로직 담당
Python은 체스 분석/Stockfish 통신 담당
분석 워커만 따로 스케일 아웃 가능
Stockfish 장애가 API 서버 전체 장애로 번지는 것을 줄일 수 있음
```

---

## 28. 라이선스 주의

Stockfish는 GPL 라이선스 계열이다.

일반적으로 서버에서 Stockfish를 실행해 분석 결과를 API로 제공하는 구조와, 앱에 Stockfish 바이너리/WASM을 포함해서 배포하는 구조는 라이선스 리스크가 다르게 볼 수 있다.

주의할 점:

```text
앱에 Stockfish 바이너리나 WASM을 포함해 배포하면 GPL 의무가 강하게 문제될 수 있음
Stockfish를 수정했다면 수정 소스 공개 의무 검토 필요
라이선스 고지 필요
상용 앱 출시 전 오픈소스 라이선스 검토 권장
```

Lichess 공식 fishnet 네트워크를 내 앱의 분석 백엔드처럼 사용하는 것은 피해야 한다.  
내 서버에서 직접 Stockfish를 돌리거나, 사설 분석 워커를 운영하는 방식이 맞다.

---

## 29. 결론

백엔드 Stockfish 분석의 핵심은 다음이다.

```text
Stockfish는 HTTP API가 아니라 UCI 엔진이다.
백엔드는 Stockfish 프로세스를 띄우고 stdin/stdout으로 통신한다.
요청마다 프로세스를 띄우지 말고 프로세스 풀을 사용한다.
게임 전체 분석은 큐 기반 비동기로 처리한다.
캐시와 사용량 제한은 거의 필수다.
```

초기 앱 출시 기준 추천 구조:

```text
Spring/Kotlin API 서버
→ Python FastAPI 분석 마이크로서비스
→ Stockfish 프로세스 풀
→ Redis 캐시
→ 게임 전체 분석은 비동기 큐
```
