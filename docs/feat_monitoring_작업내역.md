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
