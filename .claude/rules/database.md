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
- Code generation: `./gradlew generateJooq` after Flyway migration (`generateJooq` mustRunAfter `flywayMigrate`)
  - Generated package: `org.raonpark.chessriend.jooq` / path: `build/generated-src/jooq/main/` (gitignored)
  - 테이블 참조 import 예: `org.raonpark.chessriend.jooq.tables.references.GAMES`

## jOOQ DSL → R2DBC Execution Pattern

동적 조건은 `DSL.trueCondition()`으로 시작해 `?.let { }`로 덧붙인다(조건 0개여도 valid). 실행은 `query.params`를 순회 바인딩하며, **jOOQ `JSONB`는 R2DBC가 직접 인코딩 못 하므로 `Json.of(...)`로 변환**한다.

```kotlin
// ✅ jOOQ DSL로 타입 세이프 쿼리 작성 (동적 WHERE)
var query = dsl.select(DSL.asterisk())
    .from(GAMES)
    .where(DSL.trueCondition())
source?.let { query = query.and(GAMES.SOURCE.eq(it.name)) }
timeCategory?.let { query = query.and(GAMES.TIME_CATEGORY.eq(it.name)) }
val finalQuery = query.orderBy(GAMES.PLAYED_AT.desc()).limit(limit).offset(offset)

// ✅ jOOQ → SQL string → DatabaseClient 실행 (params 순회 + JSONB 변환)
fun bindQuery(query: org.jooq.Query): DatabaseClient.GenericExecuteSpec {
    var spec = databaseClient.sql(query.getSQL(ParamType.NAMED))
    query.params.entries.forEachIndexed { index, (_, param) ->
        val value = when (val v = param.value!!) {
            is JSONB -> Json.of(v.data())   // jOOQ JSONB → R2DBC Json
            else -> v
        }
        spec = spec.bind(index, value)
    }
    return spec
}
bindQuery(finalQuery).map { row, _ -> toEntity(row) }.all().asFlow()

// ❌ raw SQL 문자열 직접 작성 금지
databaseClient.sql("SELECT * FROM games WHERE source = :source")
```

> 실제 구현: `game/adapter/out/persistence/GamePersistenceAdapter.kt`(`bindQuery`).

## JSONB

- 도메인 ↔ JSONB: Jackson(`tools.jackson`)으로 직렬화 후 `org.jooq.JSONB.jsonb(string)`(쓰기) / 컬럼 조회는 `io.r2dbc.postgresql.codec.Json`(`row.get("col", Json::class.java)`)
- jOOQ DSL로 짠 쿼리를 R2DBC로 실행할 때 jOOQ `JSONB` 파라미터는 `Json.of(jsonb.data())`로 변환해 바인딩(위 `bindQuery` 참고)
