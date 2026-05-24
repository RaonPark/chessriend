---
name: new-domain
description: 새 바운디드 컨텍스트(feature module) 스캐폴드. 헥사고날 6레이어(domain/application/port-in/port-out/adapter-in-web/adapter-out-persistence) + Entity + R2dbcRepository + PersistenceAdapter + Flyway 마이그레이션 + 테스트 미러 + 작업내역 docs를 한 번에 생성. 인자는 소문자 단일 단어(예: note, user, opening, analysis).
---

# /new-domain {name}

새 바운디드 컨텍스트를 헥사고날 6레이어 풀 스택으로 스캐폴드한다. `game/` 도메인을 패턴 레퍼런스로 사용.

## 입력 계약

`$ARGUMENTS` = 단일 소문자 단어. 예: `note`, `user`, `opening`.

## 실행 절차

### 1. 사전 체크 (실패 시 즉시 중단)

```bash
# 입력 검증
[[ "$ARGUMENTS" =~ ^[a-z]+$ ]] || { echo "ERROR: 도메인 이름은 소문자 단일 단어만 허용 (예: note, user). 받은 값: '$ARGUMENTS'"; exit 1; }

DOMAIN="$ARGUMENTS"
DOMAIN_CAP="$(echo "${DOMAIN:0:1}" | tr '[:lower:]' '[:upper:]')${DOMAIN:1}"
BASE="src/main/kotlin/org/raonpark/chessriend/$DOMAIN"
TEST_BASE="src/test/kotlin/org/raonpark/chessriend/$DOMAIN"

# 중복 체크
[[ -e "$BASE" ]] && { echo "ERROR: 도메인 '$DOMAIN'이 이미 존재함 ($BASE)"; exit 1; }

# 컨텍스트 수집
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [[ -z "$BRANCH" || "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
    DOC_NAME="feat_${DOMAIN}_작업내역.md"
else
    DOC_NAME="$(echo "$BRANCH" | tr '/' '_')_작업내역.md"
fi

# 다음 Flyway 버전 계산
NEXT_V=$(ls src/main/resources/db/migration/ 2>/dev/null | grep -oE '^V[0-9]+' | sed 's/V//' | sort -n | tail -1)
NEXT_V=$((${NEXT_V:-0} + 1))

echo "도메인: $DOMAIN (cap: $DOMAIN_CAP)"
echo "Flyway 버전: V$NEXT_V"
echo "Docs 파일명: $DOC_NAME"
```

### 2. 디렉터리 생성

```bash
mkdir -p "$BASE/domain" \
         "$BASE/application" \
         "$BASE/port/in" \
         "$BASE/port/out" \
         "$BASE/adapter/in/web" \
         "$BASE/adapter/out/persistence" \
         "$TEST_BASE/domain"
```

### 3. 11개 파일 생성

다음 템플릿을 **그대로** 사용한다. `{DOMAIN}` → 실제 소문자 도메인명, `{D}` → 첫글자 대문자(예: note → Note)로 치환.

#### 파일 1: `src/main/kotlin/org/raonpark/chessriend/{DOMAIN}/domain/{D}.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.domain

// TODO: 도메인 엔티티 필드 정의 — Rich Domain 패턴 (비즈니스 메서드 포함)
// 외부 프레임워크 import 금지 (Spring, Jackson, R2DBC, jOOQ 등)
data class {D}(
    val id: Long? = null,
)
```

#### 파일 2: `src/main/kotlin/org/raonpark/chessriend/{DOMAIN}/port/in/{D}UseCase.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.port.`in`

import org.raonpark.chessriend.{DOMAIN}.domain.{D}

// TODO: 필요한 유스케이스 시그니처 추가 — suspend fun + 도메인 객체 반환
interface {D}UseCase {
    suspend fun get{D}(id: Long): {D}
}
```

#### 파일 3: `src/main/kotlin/org/raonpark/chessriend/{DOMAIN}/port/out/{D}Repository.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.port.out

import kotlinx.coroutines.flow.Flow
import org.raonpark.chessriend.{DOMAIN}.domain.{D}

