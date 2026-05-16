---
paths:
  - "src/**/*.kt"
---

# Kotlin Conventions

## Null Safety

- `requireNotNull()` > `!!` — Why: `!!`는 코드 리뷰에서 무조건 리젝
- `?.let {}` for null-safe chaining > `if (x != null)`
- Elvis operator `?:` for defaults

```kotlin
// ✅
user?.let { save(it) }
requireNotNull(id) { "ID required" }

// ❌
id!!
if (user != null) save(user)  // use ?.let when chaining
```

## Coroutines

- `CancellationException`: if caught, MUST rethrow — Why: 삼키면 코루틴 취소 전파 깨짐
- `ensureActive()` in long-running loops
- Parallel: `coroutineScope { async {} }`, sequential: plain `suspend fun`
- `withContext(Dispatchers.IO)` for blocking calls

```kotlin
// ✅
coroutineScope {
    val a = async { fetchA() }
    val b = async { fetchB() }
    Result(a.await(), b.await())
}

// ❌
GlobalScope.launch { ... }
async { fetchA() }.await()  // just use suspend fun
```

## Logging

- `kotlin-logging` with top-level property — Why: 파일별 로거로 Loki에서 패키지/클래스 단위 필터링 가능
- Lambda style `log.info { "..." }` — Why: 비활성 레벨에서 문자열 조립 비용 생략
- Flow 관측: `onStart`/`onCompletion` for side-effect-free observability

```kotlin
// ✅
private val log = KotlinLogging.logger {}

log.info { "Game imported: source=$source, saved=$count" }
log.error(ex) { "Import failed for $username" }

// ❌
companion object : KLogging()  // legacy pattern
log.info("Imported {} games", count)  // placeholder style
```

## Visibility & Style

- `internal` > `public` by default — Why: 모듈 외부 노출 최소화
- Named arguments when 2+ parameters of same type
- `data object` for singletons needing toString
- `sealed class/interface` for exhaustive `when`, minimize `else` branches
