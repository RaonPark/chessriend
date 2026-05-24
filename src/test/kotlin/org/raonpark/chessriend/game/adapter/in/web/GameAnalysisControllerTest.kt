package org.raonpark.chessriend.game.adapter.`in`.web

import io.mockk.coEvery
import io.mockk.mockk
import org.junit.jupiter.api.Test
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.domain.MoveEvaluationData
import org.raonpark.chessriend.game.port.`in`.GetGameAnalysisUseCase
import org.raonpark.chessriend.game.port.`in`.SaveGameAnalysisUseCase
import org.raonpark.chessriend.shared.exception.GameAnalysisNotFoundException
import org.raonpark.chessriend.shared.exception.GameNotFoundException
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webtestclient.autoconfigure.AutoConfigureWebTestClient
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import org.testcontainers.postgresql.PostgreSQLContainer

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@Import(GameAnalysisControllerTest.TestConfig::class)
class GameAnalysisControllerTest {

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
    fun `POST 분석을 저장하고 200을 반환한다`() {
        val body = """
            {
              "depth": 18,
              "analyzedAt": "2026-05-24T10:00:00Z",
              "evaluations": [
                {
                  "moveIndex": 0,
                  "evalBefore": {"cp": 20, "mate": null},
                  "evalAfter": {"cp": 15, "mate": null},
                  "cpLoss": 5,
                  "classification": null
                }
              ]
            }
        """.trimIndent()

        webTestClient.post()
            .uri("/api/games/1/analysis")
            .header("Content-Type", "application/json")
            .bodyValue(body)
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.depth").isEqualTo(18)
            .jsonPath("$.analyzedAt").isEqualTo("2026-05-24T10:00:00Z")
            .jsonPath("$.evaluations[0].moveIndex").isEqualTo(0)
            .jsonPath("$.evaluations[0].cpLoss").isEqualTo(5)
    }

    @Test
    fun `POST 존재하지 않는 게임이면 404를 반환한다`() {
        val body = """
            {"depth":18,"analyzedAt":"2026-05-24T10:00:00Z","evaluations":[]}
        """.trimIndent()

        webTestClient.post()
            .uri("/api/games/999/analysis")
            .header("Content-Type", "application/json")
            .bodyValue(body)
            .exchange()
            .expectStatus().isNotFound
    }

    @Test
    fun `GET 분석을 조회하고 200을 반환한다`() {
        webTestClient.get()
            .uri("/api/games/1/analysis")
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.depth").isEqualTo(18)
            .jsonPath("$.evaluations[1].classification").isEqualTo("blunder")
            .jsonPath("$.evaluations[1].evalAfter.mate").isEqualTo(3)
    }

    @Test
    fun `GET 분석이 없으면 404를 반환한다`() {
        webTestClient.get()
            .uri("/api/games/999/analysis")
            .exchange()
            .expectStatus().isNotFound
    }

    @TestConfiguration
    class TestConfig {
        private val sample = GameAnalysisData(
            evaluations = listOf(
                MoveEvaluationData(0, EvalScore(20, null), EvalScore(15, null), 5, null),
                MoveEvaluationData(1, EvalScore(15, null), EvalScore(null, 3), 0, "blunder"),
            ),
            depth = 18,
            analyzedAt = "2026-05-24T10:00:00Z",
        )

        @Bean
        @Primary
        fun saveGameAnalysisUseCase(): SaveGameAnalysisUseCase = mockk<SaveGameAnalysisUseCase>().apply {
            coEvery { saveAnalysis(eq(1L), any()) } answers { secondArg() }
            coEvery { saveAnalysis(eq(999L), any()) } throws GameNotFoundException(999L)
        }

        @Bean
        @Primary
        fun getGameAnalysisUseCase(): GetGameAnalysisUseCase = mockk<GetGameAnalysisUseCase>().apply {
            coEvery { getAnalysis(1L) } returns sample
            coEvery { getAnalysis(999L) } throws GameAnalysisNotFoundException(999L)
            coEvery { findAnalysis(any()) } returns null
        }
    }
}