// TODO: 필요한 영속화 시그니처 추가
// - 단건 조회/저장: suspend fun
// - 다건 스트리밍: fun ...: Flow<T>
interface {D}Repository {
    suspend fun save({DOMAIN}: {D}): {D}
    suspend fun findById(id: Long): {D}?
    fun findAll(offset: Int, limit: Int): Flow<{D}>
    suspend fun count(): Long
    suspend fun deleteById(id: Long)
}
```

#### 파일 4: `src/main/kotlin/org/raonpark/chessriend/{DOMAIN}/application/{D}Service.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.application

import io.github.oshai.kotlinlogging.KotlinLogging
import org.raonpark.chessriend.{DOMAIN}.domain.{D}
import org.raonpark.chessriend.{DOMAIN}.port.`in`.{D}UseCase
import org.raonpark.chessriend.{DOMAIN}.port.out.{D}Repository
import org.springframework.stereotype.Service

private val log = KotlinLogging.logger {}

@Service
class {D}Service(
    private val {DOMAIN}Repository: {D}Repository,
) : {D}UseCase {

    override suspend fun get{D}(id: Long): {D} =
        {DOMAIN}Repository.findById(id)
            ?: throw NoSuchElementException("{D} not found: id=$id")
            // TODO: shared/exception/에 {D}NotFoundException 추가 후 교체
}
```

#### 파일 5: `src/main/kotlin/org/raonpark/chessriend/{DOMAIN}/adapter/in/web/{D}Controller.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.adapter.`in`.web

import org.raonpark.chessriend.{DOMAIN}.domain.{D}
import org.raonpark.chessriend.{DOMAIN}.port.`in`.{D}UseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// TODO: DTO 추가 후 도메인 직접 노출 대신 {D}Response로 변환 권장
// 패턴: data class {D}Response(...) { companion object { fun from({DOMAIN}: {D}): {D}Response = ... } }
@RestController
@RequestMapping("/api/{DOMAIN}s")
class {D}Controller(
    private val {DOMAIN}UseCase: {D}UseCase,
) {

    @GetMapping("/{id}")
    suspend fun get{D}(@PathVariable id: Long): {D} =
        {DOMAIN}UseCase.get{D}(id)
}
```

#### 파일 6: `src/main/kotlin/org/raonpark/chessriend/{DOMAIN}/adapter/out/persistence/{D}Entity.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.adapter.out.persistence

import org.springframework.data.annotation.Id
import org.springframework.data.annotation.Transient
import org.springframework.data.domain.Persistable
import org.springframework.data.relational.core.mapping.Table

// TODO: 도메인 필드 정의 후 컬럼 매핑 추가
// JSONB 컬럼은 io.r2dbc.postgresql.codec.Json 사용
@Table("{DOMAIN}s")
data class {D}Entity(
    @Id val id: Long,
) : Persistable<Long> {
    @Transient
    var isNewEntity: Boolean = true

    override fun getId(): Long = id
    override fun isNew(): Boolean = isNewEntity
}
```

#### 파일 7: `src/main/kotlin/org/raonpark/chessriend/{DOMAIN}/adapter/out/persistence/R2dbc{D}Repository.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.adapter.out.persistence

import org.springframework.data.repository.kotlin.CoroutineCrudRepository

// 단순 CRUD는 Spring Data가 자동 구현. 파생 쿼리(existsByXxx, deleteByXxx 등)는 여기 추가.
// 복잡한 쿼리(동적 WHERE, 페이지네이션, JOIN)는 {D}PersistenceAdapter에서 jOOQ DSL로 작성.
interface R2dbc{D}Repository : CoroutineCrudRepository<{D}Entity, Long>
```

#### 파일 8: `src/main/kotlin/org/raonpark/chessriend/{DOMAIN}/adapter/out/persistence/{D}PersistenceAdapter.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.adapter.out.persistence

import kotlinx.coroutines.flow.Flow
import org.jooq.DSLContext
import org.raonpark.chessriend.{DOMAIN}.domain.{D}
import org.raonpark.chessriend.{DOMAIN}.port.out.{D}Repository
import org.raonpark.chessriend.shared.id.SnowflakeIdGenerator
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.stereotype.Component

