# Task Completion Checklist

When a coding task is completed, ensure the following:

1. **Code compiles**: `./gradlew build` (backend) or `pnpm build` (frontend)
2. **Tests pass**: `./gradlew test` or `pnpm test`
3. **Architecture respected**: Domain has no external dependencies, ports are interfaces only
4. **Docs updated**: If new feature/pattern, update relevant docs/ file
5. **CLAUDE.md updated**: If tech stack or structure changed
6. **No secrets committed**: Check application.yml for hardcoded credentials
