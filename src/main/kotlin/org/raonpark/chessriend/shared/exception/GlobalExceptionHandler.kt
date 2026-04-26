package org.raonpark.chessriend.shared.exception

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

private val log = KotlinLogging.logger {}

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException::class)
    fun handleNotFound(ex: NotFoundException): ResponseEntity<ErrorResponse> {
        log.debug { "Resource not found: ${ex.message}" }
        return buildResponse(HttpStatus.NOT_FOUND, ex)
    }

    @ExceptionHandler(ConflictException::class)
    fun handleConflict(ex: ConflictException): ResponseEntity<ErrorResponse> {
        log.warn { "Conflict: ${ex.message}" }
        return buildResponse(HttpStatus.CONFLICT, ex)
    }

    @ExceptionHandler(ExternalApiRateLimitException::class)
    fun handleRateLimit(ex: ExternalApiRateLimitException): ResponseEntity<ErrorResponse> {
        log.warn { "External API rate limit: ${ex.message}" }
        return buildResponse(HttpStatus.TOO_MANY_REQUESTS, ex)
    }

    @ExceptionHandler(ExternalApiUserNotFoundException::class)
    fun handleExternalUserNotFound(ex: ExternalApiUserNotFoundException): ResponseEntity<ErrorResponse> {
        log.debug { "External user not found: ${ex.message}" }
        return buildResponse(HttpStatus.NOT_FOUND, ex)
    }

    @ExceptionHandler(ExternalApiException::class)
    fun handleExternalApi(ex: ExternalApiException): ResponseEntity<ErrorResponse> {
        log.error(ex.cause) { "External API error: ${ex.message}" }
        return buildResponse(HttpStatus.BAD_GATEWAY, ex)
    }

    @ExceptionHandler(UnsupportedGameSourceException::class)
    fun handleUnsupportedSource(ex: UnsupportedGameSourceException): ResponseEntity<ErrorResponse> {
        log.debug { "Unsupported game source: ${ex.message}" }
        return buildResponse(HttpStatus.BAD_REQUEST, ex)
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleBadRequest(ex: IllegalArgumentException): ResponseEntity<ErrorResponse> {
        log.debug { "Bad request: ${ex.message}" }
        return buildResponse(HttpStatus.BAD_REQUEST, ex)
    }

    @ExceptionHandler(Exception::class)
    fun handleUnexpected(ex: Exception): ResponseEntity<ErrorResponse> {
        log.error(ex) { "Unexpected error" }
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, ex, "Internal server error")
    }

    private fun buildResponse(
        status: HttpStatus,
        ex: Exception,
        messageOverride: String? = null,
    ): ResponseEntity<ErrorResponse> {
        return ResponseEntity.status(status).body(
            ErrorResponse(
                status = status.value(),
                error = status.reasonPhrase,
                message = messageOverride ?: ex.message ?: "Unknown error",
            )
        )
    }
}