// TODO: toEntity({DOMAIN}: {D}) / toDomain(entity: {D}Entity) 변환 함수 추가
// TODO: findAll/count는 jOOQ DSL + DatabaseClient 패턴 사용 (game/adapter/out/persistence/GamePersistenceAdapter.kt 참조)
@Component
class {D}PersistenceAdapter(
    private val repository: R2dbc{D}Repository,
    private val databaseClient: DatabaseClient,
    private val dsl: DSLContext,
    private val snowflakeIdGenerator: SnowflakeIdGenerator,
) : {D}Repository {

    override suspend fun save({DOMAIN}: {D}): {D} = TODO("toEntity → repository.save → toDomain")

    override suspend fun findById(id: Long): {D}? = TODO("repository.findById(id)?.let { toDomain(it) }")

    override fun findAll(offset: Int, limit: Int): Flow<{D}> = TODO("jOOQ DSL 쿼리 + DatabaseClient 실행")

    override suspend fun count(): Long = TODO("dsl.selectCount().from(...).awaitSingle()")

    override suspend fun deleteById(id: Long) {
        repository.deleteById(id)
    }
}
```

#### 파일 9: `src/test/kotlin/org/raonpark/chessriend/{DOMAIN}/domain/{D}Test.kt`

```kotlin
package org.raonpark.chessriend.{DOMAIN}.domain

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe

class {D}Test : DescribeSpec({

    describe("{D}") {
        it("TODO: 도메인 비즈니스 로직 테스트 추가") {
            // 예: {D}(id = 1L).id shouldBe 1L
        }
    }
})
```

#### 파일 10: `src/main/resources/db/migration/V{NEXT_V}__create_{DOMAIN}s.sql`

```sql
-- TODO: {DOMAIN}s 테이블 정의
-- 컨벤션:
--   id BIGINT PRIMARY KEY (Snowflake ID, sortable)
--   JSONB 컬럼은 NOT NULL DEFAULT '{}'
--   조회 패턴별 인덱스 추가
--
-- 작성 후 실행: ./gradlew flywayMigrate generateJooq

CREATE TABLE {DOMAIN}s (
    id BIGINT PRIMARY KEY
    -- TODO: 컬럼 추가
);

-- TODO: 필요한 인덱스 추가
-- CREATE INDEX idx_{DOMAIN}s_xxx ON {DOMAIN}s (xxx);
```

#### 파일 11: `docs/{DOC_NAME}`

**중요**: `[[ -f "docs/$DOC_NAME" ]]` 체크 후:
- 파일 **존재**: 아래 `## {date}: ...` 섹션부터만 append (헤더 라인 `# {BRANCH}...`는 절대 추가하지 말 것 — 중복 헤더 방지)
- 파일 **미존재**: 아래 전체 템플릿 (헤더 포함) 신규 생성

날짜는 `date +%Y-%m-%d`로 치환.

```markdown
# {BRANCH} — {DOMAIN} 도메인 추가

## {YYYY-MM-DD}: {DOMAIN} 도메인 스캐폴드

### 무엇을
- `{DOMAIN}/` 바운디드 컨텍스트 신규 추가 (헥사고날 6레이어 + Entity + R2dbcRepository + PersistenceAdapter)
- Flyway 마이그레이션 V{NEXT_V}, Kotest 테스트 스켈레톤, 작업내역 문서 생성

### 왜
- TODO: 이 도메인이 왜 필요한지, 기존 도메인에 합치지 않고 분리한 이유

### 변경 파일
| 파일 | 설명 |
|------|------|
| `{DOMAIN}/domain/{D}.kt` | 도메인 엔티티 (TODO: 필드 정의) |
| `{DOMAIN}/port/in/{D}UseCase.kt` | UseCase 인터페이스 (TODO: 시그니처 추가) |
| `{DOMAIN}/port/out/{D}Repository.kt` | Repository 인터페이스 |
| `{DOMAIN}/application/{D}Service.kt` | UseCase 구현 (TODO: 비즈니스 로직) |
| `{DOMAIN}/adapter/in/web/{D}Controller.kt` | REST 엔드포인트 (TODO: DTO 추가) |
| `{DOMAIN}/adapter/out/persistence/{D}Entity.kt` | R2DBC 엔티티 |
| `{DOMAIN}/adapter/out/persistence/R2dbc{D}Repository.kt` | Spring Data 자동 구현 |
| `{DOMAIN}/adapter/out/persistence/{D}PersistenceAdapter.kt` | port out 구현 (TODO: 메서드 본문) |
| `V{NEXT_V}__create_{DOMAIN}s.sql` | Flyway 마이그레이션 (TODO: CREATE TABLE) |

### 의사결정 기록
| 결정 | 선택 | 이유 |
|------|------|------|
| TODO | TODO | TODO |
```

