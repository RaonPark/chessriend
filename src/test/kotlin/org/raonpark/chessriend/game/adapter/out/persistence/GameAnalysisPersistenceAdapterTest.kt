package org.raonpark.chessriend.game.adapter.out.persistence

import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.raonpark.chessriend.game.domain.*
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.postgresql.PostgreSQLContainer
import java.time.Instant
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

@SpringBootTest
@org.springframework.test.context.ActiveProfiles("test")
class GameAnalysisPersistenceAdapterTest {

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
            registry.add("spring.datasource.url") { postgres.jdbcUrl }
            registry.add("spring.datasource.username") { postgres.username }
            registry.add("spring.datasource.password") { postgres.password }
            registry.add("spring.flyway.url") { postgres.jdbcUrl }
            registry.add("spring.flyway.user") { postgres.username }
            registry.add("spring.flyway.password") { postgres.password }
        }
    }

    @Autowired
    lateinit var gameAdapter: GamePersistenceAdapter

    @Autowired
    lateinit var analysisAdapter: GameAnalysisPersistenceAdapter

    private fun createGame(sourceGameId: String) = Game(
        id = null,
        source = GameSource.LICHESS,
        sourceGameId = sourceGameId,
        ownerUsername = "testuser",
        players = Players(
            white = Player("Magnus", 2850),
            black = Player("Hikaru", 2800),
        ),
        moves = listOf(
            Move(1, Color.WHITE, "e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", 5.seconds, null),
        ),
        result = GameResult.WHITE_WIN,
        timeControl = TimeControl(10.minutes, 0.seconds, TimeCategory.RAPID),
        opening = null,
        pgn = "1. e4 1-0",
        playedAt = Instant.parse("2026-04-10T12:00:00Z"),
        importedAt = Instant.now(),
    )

    private fun sampleAnalysis(analyzedAt: String = "2026-05-24T10:00:00Z") = GameAnalysisData(
        evaluations = listOf(
            MoveEvaluationData(
                moveIndex = 0,
                evalBefore = EvalScore(cp = 20, mate = null),
                evalAfter = EvalScore(cp = 15, mate = null),
                cpLoss = 5,
                classification = null,
            ),
            MoveEvaluationData(
                moveIndex = 1,
                evalBefore = EvalScore(cp = 15, mate = null),
                evalAfter = EvalScore(cp = null, mate = 3),
                cpLoss = 0,
                classification = "blunder",
            ),
        ),
        depth = 18,
        analyzedAt = analyzedAt,
    )

    @Nested
    inner class Save {
        @Test
        fun `신규 분석을 저장한다`() = runTest {
            val game = gameAdapter.save(createGame("analysis-test-save-1"))
            val analysis = sampleAnalysis()

            val saved = analysisAdapter.save(game.id!!, analysis)

            assertEquals(analysis.depth, saved.depth)
            assertEquals(analysis.evaluations.size, saved.evaluations.size)
        }

        @Test
        fun `같은 gameId로 두 번 저장하면 upsert로 갱신된다`() = runTest {
            val game = gameAdapter.save(createGame("analysis-test-upsert-1"))

            analysisAdapter.save(game.id!!, sampleAnalysis().copy(depth = 16))
            analysisAdapter.save(game.id!!, sampleAnalysis().copy(depth = 22))

            val found = analysisAdapter.findByGameId(game.id!!)
            assertNotNull(found)
            assertEquals(22, found!!.depth)
        }
    }

    @Nested
    inner class FindByGameId {
        @Test
        fun `gameId로 분석을 조회한다 (JSONB 라운드트립)`() = runTest {
            val game = gameAdapter.save(createGame("analysis-test-find-1"))
            val analysis = sampleAnalysis()
            analysisAdapter.save(game.id!!, analysis)

            val found = analysisAdapter.findByGameId(game.id!!)

            assertNotNull(found)
            assertEquals(18, found!!.depth)
            assertEquals(2, found.evaluations.size)
            assertEquals(0, found.evaluations[0].moveIndex)
            assertEquals(20, found.evaluations[0].evalBefore.cp)
            assertNull(found.evaluations[0].evalBefore.mate)
            assertEquals(5, found.evaluations[0].cpLoss)
            assertNull(found.evaluations[0].classification)
            assertEquals(3, found.evaluations[1].evalAfter.mate)
            assertEquals("blunder", found.evaluations[1].classification)
        }

        @Test
        fun `존재하지 않는 gameId는 null을 반환한다`() = runTest {
            val found = analysisAdapter.findByGameId(999999L)
            assertNull(found)
        }

        @Test
        fun `analyzedAt이 라운드트립된다`() = runTest {
            val game = gameAdapter.save(createGame("analysis-test-time-1"))
            val original = "2026-05-24T10:00:00Z"
            analysisAdapter.save(game.id!!, sampleAnalysis(analyzedAt = original))

            val found = analysisAdapter.findByGameId(game.id!!)
            assertNotNull(found)
            // Instant.parse / toString은 .000Z 추가 등으로 포맷이 미세하게 바뀔 수 있으나 시점은 동일
            assertEquals(Instant.parse(original), Instant.parse(found!!.analyzedAt))
        }
    }

    @Nested
    inner class ExistsByGameId {
        @Test
        fun `존재하면 true`() = runTest {
            val game = gameAdapter.save(createGame("analysis-test-exists-1"))
            analysisAdapter.save(game.id!!, sampleAnalysis())

            assertTrue(analysisAdapter.existsByGameId(game.id!!))
        }

        @Test
        fun `존재하지 않으면 false`() = runTest {
            assertFalse(analysisAdapter.existsByGameId(999999L))
        }
    }

    @Nested
    inner class DeleteByGameId {
        @Test
        fun `gameId로 분석을 삭제한다`() = runTest {
            val game = gameAdapter.save(createGame("analysis-test-delete-1"))
            analysisAdapter.save(game.id!!, sampleAnalysis())

            analysisAdapter.deleteByGameId(game.id!!)

            assertNull(analysisAdapter.findByGameId(game.id!!))
        }
    }

    @Nested
    inner class CascadeDelete {
        @Test
        fun `부모 게임 삭제 시 분석도 cascade 삭제된다`() = runTest {
            val game = gameAdapter.save(createGame("analysis-test-cascade-1"))
            analysisAdapter.save(game.id!!, sampleAnalysis())

            gameAdapter.deleteById(game.id!!)

            assertNull(analysisAdapter.findByGameId(game.id!!))
        }
    }
}
