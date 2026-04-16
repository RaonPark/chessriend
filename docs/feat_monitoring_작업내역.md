# feat/monitoring 작업내역

## Prometheus + Grafana 모니터링 환경 구축

### 무엇을 변경했는지

Spring Boot Actuator + Micrometer를 통해 Prometheus 메트릭을 노출하고,
Docker Compose로 Prometheus + Grafana 모니터링 스택을 구성했다.

### 왜 이렇게 했는지

- 앱의 JVM 상태, HTTP 요청 성능, DB 커넥션 풀 등을 실시간으로 관찰하기 위함
- Micrometer는 Spring Boot에 기본 내장되어 있어 의존성 하나(`micrometer-registry-prometheus`)만 추가하면 Prometheus 포맷으로 메트릭을 노출할 수 있음
- Grafana 프로비저닝으로 datasource와 대시보드를 자동 설정하여, `docker compose up` 한 번으로 즉시 사용 가능하게 함

### 주요 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `build.gradle.kts` | `micrometer-registry-prometheus` runtimeOnly 의존성 추가 |
| `src/main/resources/application.yml` | prometheus endpoint 노출, 메트릭 태그/히스토그램 설정 |
| `docker-compose.yml` | Prometheus, Grafana 컨테이너 추가 |
| `monitoring/prometheus/prometheus.yml` | Prometheus 스크래핑 설정 (15초 간격, `/actuator/prometheus`) |
| `monitoring/grafana/provisioning/datasources/datasource.yml` | Grafana → Prometheus datasource 자동 프로비저닝 |
| `monitoring/grafana/provisioning/dashboards/dashboard.yml` | 대시보드 파일 자동 로드 설정 |
| `monitoring/grafana/dashboards/spring-boot-overview.json` | Spring Boot Overview 대시보드 (JVM, HTTP, GC, DB Pool) |

### 사용법

```bash
# 모니터링 스택 실행
docker compose up -d prometheus grafana

# Spring Boot 앱 실행 (호스트에서)
./gradlew bootRun

# 접속
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3000 (admin / admin)
# 메트릭 확인: http://localhost:8081/actuator/prometheus
```

### Grafana 대시보드 패널 구성

- **Uptime** — 앱 가동 시간
- **CPU Usage** — 시스템/프로세스 CPU 사용률
- **JVM Heap / Non-Heap Memory** — 메모리 사용/커밋 추이
- **JVM Threads** — 라이브/데몬/피크 스레드 수
- **HTTP Request Rate** — 초당 요청 수 (URI, 메서드, 상태별)
- **HTTP Response Time** — p50 / p95 / p99 응답 시간
- **GC Pause Time** — GC 일시정지 시간
- **DB Connection Pool** — R2DBC 커넥션 풀 상태 (acquired/idle/max)

---

## Loki + Tempo Observability 스택 추가

### 무엇을 변경했는지

기존 Prometheus + Grafana 메트릭 모니터링에 **Loki**(중앙 집중 로깅)와 **Tempo**(분산 트레이싱)를 추가하여 Observability 삼각형(메트릭/로그/트레이스)을 완성했다.

- Loki: 애플리케이션 로그를 수집하고, traceId로 Tempo 트레이스에 연결
- Tempo: OTLP로 분산 트레이스를 수신하고, Prometheus에 span 메트릭 생성
- Grafana: Loki/Tempo 데이터소스 추가 + 상호 연결(로그→트레이스, 트레이스→로그)

### 왜 이렇게 했는지

- 메트릭만으로는 "무엇이 느린가"는 알 수 있지만 "왜 느린가"는 알 수 없음
- 로그 + 트레이스를 traceId로 연결하면, 에러 로그에서 해당 요청의 전체 실행 경로를 즉시 추적 가능
- Grafana에서 Loki ↔ Tempo ↔ Prometheus가 상호 연결되어, 한 곳에서 메트릭 → 로그 → 트레이스를 넘나들 수 있음
- Tempo의 `metrics_generator`가 span 기반 메트릭을 Prometheus에 remote write하여, 트레이스 데이터로부터 서비스 그래프도 생성

### 주요 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `build.gradle.kts` | `micrometer-tracing-bridge-otel`, `opentelemetry-exporter-otlp`, `loki-logback-appender` 의존성 추가 |
| `src/main/resources/application.yml` | tracing sampling(100%), OTLP endpoint, 로그 correlation 패턴 설정 |
| `src/main/resources/logback-spring.xml` | Loki appender 설정 (JSON 포맷, traceId/spanId 포함) |
| `docker-compose.yml` | Loki, Tempo 컨테이너 + 볼륨 추가, Grafana depends_on 업데이트 |
| `monitoring/loki/loki-config.yml` | Loki 설정 (TSDB 스토리지, schema v13, 로컬 파일시스템) |
| `monitoring/tempo/tempo-config.yml` | Tempo 설정 (OTLP gRPC/HTTP 수신, Prometheus remote write, span-metrics) |
| `monitoring/grafana/provisioning/datasources/datasource.yml` | Loki, Tempo 데이터소스 추가 + 상호 연결 (derivedFields, tracesToLogs) |
| `monitoring/grafana/dashboards/logs-and-traces.json` | Logs & Traces 대시보드 (로그 볼륨, 에러/경고 카운트, 로그 뷰어, 트레이스 테이블) |

### 사용법

```bash
# 전체 모니터링 스택 실행
docker compose up -d

# Spring Boot 앱 실행
./gradlew bootRun

# 접속
# Grafana:    http://localhost:3000 (admin / admin)
# Prometheus: http://localhost:9090
# Loki:       http://localhost:3100 (직접 접근은 불필요, Grafana에서 조회)
# Tempo:      http://localhost:3200 (직접 접근은 불필요, Grafana에서 조회)
```

### Grafana에서 Logs & Traces 사용법

1. **로그 조회**: Grafana → Dashboards → "Chessriend - Logs & Traces" → 로그 레벨 필터링 가능
2. **로그 → 트레이스**: 로그 항목의 `traceId` 필드 클릭 → "View Trace"로 Tempo 트레이스 이동
3. **트레이스 → 로그**: Tempo에서 트레이스 조회 시 "Logs for this span" 자동 연결
4. **Explore**: Grafana → Explore → 데이터소스를 Loki/Tempo로 선택하여 자유롭게 쿼리

### 아키텍처

```
Spring Boot App
├── Micrometer Tracing (OTel Bridge) ──→ Tempo (OTLP gRPC :4317)
├── Loki Logback Appender ─────────────→ Loki (HTTP :3100)
└── Actuator /prometheus ──────────────→ Prometheus (scrape :8081)

Tempo ──(remote write span metrics)──→ Prometheus
Grafana ──→ Prometheus (메트릭)
         ──→ Loki (로그, traceId로 Tempo 연결)
         ──→ Tempo (트레이스, 로그/메트릭 역연결)
```
