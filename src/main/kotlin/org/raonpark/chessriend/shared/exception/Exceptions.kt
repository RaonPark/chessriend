package org.raonpark.chessriend.shared.exception

/**
 * 리소스를 찾을 수 없을 때 (HTTP 404)
 */
open class NotFoundException(message: String) : RuntimeException(message)

class GameNotFoundException(gameId: Long) :
    NotFoundException("Game not found: $gameId")

class GameAnalysisNotFoundException(gameId: Long) :
    NotFoundException("Game analysis not found for game: $gameId")

/**
 * 도메인 불변식 위반 (HTTP 409)
 */
open class ConflictException(message: String) : RuntimeException(message)

/**
 * 외부 API 일반 오류 (HTTP 502)
 */
open class ExternalApiException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

/**
 * 외부 API Rate Limit 초과 (HTTP 429)
 */
class ExternalApiRateLimitException(source: String, retryAfterSeconds: Long? = null) :
    ExternalApiException(
        buildString {
            append("$source API rate limit exceeded")
            if (retryAfterSeconds != null) append(". Retry after ${retryAfterSeconds}s")
        }
    )

/**
 * 외부 API에서 사용자를 찾을 수 없음 (HTTP 404)
 */
class ExternalApiUserNotFoundException(source: String, username: String) :
    ExternalApiException("User '$username' not found on $source")

/**
 * 지원하지 않는 게임 소스 (HTTP 400)
 */
class UnsupportedGameSourceException(source: String) :
    RuntimeException("Unsupported game source: $source")

/**
 * 체스 엔진(Stockfish) 일반 오류
 */
open class EngineException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

/**
 * 엔진을 사용할 수 없음 — 미설치/프로세스 사망 등 (HTTP 503)
 */
class EngineUnavailableException(message: String, cause: Throwable? = null) :
    EngineException(message, cause)

/**
 * 포지션 분석이 제한 시간을 초과 (HTTP 504)
 */
class EngineTimeoutException(message: String) :
    EngineException(message)
