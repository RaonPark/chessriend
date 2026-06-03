# chore/mcp-playwright-setup 작업내역

## 무엇을

1. **PostgreSQL MCP 서버 등록** (`.mcp.json` 신규)
   - `@modelcontextprotocol/server-postgres` (Anthropic 공식, 읽기 전용)을 프로젝트 스코프로 추가
   - 연결 URI는 `${POSTGRES_USER}` 등 환경변수 치환으로 분리
2. **환경변수 템플릿 확장** (`.env.example` 수정)
   - `POSTGRES_HOST/PORT/DB/USER/PASSWORD` 5개 변수 추가
   - 기본값은 `docker-compose.yml`의 자격증명과 동일
3. **Playwright 검사 룰 및 시나리오 추가**
   - `.claude/rules/playwright.md` — 진행 방식 / 사전 조건 / 보고 형식
   - `docs/playwright-scenarios.md` — 7개 시나리오 프롬프트 (PGN 가져오기 ×2, 수 네비게이션, Stockfish 캐시, 메모 저장 유지, 분류 라벨, 다크 모드)

## 왜

- **MCP**: 그동안 DB 조회를 위해 매번 psql/터미널을 띄워야 했음. MCP로 클로드가 직접 스키마/데이터를 확인할 수 있게 함. 읽기 전용 서버를 골라 사고 위험 차단.
- **환경변수 분리**: 자격증명을 `.mcp.json`에 하드코딩하면 git에 노출됨. `.env`(gitignore)로 분리하고 `${VAR}` 치환으로 안전성 확보.
- **Playwright 룰/시나리오**: 프론트 변경 후 "실제로 동작하는지" 확인이 매번 수동이라 누락이 잦았음. 시나리오를 미리 표준화해 일관된 검사 가능. 룰은 frontmatter 경로 매칭으로 자동 로드.

## 핵심 수정 파일

- `.mcp.json` (신규)
- `.env.example` (수정)
- `.claude/rules/playwright.md` (신규)
- `docs/playwright-scenarios.md` (신규)

## 사용 방법

### MCP

1. `docker compose up -d postgres`
2. 셸에서 `set -a; source .env; set +a`
3. Claude Code 실행 → 첫 실행 시 프로젝트 MCP 신뢰 프롬프트 승인
4. `/mcp`로 연결 확인

### Playwright 시나리오

`docs/playwright-scenarios.md`에서 시나리오를 골라 프롬프트를 그대로 복붙. 진행 규칙은 `.claude/rules/playwright.md`가 자동 로드됨.
