package org.raonpark.chessriend.shared.exception

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import org.springframework.http.HttpStatus

class GlobalExceptionHandlerTest : DescribeSpec({

    val handler = GlobalExceptionHandler()

    describe("handleNotFound") {
        it("NotFoundException → 404") {
            val response = handler.handleNotFound(GameNotFoundException(123L))
            response.statusCode shouldBe HttpStatus.NOT_FOUND
            response.body!!.status shouldBe 404
            response.body!!.error shouldBe "Not Found"
            response.body!!.message shouldBe "Game not found: 123"
        }
    }

    describe("handleConflict") {
        it("ConflictException → 409") {
            val response = handler.handleConflict(ConflictException("conflict occurred"))
            response.statusCode shouldBe HttpStatus.CONFLICT
            response.body!!.status shouldBe 409
        }
    }

    describe("handleRateLimit") {
        it("ExternalApiRateLimitException → 429") {
            val response = handler.handleRateLimit(ExternalApiRateLimitException("lichess", 60))
            response.statusCode shouldBe HttpStatus.TOO_MANY_REQUESTS
            response.body!!.status shouldBe 429
            response.body!!.message shouldBe "lichess API rate limit exceeded. Retry after 60s"
        }

        it("retryAfter 없이도 동작한다") {
            val response = handler.handleRateLimit(ExternalApiRateLimitException("lichess"))
            response.body!!.message shouldBe "lichess API rate limit exceeded"
        }
    }

    describe("handleExternalUserNotFound") {
        it("ExternalApiUserNotFoundException → 404") {
            val response = handler.handleExternalUserNotFound(
                ExternalApiUserNotFoundException("lichess", "nonexistent")
            )
            response.statusCode shouldBe HttpStatus.NOT_FOUND
            response.body!!.status shouldBe 404
            response.body!!.message shouldBe "User 'nonexistent' not found on lichess"
        }
    }

    describe("handleExternalApi") {
        it("ExternalApiException → 502") {
            val response = handler.handleExternalApi(ExternalApiException("lichess API error: 503"))
            response.statusCode shouldBe HttpStatus.BAD_GATEWAY
            response.body!!.status shouldBe 502
        }
    }

    describe("handleUnsupportedSource") {
        it("UnsupportedGameSourceException → 400") {
            val response = handler.handleUnsupportedSource(UnsupportedGameSourceException("CHESS_COM"))
            response.statusCode shouldBe HttpStatus.BAD_REQUEST
            response.body!!.status shouldBe 400
            response.body!!.message shouldBe "Unsupported game source: CHESS_COM"
        }
    }

    describe("handleBadRequest") {
        it("IllegalArgumentException → 400") {
            val response = handler.handleBadRequest(IllegalArgumentException("invalid param"))
            response.statusCode shouldBe HttpStatus.BAD_REQUEST
            response.body!!.status shouldBe 400
        }
    }

    describe("handleUnexpected") {
        it("Exception → 500, 메시지 숨김") {
            val response = handler.handleUnexpected(RuntimeException("secret internal error"))
            response.statusCode shouldBe HttpStatus.INTERNAL_SERVER_ERROR
            response.body!!.status shouldBe 500
            response.body!!.message shouldBe "Internal server error"
        }
    }
})
