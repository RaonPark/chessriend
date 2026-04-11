package org.raonpark.chessriend.game.adapter.`in`.web

import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import org.junit.jupiter.api.Test
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.`in`.ImportGameUseCase
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webtestclient.autoconfigure.AutoConfigureWebTestClient
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import org.testcontainers.postgresql.PostgreSQLContainer
import java.time.Instant
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@Import(GameControllerTest.TestConfig::class)
class GameControllerTest {

    companion object {
        val postgres = PostgreSQLContainer("postgres:17").apply { start() }

        @DynamicPropertySource
        @JvmStatic
        fun configureProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.r2dbc.url") {
                "r2dbc:postgresql://${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}"
            }
            registry.add("spring.r2dbc.username") { postgres.username }
            registry.add("spring.r2dbc.password") { postgres.password }
            registry.add("spring.flyway.url") { postgres.jdbcUrl }
            registry.add("spring.flyway.user") { postgres.username }
            registry.add("spring.flyway.password") { postgres.password }
        }
    }

    @Autowired
    lateinit var webTestClient: WebTestClient

    @Test
    fun `lichess 게임을 SSE 스트리밍으로 반환한다`() {
        val response = webTestClient.get()
            .uri("/api/games/import?source=LICHESS&username=testuser&max=1")
            .accept(MediaType.TEXT_EVENT_STREAM)
            .exchange()
            .expectStatus().isOk
            .expectHeader().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM)
            .returnResult(GameResponse::class.java)
            .responseBody
            .blockFirst()

        assert(response != null)
        assert(response!!.id == 1L)
        assert(response.source == "LICHESS")
        assert(response.white.name == "Magnus")
        assert(response.black.name == "Hikaru")
        assert(response.result == "1-0")
        assert(response.totalMoves == 1)
    }

    @TestConfiguration
    class TestConfig {
        @Bean
        @Primary
        fun importGameUseCase(): ImportGameUseCase {
            val mock = mockk<ImportGameUseCase>()
            every { mock.importGames(GameSource.LICHESS, any<GameFetchCriteria>()) } returns flowOf(
                Game(
                    id = 1L,
                    source = GameSource.LICHESS,
                    sourceGameId = "test123",
                    players = Players(Player("Magnus", 2850), Player("Hikaru", 2800)),
                    moves = listOf(
                        Move(1, Color.WHITE, "e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", 3.seconds, null),
                    ),
                    result = GameResult.WHITE_WIN,
                    timeControl = TimeControl(10.minutes, 0.seconds, TimeCategory.RAPID),
                    opening = Opening("C20", "King's Pawn"),
                    pgn = "1. e4 1-0",
                    playedAt = Instant.parse("2026-04-10T12:00:00Z"),
                    importedAt = Instant.parse("2026-04-10T13:00:00Z"),
                )
            )
            return mock
        }
    }
}
