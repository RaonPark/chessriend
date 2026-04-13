# feat/CI — GitHub Actions CI 파이프라인 구축

## 2026-04-13: CI 파이프라인 + JaCoCo 커버리지

### 무엇을

GitHub Actions CI 워크플로우를 추가하여 PR마다 백엔드/프론트엔드 테스트 + 커버리지를 자동 검증한다.

**백엔드:**
- JaCoCo 플러그인 추가 (`build.gradle.kts`)
- Gradle test → JaCoCo 리포트 (XML + HTML) 자동 생성
- Testcontainers로 PostgreSQL 자동 기동 (Docker-in-Docker)
- PR에 커버리지 코멘트 자동 추가 (`madrapps/jacoco-report`)

**프론트엔드:**
- `pnpm test:run` (Vitest 테스트)
- `pnpm test:coverage` (v8 커버리지 리포트)
- `pnpm build` (TypeScript + Vite 빌드 검증)

**워크플로우 구조:**
- `backend` / `frontend` 2개 Job 병렬 실행
- 트리거: `push` (main), `pull_request` (main)
- 아티팩트: 커버리지 리포트 14일 보관

### 왜
- PR 머지 전 자동으로 테스트 실패를 감지하여 main 브랜치 안정성 보장
- JaCoCo 커버리지 코멘트로 PR 리뷰 시 테스트 커버리지 변화를 즉시 확인
- 프론트/백엔드 병렬 실행으로 CI 시간 최소화

### 변경 파일

| 파일 | 설명 |
|------|------|
| `build.gradle.kts` | JaCoCo 플러그인 + test/report task 설정 추가 |
| `.github/workflows/ci.yml` | CI 워크플로우 (backend + frontend 병렬) |

### 의사결정 기록

| 결정 | 선택 | 이유 |
|------|------|------|
| CI 서비스 | GitHub Actions | 레포가 GitHub에 있으므로 가장 자연스러운 통합 |
| 백엔드 DB | Testcontainers (Docker) | ubuntu-latest에 Docker 기본 포함, 별도 service 설정 불필요 |
| JDK 배포판 | Amazon Corretto 25 | 로컬 개발 환경과 동일 |
| 커버리지 코멘트 | madrapps/jacoco-report | JaCoCo XML 파싱 → PR 코멘트, min-coverage 0으로 시작 |
| Job 구조 | backend/frontend 병렬 | 서로 독립적, 병렬 실행으로 전체 CI 시간 단축 |
| pnpm 버전 | 10 | 로컬과 동일 (pnpm 10.33.0) |
| Node.js 버전 | 22 LTS | 안정 버전, Vitest 4.x 요구사항 (Node 20+) 충족 |
