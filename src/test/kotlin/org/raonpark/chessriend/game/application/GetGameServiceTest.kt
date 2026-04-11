package org.raonpark.chessriend.game.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.exception.GameNotFoundException
import java.time.Instant
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class GetGameServiceTest : DescribeSpec({

    val gameRepository = mockk<GameRepository>()
    val service = GetGameService(gameRepository)

    fun createGame(id: Long, sourceGameId: String, timeCategory: TimeCategory = TimeCategory.RAPID) = Game(
        id = id,
        source = GameSource.LICHESS,
        sourceGameId = sourceGameId,
        players = Players(Player("White", 1500), Player("Black", 1500)),
        moves = listOf(Move(1, Color.WHITE, "e4", "fen", 3.seconds, null)),
        result = GameResult.WHITE_WIN,
        timeControl = TimeControl(10.minutes, 0.seconds, timeCategory),
        opening = null,
        pgn = "1. e4 1-0",
        playedAt = Instant.now(),
        importedAt = Instant.now(),
    )

    describe("getGame") {
        it("ID로 게임을 조회한다") {
            val game = createGame(1L, "game1")
            coEvery { gameRepository.findById(1L) } returns game

            val result = service.getGame(1L)

            result.id shouldBe 1L
            result.sourceGameId shouldBe "game1"
        }

        it("존재하지 않는 게임은 GameNotFoundException을 던진다") {
            coEvery { gameRepository.findById(999L) } returns null

            shouldThrow<GameNotFoundException> {
                service.getGame(999L)
            }
        }
    }

    describe("getGames") {
        it("페이지네이션으로 게임 목록을 조회한다") {
            val games = listOf(createGame(1L, "g1"), createGame(2L, "g2"))
            coEvery { gameRepository.findAll(0, 20, null, null) } returns flowOf(*games.toTypedArray())
            coEvery { gameRepository.count(null, null) } returns 2L

            val result = service.getGames(0, 20, null, null)

            result.content.size shouldBe 2
            result.page shouldBe 0
            result.size shouldBe 20
            result.totalElements shouldBe 2L
            result.totalPages shouldBe 1
            result.hasNext shouldBe false
            result.hasPrevious shouldBe false
        }

        it("source 필터로 조회한다") {
            val game = createGame(1L, "g1")
            coEvery { gameRepository.findAll(0, 10, GameSource.LICHESS, null) } returns flowOf(game)
            coEvery { gameRepository.count(GameSource.LICHESS, null) } returns 1L

            val result = service.getGames(0, 10, GameSource.LICHESS, null)

            result.content.size shouldBe 1
            result.totalElements shouldBe 1L
        }

        it("두 번째 페이지를 조회한다") {
            val game = createGame(3L, "g3")
            coEvery { gameRepository.findAll(20, 20, null, null) } returns flowOf(game)
            coEvery { gameRepository.count(null, null) } returns 41L

            val result = service.getGames(1, 20, null, null)

            result.content.size shouldBe 1
            result.page shouldBe 1
            result.totalPages shouldBe 3
            result.hasNext shouldBe true
            result.hasPrevious shouldBe true
        }

        it("결과가 없으면 빈 목록을 반환한다") {
            coEvery { gameRepository.findAll(0, 20, null, null) } returns flowOf()
            coEvery { gameRepository.count(null, null) } returns 0L

            val result = service.getGames(0, 20, null, null)

            result.content.size shouldBe 0
            result.totalElements shouldBe 0L
            result.totalPages shouldBe 0
        }
    }
})
