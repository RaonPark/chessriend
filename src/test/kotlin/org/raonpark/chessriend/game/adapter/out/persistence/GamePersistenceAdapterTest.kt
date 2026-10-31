package org.raonpark.chessriend.game.adapter.out.persistence

import kotlinx.coroutines.flow.toList
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
        ownerUsername = "testuser",
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
    inner class FindById {
        @Test
        fun `ID로 게임을 조회한다`() = runTest {
            val saved = adapter.save(createGame("findbyid-test-1"))
            val found = adapter.findById(saved.id!!)

            assertNotNull(found)
            assertEquals(saved.id, found!!.id)
            assertEquals("findbyid-test-1", found.sourceGameId)
            assertEquals("Magnus", found.players.white.name)
            assertEquals(5, found.moves.size)
        }

        @Test
        fun `존재하지 않는 ID는 null을 반환한다`() = runTest {
            val found = adapter.findById(999999L)
            assertNull(found)
        }
    }

    @Nested
    inner class FindAll {
        @Test
        fun `페이지네이션으로 게임 목록을 조회한다`() = runTest {
            adapter.save(createGame("findall-test-1").copy(playedAt = Instant.parse("2026-04-10T10:00:00Z")))
            adapter.save(createGame("findall-test-2").copy(playedAt = Instant.parse("2026-04-10T12:00:00Z")))
            adapter.save(createGame("findall-test-3").copy(playedAt = Instant.parse("2026-04-10T11:00:00Z")))

            val result = adapter.findAll(0, 2, GameSearchCriteria()).toList()

            assertEquals(2, result.size)
            // played_at DESC 정렬 확인
            assertTrue(result[0].playedAt >= result[1].playedAt)
        }

        @Test
        fun `source 필터로 조회한다`() = runTest {
            adapter.save(createGame("findall-source-1"))

            val result = adapter.findAll(0, 100, GameSearchCriteria(source = GameSource.LICHESS)).toList()
            assertTrue(result.isNotEmpty())
            assertTrue(result.all { it.source == GameSource.LICHESS })

            val chessComResult = adapter.findAll(0, 100, GameSearchCriteria(source = GameSource.CHESS_COM)).toList()
            assertTrue(chessComResult.isEmpty())
        }

        @Test
        fun `timeCategory 필터로 조회한다`() = runTest {
            adapter.save(createGame("findall-tc-1"))

            val result = adapter.findAll(0, 100, GameSearchCriteria(timeCategory = TimeCategory.RAPID)).toList()
            assertTrue(result.isNotEmpty())
            assertTrue(result.all { it.timeControl.category == TimeCategory.RAPID })

            val bulletResult = adapter.findAll(0, 100, GameSearchCriteria(timeCategory = TimeCategory.BULLET)).toList()
            assertTrue(bulletResult.isEmpty())
        }

        @Test
        fun `rating이 null인 게임도 목록 조회된다`() = runTest {
            // rating NULL 컬럼을 primitive int 로 디코딩하면 NPE → 박싱 타입으로 조회해야 함
            val saved = adapter.save(
                createGame("findall-null-rating").copy(
                    players = Players(Player("Anon", null), Player("Anon2", null)),
                ),
            )

            val result = adapter.findAll(0, 100, GameSearchCriteria()).toList()

            val found = result.find { it.id == saved.id }
            assertNotNull(found)
            assertNull(found!!.players.white.rating)
            assertNull(found.players.black.rating)
        }
    }

    @Nested
    inner class Count {
        @Test
        fun `전체 개수를 조회한다`() = runTest {
            adapter.save(createGame("count-test-1"))

            val count = adapter.count(GameSearchCriteria())
            assertTrue(count >= 1)
        }

        @Test
        fun `source 필터로 개수를 조회한다`() = runTest {
            adapter.save(createGame("count-source-1"))

            val lichessCount = adapter.count(GameSearchCriteria(source = GameSource.LICHESS))
            assertTrue(lichessCount >= 1)

            val chessComCount = adapter.count(GameSearchCriteria(source = GameSource.CHESS_COM))
            assertEquals(0L, chessComCount)
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

    @Nested
    inner class SearchCriteria {
        // 소유자 alice 기준 게임 4개. DB를 다른 테스트와 공유하므로 테스트마다 고유 접두어로 만들고 그 게임만 비교
        private var prefix = ""

        private suspend fun seed() {
            prefix = "flt-${java.util.UUID.randomUUID().toString().take(8)}-"
            val base = createGame("unused").copy(ownerUsername = "alice")
            adapter.save(base.copy(sourceGameId = "${prefix}1", // 내가 백, 승리, 상대 1600 / 나 1500
                players = Players(Player("alice", 1500), Player("bob", 1600)), result = GameResult.WHITE_WIN))
            adapter.save(base.copy(sourceGameId = "${prefix}2", // 내가 흑, 패배, 상대 1900 / 나 1450
                players = Players(Player("carol", 1900), Player("Alice", 1450)), result = GameResult.WHITE_WIN))
            adapter.save(base.copy(sourceGameId = "${prefix}3", // 내가 백, 무승부, 레이팅 없음
                players = Players(Player("alice", null), Player("dave", null)), result = GameResult.DRAW))
            adapter.save(base.copy(sourceGameId = "${prefix}4", ownerUsername = "", // 소유자 없음
                players = Players(Player("x", 1300), Player("y", 1700)), result = GameResult.BLACK_WIN))
        }

        private suspend fun search(criteria: GameSearchCriteria): List<String> =
            adapter.findAll(0, 1000, criteria).toList().map { it.sourceGameId }.filter { it.startsWith(prefix) }.map { it.removePrefix(prefix) }.sorted()

        private suspend fun countFlt(criteria: GameSearchCriteria): Int = search(criteria).size

        @Test
        fun `결과 필터는 소유자 관점 (대소문자 무시)`() = runTest {
            seed()
            assertEquals(listOf("1"), search(GameSearchCriteria(outcome = OwnerOutcome.WIN)))
            assertEquals(listOf("2"), search(GameSearchCriteria(outcome = OwnerOutcome.LOSS)))
            assertEquals(listOf("3"), search(GameSearchCriteria(outcome = OwnerOutcome.DRAW)))
        }

        @Test
        fun `상대 레이팅 구간 필터 (소유자 없는 게임은 제외)`() = runTest {
            seed()
            assertEquals(listOf("1"), search(GameSearchCriteria(ratingBand = RatingBand.FROM_1500_TO_1799)))
            assertEquals(listOf("2"), search(GameSearchCriteria(ratingBand = RatingBand.FROM_1800_TO_2099)))
            assertEquals(emptyList<String>(), search(GameSearchCriteria(ratingBand = RatingBand.FROM_1200_TO_1499)))
        }

        @Test
        fun `레이팅 없음은 상대 레이팅이 null인 게임 (소유자 없는 게임은 제외)`() = runTest {
            seed()
            assertEquals(listOf("3"), search(GameSearchCriteria(ratingBand = RatingBand.UNRATED)))
        }

        @Test
        fun `조건을 함께 쓰면 AND로 결합되고 count도 같은 조건을 따른다`() = runTest {
            seed()
            val criteria = GameSearchCriteria(outcome = OwnerOutcome.LOSS, ratingBand = RatingBand.FROM_1800_TO_2099)
            assertEquals(listOf("2"), search(criteria))
            assertEquals(adapter.findAll(0, 1000, criteria).toList().size.toLong(), adapter.count(criteria))
            assertEquals(1, countFlt(criteria))
        }
    }

    @Nested
    inner class Openings {
        // DB 공유 → 테스트마다 고유한 오프닝 이름을 써서 그 결과만 비교
        private val tag = java.util.UUID.randomUUID().toString().take(6)
        private fun opening(name: String) = Opening("A00", "$name $tag")

        @Test
        fun `오프닝 이름별 게임 수를 많은 순으로 센다 (오프닝 없는 게임 제외)`() = runTest {
            val base = createGame("unused")
            repeat(3) { adapter.save(base.copy(sourceGameId = "op-$tag-s$it", opening = opening("Sicilian"))) }
            adapter.save(base.copy(sourceGameId = "op-$tag-r", opening = opening("Ruy")))
            adapter.save(base.copy(sourceGameId = "op-$tag-n", opening = null))

            val mine = adapter.countByOpening().filter { it.name.endsWith(tag) }

            assertEquals(listOf(OpeningCount("Sicilian $tag", 3), OpeningCount("Ruy $tag", 1)), mine)
        }

        @Test
        fun `오프닝 이름으로 목록을 거른다`() = runTest {
            val base = createGame("unused")
            adapter.save(base.copy(sourceGameId = "op-$tag-a", opening = opening("Italian")))
            adapter.save(base.copy(sourceGameId = "op-$tag-b", opening = opening("French")))

            val criteria = GameSearchCriteria(opening = "Italian $tag")
            val found = adapter.findAll(0, 100, criteria).toList().map { it.sourceGameId }

            assertEquals(listOf("op-$tag-a"), found)
            assertEquals(1L, adapter.count(criteria))
        }
    }

    @Nested
    inner class Note {
        @Test
        fun `새 게임은 애칭·메모가 없고, 저장한 애칭·메모는 단건·목록 조회에 모두 나온다`() = runTest {
            val saved = adapter.save(createGame("note-${java.util.UUID.randomUUID()}"))
            assertEquals(GameNote.EMPTY, saved.note)

            adapter.updateNote(saved.id!!, GameNote("에버그린", "퀸 희생으로 메이트"))

            assertEquals(GameNote("에버그린", "퀸 희생으로 메이트"), adapter.findById(saved.id!!)?.note)
            val listed = adapter.findAll(0, 1000, GameSearchCriteria()).toList().single { it.id == saved.id }
            assertEquals("에버그린", listed.note.nickname)

            adapter.updateNote(saved.id!!, GameNote.EMPTY)
            assertEquals(GameNote.EMPTY, adapter.findById(saved.id!!)?.note)
        }
    }
}