### 4. 사용자에게 출력할 체크리스트

11개 파일 생성 후 다음을 출력:

```
✅ 도메인 '{DOMAIN}' 스캐폴드 완료 (11개 파일)

다음 단계 체크리스트:
- [ ] {DOMAIN}/domain/{D}.kt — 비즈니스 필드/메서드 정의
- [ ] V{NEXT_V}__create_{DOMAIN}s.sql — CREATE TABLE 컬럼 작성
- [ ] ./gradlew flywayMigrate generateJooq 실행
- [ ] {DOMAIN}/adapter/out/persistence/{D}Entity.kt — 컬럼 매핑 추가
- [ ] {DOMAIN}/port/out/{D}Repository.kt — 필요한 시그니처 추가
- [ ] {DOMAIN}/application/{D}Service.kt — 비즈니스 로직 구현
- [ ] {DOMAIN}/adapter/out/persistence/{D}PersistenceAdapter.kt — jOOQ DSL 쿼리 (game/...GamePersistenceAdapter.kt 참조)
- [ ] {DOMAIN}/adapter/in/web/{D}Controller.kt — 엔드포인트 + DTO ({D}Response, {D}Request)
- [ ] shared/exception/에 {D}NotFoundException 등 커스텀 예외 추가
- [ ] {D}Test.kt — Kotest 테스트 작성 + Adapter 통합 테스트 (Testcontainers)
- [ ] application.yml — 도메인 설정 필요 시
- [ ] docs/{DOC_NAME} — What/Why/의사결정 채우기
- [ ] (외부 API 호출 필요 시) {DOMAIN}/adapter/out/client/ 폴더 + 클라이언트 추가 (game/adapter/out/client/LichessClient.kt 패턴)
```

## 의도적으로 안 하는 것

- ❌ `adapter/out/client/` 자동 생성 — 외부 API 필요한 도메인만 별도 추가
- ❌ DTO Request/Response 클래스 — API 시그니처 정해진 후 추가
- ❌ `shared/exception/` 커스텀 예외 추가 — 도메인별로 다름
- ❌ `application.yml` 수정 — 보통 도메인 추가만으론 설정 변경 불필요
- ❌ jOOQ 재생성 자동 실행 — 사용자가 migration SQL 작성 후 수동 실행
- ❌ 비즈니스 필드/메서드 추측 — 도메인 모델은 사람이 정함

## 참조 패턴 (스킬 작성 시 모방한 원본)

- `src/main/kotlin/org/raonpark/chessriend/game/domain/Color.kt` — domain 단순 객체
- `src/main/kotlin/org/raonpark/chessriend/game/port/in/GetGameUseCase.kt` — UseCase 인터페이스
- `src/main/kotlin/org/raonpark/chessriend/game/port/out/GameRepository.kt` — Repository + Flow 패턴
- `src/main/kotlin/org/raonpark/chessriend/game/application/GetGameService.kt` — @Service + KotlinLogging
- `src/main/kotlin/org/raonpark/chessriend/game/adapter/in/web/GameController.kt` — @RestController + suspend fun
- `src/main/kotlin/org/raonpark/chessriend/game/adapter/out/persistence/GameEntity.kt` — Persistable<Long> + isNewEntity
- `src/main/kotlin/org/raonpark/chessriend/game/adapter/out/persistence/R2dbcGameRepository.kt` — CoroutineCrudRepository
- `src/main/kotlin/org/raonpark/chessriend/game/adapter/out/persistence/GamePersistenceAdapter.kt` — jOOQ DSL + DatabaseClient
- `src/test/kotlin/org/raonpark/chessriend/game/domain/ColorTest.kt` — Kotest DescribeSpec
- `src/main/resources/db/migration/V1__create_games_table.sql` — Flyway 헤더
- `docs/feat_game_domain_작업내역.md` — 작업내역 섹션 구조
