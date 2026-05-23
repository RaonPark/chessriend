---
paths:
  - "src/**/*.kt"
---

# Spring WebFlux + Coroutines

## Controller

- `suspend fun` returning domain/DTO directly — Why: Spring Boot 4.x 코루틴 네이티브 지원
- `Flow<T>` for streaming (Spring auto-converts to Flux)
- NO `Mono<T>`, `ResponseEntity` wrapping, try/catch in controllers

```kotlin
// ✅
@GetMapping("/{id}")
suspend fun getGame(@PathVariable id: Long): GameDetailResponse =
    GameDetailResponse.from(getGameUseCase.getGame(id))

// ❌
fun getGame(id: Long): Mono<GameDetailResponse>
fun getGame(id: Long): ResponseEntity<GameDetailResponse>
```

## DI

- Constructor injection only, NO `@Autowired` field injection
- Inject Port interfaces, not implementations

## WebClient

- `awaitBody<T>()`, `bodyToFlow<T>()` coroutine extensions
- `.block()` is forbidden

## Exception Handling

- Service: `throw CustomException(...)` — NEVER return `ResponseEntity`
- Controller: NO try/catch. Just return service results.
- `@RestControllerAdvice` + `@ExceptionHandler` for centralized handling
- Custom exceptions in `shared/exception/`

| Exception | HTTP Status |
|-----------|-------------|
| `XxxNotFoundException` | 404 |
| `XxxConflictException` | 409 |
| `IllegalArgumentException` | 400 |
| `Exception` (catch-all) | 500 |

```kotlin
// ❌ NEVER
fun getGame(gameId: String): ResponseEntity<GameResponse> { ... }
throw NoSuchElementException("Game not found")  // use custom exception
```

## DTO Mapping

```kotlin
// Domain → DTO: companion object { fun from() }
data class GameResponse(...) {
    companion object {
        fun from(game: Game): GameResponse = GameResponse(...)
    }
}

// DTO → Domain: fun toDomain()
data class AnnotationRequest(...) {
    fun toDomain(): GameAnnotation = GameAnnotation(...)
}
```

## Jackson

- `objectMapper.readValue(json, T::class.java)` for typed deserialization
- `JsonNode` only for flexible external API responses
- NO manual casting: `as Map<String, Any?>`
