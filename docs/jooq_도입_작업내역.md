# jOOQ 도입 작업내역

## 왜 도입하는가?

현재 `GamePersistenceAdapter`에서 raw SQL 문자열을 직접 작성하고 있음.
- 컴파일 타임에 SQL 오류를 잡을 수 없음
- 동적 쿼리(필터, 페이지네이션) 조합이 문자열 연결로 관리됨
- 스키마 변경 시 영향받는 쿼리를 수동으로 찾아야 함

jOOQ를 도입하여 **타입 세이프한 SQL 빌더**로 전환.

## 아키텍처 결정

### jOOQ를 SQL 빌더로만 사용 (실행은 R2DBC DatabaseClient)

- jOOQ의 R2DBC 네이티브 실행도 가능하지만, 기존 Spring Data R2DBC 인프라와 공존
- 단순 CRUD는 `CoroutineCrudRepository` 유지
- 복잡한 쿼리만 jOOQ DSL → SQL 생성 → `DatabaseClient` 실행

### 코드 생성 워크플로우

```
Flyway migration 실행 → DB 스키마 생성 → jOOQ codegen → 컴파일
```

1. PostgreSQL Docker 컨테이너 실행 (docker-compose)
2. `./gradlew flywayMigrate` — 마이그레이션 실행
3. `./gradlew generateJooq` — DB 스키마에서 jOOQ 코드 생성
4. 생성 코드: `build/generated-src/jooq/main/org/raonpark/chessriend/jooq/`

## 의존성

```kotlin
// build.gradle.kts
plugins {
    id("nu.studer.jooq") version "10.2.1"
}

dependencies {
    // jOOQ
    implementation("org.jooq:jooq")
    implementation("org.jooq:jooq-kotlin")
    implementation("org.jooq:jooq-kotlin-coroutines")
    
    // jOOQ 코드 생성용 JDBC 드라이버
    jooqGenerator("org.postgresql:postgresql")
}
```

## 코드 생성 설정

```kotlin
jooq {
    version.set("3.21.1")
    
    configurations {
        create("main") {
            generateSchemaSourceOnCompilation.set(false) // 수동 생성
            
            jooqConfiguration.apply {
                jdbc.apply {
                    driver = "org.postgresql.Driver"
                    url = "jdbc:postgresql://localhost:5432/chessriend"
                    user = "chessriend"
                    password = "chessriend"
                }
                generator.apply {
                    name = "org.jooq.codegen.KotlinGenerator"
                    database.apply {
                        name = "org.jooq.meta.postgres.PostgresDatabase"
                        inputSchema = "public"
                        excludes = "flyway_schema_history"
                    }
                    generate.apply {
                        isDeprecated = false
                        isRecords = true
                        isPojos = true
                        isDataClasses = true
                    }
                    target.apply {
                        packageName = "org.raonpark.chessriend.jooq"
                        directory = "build/generated-src/jooq/main"
                    }
                }
            }
        }
    }
}
```

## DSLContext 빈 설정

```kotlin
@Configuration
class JooqConfig {
    @Bean
    fun dslContext(): DSLContext =
        DSL.using(SQLDialect.POSTGRES)
}
```

SQL 빌더로만 사용하므로 ConnectionFactory 바인딩 불필요.
`DSL.using(SQLDialect.POSTGRES)`로 SQL 생성만 수행.

## 마이그레이션 전/후 비교

### Before (raw SQL)

```kotlin
override fun findAll(...): Flow<Game> {
    val conditions = mutableListOf<String>()
    if (source != null) conditions.add("source = :source")
    if (timeCategory != null) conditions.add("time_category = :timeCategory")
    val whereClause = if (conditions.isEmpty()) "" else "WHERE ${conditions.joinToString(" AND ")}"
    val sql = "SELECT * FROM games $whereClause ORDER BY played_at DESC LIMIT :limit OFFSET :offset"
    // ...
}
```

### After (jOOQ DSL)

```kotlin
override fun findAll(...): Flow<Game> {
    val query = dsl.select(GAMES.asterisk())
        .from(GAMES)
        .apply {
            source?.let { where(GAMES.SOURCE.eq(it.name)) }
            timeCategory?.let { and(GAMES.TIME_CATEGORY.eq(it.name)) }
        }
        .orderBy(GAMES.PLAYED_AT.desc())
        .limit(limit)
        .offset(offset)
    // DatabaseClient로 실행
}
```

## 주요 변경 파일

| 파일 | 변경 |
|------|------|
| `build.gradle.kts` | jOOQ 플러그인 + 의존성 + codegen 설정 |
| `.gitignore` | `build/generated-src/jooq/` 추가 |
| `shared/config/JooqConfig.kt` | DSLContext 빈 설정 |
| `GamePersistenceAdapter.kt` | raw SQL → jOOQ DSL 전환 |
| `CLAUDE.md` | R2DBC + jOOQ 규칙 추가 |
