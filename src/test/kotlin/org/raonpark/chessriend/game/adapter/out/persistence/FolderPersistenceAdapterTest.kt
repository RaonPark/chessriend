package org.raonpark.chessriend.game.adapter.out.persistence

import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.shared.exception.DuplicateFolderNameException
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.postgresql.PostgreSQLContainer
import java.time.Instant
import java.util.UUID
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

@SpringBootTest
@ActiveProfiles("test")
class FolderPersistenceAdapterTest {

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
    lateinit var folders: FolderPersistenceAdapter

    @Autowired
    lateinit var games: GamePersistenceAdapter

    // DB 공유 → 테스트마다 고유 이름/ID 사용
    private val tag = UUID.randomUUID().toString().take(6)

    private suspend fun newGame(suffix: String): Game = games.save(
        Game(
            id = null,
            source = GameSource.LICHESS,
            sourceGameId = "fd-$tag-$suffix",
            ownerUsername = "alice",
            players = Players(Player("alice", 1500), Player("bob", 1500)),
            moves = listOf(Move(1, Color.WHITE, "e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", 1.seconds, null)),
            result = GameResult.WHITE_WIN,
            timeControl = TimeControl(10.minutes, 0.seconds, TimeCategory.RAPID),
            opening = null,
            pgn = "1. e4 1-0",
            playedAt = Instant.parse("2026-10-01T00:00:00Z"),
            importedAt = Instant.now(),
        ),
    )

    @Test
    fun `폴더를 만들고 ID로 조회한다`() = runTest {
        val created = folders.insert(Folder.named("연구 $tag"))
        assertNotNull(created.id)
        assertEquals(created, folders.findById(created.id!!))
    }

    @Test
    fun `이름 중복 여부 (자기 자신은 제외 가능)`() = runTest {
        val f = folders.insert(Folder.named("중복 $tag"))
        assertTrue(folders.existsByName("중복 $tag", null))
        assertFalse(folders.existsByName("중복 $tag", f.id))
        assertFalse(folders.existsByName("없는 $tag", null))
    }

    @Test
    fun `DB 유니크 제약 위반은 DuplicateFolderNameException으로 바뀐다`() = runTest {
        folders.insert(Folder.named("동시 $tag"))
        assertThrows<DuplicateFolderNameException> { folders.insert(Folder.named("동시 $tag")) }
    }

    @Test
    fun `게임 넣기는 중복·없는 게임을 무시하고, 폴더별 게임 수를 센다`() = runTest {
        val f = folders.insert(Folder.named("수 $tag"))
        val g1 = newGame("1")
        val g2 = newGame("2")

        folders.addGames(f.id!!, listOf(g1.id!!, g2.id!!, 999_999_999L))
        folders.addGames(f.id!!, listOf(g1.id!!)) // 이미 있는 게임

        val summary = folders.findAllWithCounts().single { it.folder.id == f.id }
        assertEquals(2L, summary.gameCount)

        folders.removeGames(f.id!!, listOf(g1.id!!))
        assertEquals(1L, folders.findAllWithCounts().single { it.folder.id == f.id }.gameCount)
    }

    @Test
    fun `게임별 소속 폴더를 한 번에 조회한다 (여러 폴더에 속할 수 있음)`() = runTest {
        val a = folders.insert(Folder.named("A $tag"))
        val b = folders.insert(Folder.named("B $tag"))
        val g = newGame("multi")
        val other = newGame("none")
        folders.addGames(a.id!!, listOf(g.id!!))
        folders.addGames(b.id!!, listOf(g.id!!))

        val result = folders.findFoldersByGameIds(listOf(g.id!!, other.id!!))

        assertEquals(setOf("A $tag", "B $tag"), result.getValue(g.id!!).map { it.name }.toSet())
        assertNull(result[other.id!!])
    }

    @Test
    fun `이름을 바꾸고, 삭제하면 게임은 남고 연결만 사라진다`() = runTest {
        val f = folders.insert(Folder.named("삭제 $tag"))
        val g = newGame("keep")
        folders.addGames(f.id!!, listOf(g.id!!))

        folders.rename(f.id!!, "바뀐 $tag")
        assertEquals("바뀐 $tag", folders.findById(f.id!!)?.name)

        folders.delete(f.id!!)
        assertNull(folders.findById(f.id!!))
        assertNotNull(games.findById(g.id!!))
        assertNull(folders.findFoldersByGameIds(listOf(g.id!!))[g.id!!])
    }

    @Test
    fun `게임 목록을 폴더로 거른다`() = runTest {
        val f = folders.insert(Folder.named("필터 $tag"))
        val inFolder = newGame("in")
        newGame("out")
        folders.addGames(f.id!!, listOf(inFolder.id!!))

        val criteria = GameSearchCriteria(folderId = f.id)
        assertEquals(listOf(inFolder.id), games.findAll(0, 100, criteria).toList().map { it.id })
        assertEquals(1L, games.count(criteria))
    }
}
