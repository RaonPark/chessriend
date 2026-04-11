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
class GamePersistenceAdapterTest {

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
    lateinit var adapter: GamePersistenceAdapter

    private fun createGame(sourceGameId: String) = Game(
        id = null,
        source = GameSource.LICHESS,
        sourceGameId = sourceGameId,
        players = Players(
            white = Player("Magnus", 2850),
            black = Player("Hikaru", 2800),
        ),
        moves = listOf(
            Move(1, Color.WHITE, "e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", 5.seconds, null),
            Move(1, Color.BLACK, "e5", "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", 3.seconds, null),
            Move(2, Color.WHITE, "Nf3", "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", 4.seconds, null),
            Move(2, Color.BLACK, "Nc6", "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", 2.seconds, null),
            Move(3, Color.WHITE, "Bb5", "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", 6.seconds, "Ruy Lopez"),
        ),
        result = GameResult.WHITE_WIN,
        timeControl = TimeControl(10.minutes, 0.seconds, TimeCategory.RAPID),
        opening = Opening("C65", "Ruy Lopez"),
        pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0",
        playedAt = Instant.parse("2026-04-10T12:00:00Z"),
        importedAt = Instant.now(),
    )

    @Nested
    inner class Save {
        @Test
        fun `게임을 저장하고 Snowflake ID를 할당한다`() = runTest {
            val game = createGame("save-test-1")
            val saved = adapter.save(game)

            assertNotNull(saved.id)
            assertEquals("save-test-1", saved.sourceGameId)
            assertEquals("Magnus", saved.players.white.name)
            assertEquals(2850, saved.players.white.rating)
            assertEquals(GameResult.WHITE_WIN, saved.result)
            assertEquals(TimeCategory.RAPID, saved.timeControl.category)
            assertEquals("Ruy Lopez", saved.opening?.name)
        }

        @Test
        fun `moves가 JSONB로 저장되고 올바르게 복원된다`() = runTest {
            val game = createGame("save-test-2")
            val saved = adapter.save(game)

            assertEquals(5, saved.moves.size)
            assertEquals("e4", saved.moves[0].san)
            assertEquals(Color.WHITE, saved.moves[0].color)
            assertEquals(5.seconds, saved.moves[0].timeSpent)
            assertEquals("Bb5", saved.moves[4].san)
            assertEquals("Ruy Lopez", saved.moves[4].comment)
        }

        @Test
        fun `opening이 없는 게임도 저장된다`() = runTest {
            val game = createGame("save-test-3").copy(opening = null)
            val saved = adapter.save(game)

            assertNull(saved.opening)
        }
    }

    @Nested
    inner class ExistsBySourceGameId {
        @Test
        fun `존재하는 게임은 true`() = runTest {
            adapter.save(createGame("exists-test-1"))
            assertTrue(adapter.existsBySourceGameId("exists-test-1"))
        }

        @Test
        fun `존재하지 않는 게임은 false`() = runTest {
            assertFalse(adapter.existsBySourceGameId("nonexistent"))
        }
    }
}
