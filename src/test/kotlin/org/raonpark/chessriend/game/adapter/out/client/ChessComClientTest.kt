package org.raonpark.chessriend.game.adapter.out.client

import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.jacksonObjectMapper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.flow.toList
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.raonpark.chessriend.shared.exception.ExternalApiRateLimitException
import org.raonpark.chessriend.shared.exception.ExternalApiUserNotFoundException

class ChessComClientTest : DescribeSpec({

    val objectMapper: ObjectMapper = jacksonObjectMapper()
    lateinit var mockServer: MockWebServer
    lateinit var client: ChessComClient

    beforeEach {
        mockServer = MockWebServer()
        mockServer.start()
        val baseUrl = mockServer.url("/").toString().trimEnd('/')
        val config = ChessComConfig(baseUrl = baseUrl, userAgent = "test")
        client = ChessComClient(config, objectMapper)
    }

    afterEach {
        mockServer.close()
    }

    fun archivesResponse(baseUrl: String, username: String): String = """
        {"archives":["$baseUrl/pub/player/$username/games/2026/03","$baseUrl/pub/player/$username/games/2026/04"]}
    """.trimIndent()

    val sampleGame = """
    {
      "url": "https://www.chess.com/game/live/123456",
      "pgn": "[Event \"Live Chess\"]\n[White \"Magnus\"]\n[Black \"Hikaru\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0",
      "time_control": "180+2",
      "end_time": 1712700000,
      "rated": true,
      "uuid": "chesscom-game-001",
      "initial_setup": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      "fen": "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      "time_class": "blitz",
      "rules": "chess",
      "eco": "https://www.chess.com/openings/Ruy-Lopez",
      "white": {
        "rating": 2850,
        "result": "win",
        "username": "Magnus"
      },
      "black": {
        "rating": 2800,
        "result": "checkmated",
        "username": "Hikaru"
      }
    }
    """.trimIndent()

    describe("fetchGames") {
        it("아카이브에서 게임을 가져와 도메인으로 변환한다") {
            val baseUrl = mockServer.url("/").toString().trimEnd('/')

            // 1. 아카이브 목록 응답
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/json")
                    .body(archivesResponse(baseUrl, "testuser"))
                    .build()
            )
            // 2. 2026/04 (최신 월부터 조회하므로 먼저 요청됨)
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/json")
                    .body("""{"games":[$sampleGame]}""")
                    .build()
            )
            // 3. 2026/03
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/json")
                    .body("""{"games":[]}""")
                    .build()
            )

            val criteria = GameFetchCriteria(username = "testuser")
            val games = client.fetchGames(criteria).toList()

            games shouldHaveSize 1
            val game = games[0]
            game.source shouldBe GameSource.CHESS_COM
            game.sourceGameId shouldBe "chesscom-game-001"
            game.players.white.name shouldBe "Magnus"
            game.players.white.rating shouldBe 2850
            game.players.black.name shouldBe "Hikaru"
            game.players.black.rating shouldBe 2800
            game.result shouldBe GameResult.WHITE_WIN
            game.timeControl.initialTime.inWholeSeconds shouldBe 180
            game.timeControl.increment.inWholeSeconds shouldBe 2
            game.timeControl.category shouldBe TimeCategory.BLITZ
            game.moves.size shouldBe 5 // e4 e5 Nf3 Nc6 Bb5
            game.moves[0].san shouldBe "e4"
            game.moves[0].color shouldBe Color.WHITE
            game.moves[4].san shouldBe "Bb5"
            game.moves[4].color shouldBe Color.WHITE
        }

        it("max 파라미터로 게임 수를 제한한다") {
            val baseUrl = mockServer.url("/").toString().trimEnd('/')
            val twoGames = """{"games":[$sampleGame, ${sampleGame.replace("chesscom-game-001", "chesscom-game-002")}]}"""

            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/json")
                    .body(archivesResponse(baseUrl, "testuser"))
                    .build()
            )
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/json")
                    .body(twoGames)
                    .build()
            )

            val criteria = GameFetchCriteria(username = "testuser", max = 1)
            val games = client.fetchGames(criteria).toList()

            games shouldHaveSize 1
        }

        it("chess960 게임은 제외한다") {
            val baseUrl = mockServer.url("/").toString().trimEnd('/')
            val chess960Game = sampleGame.replace(""""rules": "chess"""", """"rules": "chess960"""")

            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/json")
                    .body(archivesResponse(baseUrl, "testuser"))
                    .build()
            )
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/json")
                    .body("""{"games":[$chess960Game]}""")
                    .build()
            )
            mockServer.enqueue(
                MockResponse.Builder()
                    .addHeader("Content-Type", "application/json")
                    .body("""{"games":[]}""")
                    .build()
            )

            val criteria = GameFetchCriteria(username = "testuser")
            val games = client.fetchGames(criteria).toList()

            games shouldHaveSize 0
        }
    }

    describe("에러 처리") {
        it("존재하지 않는 사용자는 ExternalApiUserNotFoundException") {
            mockServer.enqueue(
                MockResponse.Builder().code(404).build()
            )

            shouldThrow<ExternalApiUserNotFoundException> {
                client.fetchGames(GameFetchCriteria(username = "nobody")).toList()
            }
        }

        it("Rate limit 초과 시 ExternalApiRateLimitException") {
            mockServer.enqueue(
                MockResponse.Builder().code(429).build()
            )

            shouldThrow<ExternalApiRateLimitException> {
                client.fetchGames(GameFetchCriteria(username = "testuser")).toList()
            }
        }
    }
})
