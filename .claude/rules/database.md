---
paths:
  - "**/persistence/**/*.kt"
  - "**/out/**/*.kt"
---

# R2DBC + jOOQ

## Query Strategy

- Simple CRUD → `CoroutineCrudRepository` methods
- Complex queries (dynamic WHERE, pagination, JOIN) → **jOOQ DSL** + R2DBC execution
  - Why: 스키마 변경 시 컴파일 타임에 잡기 위함. raw SQL은 런타임에야 터짐
- Code generation: `./gradlew generateJooq` after Flyway migration
  - Generated path: `build/generated-src/jooq/` (gitignored)

## jOOQ DSL → R2DBC Execution Pattern

```kotlin
// ✅ jOOQ DSL로 타입 세이프 쿼리 작성
val query = dsl.select(GAMES.asterisk())
    .from(GAMES)
    .where(GAMES.SOURCE.eq(source.name))
    .and(GAMES.TIME_CATEGORY.eq(timeCategory.name))
    .orderBy(GAMES.PLAYED_AT.desc())
    .limit(limit)
    .offset(offset)

// ✅ jOOQ → SQL string → DatabaseClient 실행
databaseClient.sql(query.getSQL(ParamType.NAMED))
    .bindValues(query.bindValues)
    .map { row, _ -> toEntity(row) }
    .flow()

// ❌ raw SQL 문자열 직접 작성 금지
databaseClient.sql("SELECT * FROM games WHERE source = :source")
```

## JSONB

- Use `io.r2dbc.postgresql.codec.Json.of()` for JSONB columns
