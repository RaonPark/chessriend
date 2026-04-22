package org.raonpark.chessriend.game.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.ChessGameClient
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.raonpark.chessriend.game.port.out.GameRepository
import java.time.Instant
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class ImportGameServiceTest : DescribeSpec({

    val lichessClient = mockk<ChessGameClient> {
        io.mockk.every { source } returns GameSource.LICHESS
    }
    val gameRepository = mockk<GameRepository>()
    val service = ImportGameService(listOf(lichessClient), gameRepository)

    val criteria = GameFetchCriteria(username = "testuser")

    fun createGame(sourceGameId: String, id: Long? = null) = Game(
        id = id,
        source = GameSource.LICHESS,
        sourceGameId = sourceGameId,
        ownerUsername = "testuser",
        players = Players(Player("White", 1500), Player("Black", 1500)),
        moves = listOf(Move(1, Color.WHITE, "e4", "fen", 3.seconds, null)),
        result = GameResult.WHITE_WIN,
        timeControl = TimeControl(10.minutes, 0.seconds, TimeCategory.RAPID),
        opening = null,
        pgn = "1. e4 1-0",
        playedAt = Instant.now(),
        importedAt = Instant.now(),
    )

    describe("importGames") {
        it("새 게임을 가져와서 저장한다") {
            val game = createGame("game1")
            val savedGame = game.copy(id = 1L)

            io.mockk.every { lichessClient.fetchGames(criteria) } returns flowOf(game)
            coEvery { gameRepository.existsBySourceGameId("game1") } returns false
            coEvery { gameRepository.save(game) } returns savedGame

            val result = service.importGames(GameSource.LICHESS, criteria).toList()

            result.size shouldBe 1
            result[0].id shouldBe 1L
            coVerify(exactly = 1) { gameRepository.save(game) }
        }

        it("이미 존재하는 게임은 skip한다") {
            val game1 = createGame("existing")
            val game2 = createGame("new")
            val savedGame2 = game2.copy(id = 2L)

            io.mockk.every { lichessClient.fetchGames(criteria) } returns flowOf(game1, game2)
            coEvery { gameRepository.existsBySourceGameId("existing") } returns true
            coEvery { gameRepository.existsBySourceGameId("new") } returns false
            coEvery { gameRepository.save(game2) } returns savedGame2

            val result = service.importGames(GameSource.LICHESS, criteria).toList()

            result.size shouldBe 1
            result[0].sourceGameId shouldBe "new"
            coVerify(exactly = 0) { gameRepository.save(match { it.sourceGameId == "existing" }) }
        }

        it("지원하지 않는 source는 UnsupportedGameSourceException을 던진다") {
            shouldThrow<org.raonpark.chessriend.shared.exception.UnsupportedGameSourceException> {
                service.importGames(GameSource.CHESS_COM, criteria).toList()
            }
        }

        it("max는 중복 제거 후 적용된다 (이미 저장된 게임이 카운트를 갉아먹지 않음)") {
            // 클라이언트는 4개 emit: [existing1, new1, existing2, new2]
            // max=2 이면 "새 게임 2개"가 되어야 함 → new1, new2 저장
            val existing1 = createGame("existing-1")
            val new1 = createGame("new-1")
            val existing2 = createGame("existing-2")
            val new2 = createGame("new-2")

            val criteriaMax2 = GameFetchCriteria(username = "testuser", max = 2)
            io.mockk.every { lichessClient.fetchGames(criteriaMax2) } returns
                flowOf(existing1, new1, existing2, new2)
            coEvery { gameRepository.existsBySourceGameId("existing-1") } returns true
            coEvery { gameRepository.existsBySourceGameId("existing-2") } returns true
            coEvery { gameRepository.existsBySourceGameId("new-1") } returns false
            coEvery { gameRepository.existsBySourceGameId("new-2") } returns false
            coEvery { gameRepository.save(new1) } returns new1.copy(id = 1L)
            coEvery { gameRepository.save(new2) } returns new2.copy(id = 2L)

            val result = service.importGames(GameSource.LICHESS, criteriaMax2).toList()

            result.size shouldBe 2
            result[0].sourceGameId shouldBe "new-1"
            result[1].sourceGameId shouldBe "new-2"
        }

        it("max보다 적은 새 게임이 있으면 있는 만큼만 반환한다") {
            val existing = createGame("existing")
            val new1 = createGame("new-1")

            val criteriaMax5 = GameFetchCriteria(username = "testuser", max = 5)
            io.mockk.every { lichessClient.fetchGames(criteriaMax5) } returns flowOf(existing, new1)
            coEvery { gameRepository.existsBySourceGameId("existing") } returns true
            coEvery { gameRepository.existsBySourceGameId("new-1") } returns false
            coEvery { gameRepository.save(new1) } returns new1.copy(id = 1L)

            val result = service.importGames(GameSource.LICHESS, criteriaMax5).toList()

            result.size shouldBe 1
        }

        it("max가 null이면 모든 새 게임을 반환한다") {
            val new1 = createGame("new-1")
            val new2 = createGame("new-2")
            val new3 = createGame("new-3")

            io.mockk.every { lichessClient.fetchGames(criteria) } returns flowOf(new1, new2, new3)
            coEvery { gameRepository.existsBySourceGameId(any()) } returns false
            coEvery { gameRepository.save(any()) } answers {
                val g = firstArg<Game>()
                g.copy(id = g.sourceGameId.last().digitToInt().toLong())
            }

            val result = service.importGames(GameSource.LICHESS, criteria).toList()

            result.size shouldBe 3
        }
    }
})
