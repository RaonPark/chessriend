package org.raonpark.chessriend.game.adapter.out.client

import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import kotlinx.coroutines.flow.toList
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import kotlin.time.Duration.Companion.seconds

class LichessClientTest : DescribeSpec({

    val objectMapper: ObjectMapper = jacksonObjectMapper()
    lateinit var mockServer: MockWebServer
    lateinit var client: LichessClient

    beforeEach {
        mockServer = MockWebServer()
        mockServer.start()
        val config = LichessConfig(
            baseUrl = mockServer.url("/").toString().trimEnd('/'),
            token = "",
        )
        client = LichessClient(config, objectMapper)
    }

    afterEach {
        mockServer.close()
    }

    val sampleNdjsonLine = """{"id":"abc12345","rated":true,"variant":"standard","speed":"blitz","status":"mate","winner":"white","createdAt":1712700000000,"players":{"white":{"user":{"name":"Magnus","id":"magnus"},"rating":2850},"black":{"user":{"name":"Hikaru","id":"hikaru"},"rating":2800}},"clock":{"initial":300,"increment":0,"totalTime":300},"moves":"e4 e5 Nf3 Nc6 Bb5","clocks":[30000,30000,29500,29800,29000,29500],"opening":{"eco":"C65","name":"Ruy Lopez: Berlin Defense"},"pgn":"1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0"}"""

    describe("fetchGames") {
        it("NDJSON 스트리밍 응답을 Game 도메인으로 변환한다") {
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/x-ndjson")
                    .body("$sampleNdjsonLine\n")
                    .build()
            )

            val games = client.fetchGames(GameFetchCriteria(username = "magnus")).toList()

            games.size shouldBe 1
            val game = games[0]
            game.sourceGameId shouldBe "abc12345"
            game.source shouldBe GameSource.LICHESS
            game.players.white.name shouldBe "Magnus"
            game.players.white.rating shouldBe 2850
            game.players.black.name shouldBe "Hikaru"
            game.players.black.rating shouldBe 2800
            game.result shouldBe GameResult.WHITE_WIN
            game.timeControl.initialTime shouldBe 300.seconds
            game.timeControl.increment shouldBe 0.seconds
            game.timeControl.category shouldBe TimeCategory.BLITZ
            game.opening shouldNotBe null
            game.opening?.eco shouldBe "C65"
            game.opening?.name shouldBe "Ruy Lopez: Berlin Defense"
            game.moves.size shouldBe 5
            game.moves[0].san shouldBe "e4"
            game.moves[0].color shouldBe Color.WHITE
            game.moves[0].number shouldBe 1
            game.pgn shouldBe "1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0"
        }

        it("여러 게임의 NDJSON을 스트리밍으로 처리한다") {
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/x-ndjson")
                    .body("$sampleNdjsonLine\n$sampleNdjsonLine\n")
                    .build()
            )

            val games = client.fetchGames(GameFetchCriteria(username = "magnus")).toList()
            games.size shouldBe 2
        }

        it("쿼리 파라미터가 올바르게 전달된다") {
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/x-ndjson")
                    .body("\n")
                    .build()
            )

            val criteria = GameFetchCriteria(
                username = "magnus",
                max = 10,
                rated = true,
                timeCategory = TimeCategory.BLITZ,
                color = Color.WHITE,
            )
            client.fetchGames(criteria).toList()

            val request = mockServer.takeRequest()
            val url = request.url
            val query = url?.query ?: ""

            url?.encodedPath shouldBe "/api/games/user/magnus"
            query.contains("max=10") shouldBe true
            query.contains("rated=true") shouldBe true
            query.contains("perfType=blitz") shouldBe true
            query.contains("color=white") shouldBe true
            query.contains("moves=true") shouldBe true
            query.contains("clocks=true") shouldBe true
            query.contains("opening=true") shouldBe true
        }

        it("토큰이 설정되면 Authorization 헤더를 포함한다") {
            mockServer.close()
            mockServer = MockWebServer()
            mockServer.start()

            val configWithToken = LichessConfig(
                baseUrl = mockServer.url("/").toString().trimEnd('/'),
                token = "lip_test_token_123",
            )
            val clientWithToken = LichessClient(configWithToken, objectMapper)

            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/x-ndjson")
                    .body("\n")
                    .build()
            )

            clientWithToken.fetchGames(GameFetchCriteria(username = "test")).toList()

            val request = mockServer.takeRequest()
            request.headers["Authorization"] shouldBe "Bearer lip_test_token_123"
        }
    }

    describe("parseResult") {
        it("draw 상태는 DRAW") {
            val drawJson = """{"id":"draw123","rated":true,"variant":"standard","speed":"blitz","status":"draw","createdAt":1712700000000,"players":{"white":{"user":{"name":"A","id":"a"},"rating":1500},"black":{"user":{"name":"B","id":"b"},"rating":1500}},"clock":{"initial":300,"increment":0,"totalTime":300},"moves":"e4 e5","clocks":[30000,30000,29500],"pgn":"1. e4 e5 1/2-1/2"}"""
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/x-ndjson")
                    .body("$drawJson\n")
                    .build()
            )

            val games = client.fetchGames(GameFetchCriteria(username = "test")).toList()
            games[0].result shouldBe GameResult.DRAW
        }
    }
})
