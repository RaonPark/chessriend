package org.raonpark.chessriend.game.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameResult
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.domain.Move
import org.raonpark.chessriend.game.domain.ParsedPgn
import org.raonpark.chessriend.game.domain.TimeCategory
import org.raonpark.chessriend.game.domain.Variation
import org.raonpark.chessriend.game.port.`in`.CreateGameFromPgnCommand
import org.raonpark.chessriend.game.port.out.ChessRules
import org.raonpark.chessriend.game.port.out.GameRepository

class CreateGameFromPgnServiceTest : DescribeSpec({

    val chessRules = mockk<ChessRules>()
    val gameRepository = mockk<GameRepository>()
    val service = CreateGameFromPgnService(chessRules, gameRepository)

    fun parsed(
        hasSetup: Boolean = false,
        result: String = "1-0",
        timeControl: String? = "600+5",
    ) = ParsedPgn(
        whiteName = "Alice",
        whiteRating = 2600,
        blackName = "Bob",
        blackRating = 2500,
        result = result,
        timeControl = timeControl,
        eco = "C52",
        openingName = "Evans Gambit",
        date = "2024.01.31",
        moves = listOf(
            Move(1, Color.WHITE, "e4", "fen1", null, null),
            Move(1, Color.BLACK, "e5", "fen2", null, null),
        ),
        moveComments = mapOf("0" to "best by test"),
        variations = listOf(Variation(startMoveIndex = 0, moves = listOf("c4"))),
        hasSetup = hasSetup,
    )

    val singleGamePgn = """
        [Event "Casual"]

        1. e4 e5 1-0
    """.trimIndent()

    beforeTest { clearMocks(chessRules, gameRepository) }

    describe("createFromPgn") {
        it("유효한 PGN으로 게임을 생성·저장하고 태그/수/주석을 매핑한다") {
            every { chessRules.parsePgn(any()) } returns parsed()
            coEvery { gameRepository.save(any()) } answers { firstArg<Game>().copy(id = 1L) }

            val result = service.createFromPgn(CreateGameFromPgnCommand(pgn = singleGamePgn))

            result.id shouldBe 1L
            result.source shouldBe GameSource.PGN
            result.players.white.name shouldBe "Alice"
            result.players.black.rating shouldBe 2500
            result.result shouldBe GameResult.WHITE_WIN
            result.timeControl.category shouldBe TimeCategory.RAPID // 600+40*5=800 < 1500
            result.opening?.name shouldBe "Evans Gambit"
            result.moves shouldHaveSize 2
            result.annotations.moveComments["0"] shouldBe "best by test"
            result.annotations.variations shouldHaveSize 1
            coVerify(exactly = 1) { gameRepository.save(any()) }
        }

        it("결과가 '*'이면 무승부로 둔다") {
            every { chessRules.parsePgn(any()) } returns parsed(result = "*")
            coEvery { gameRepository.save(any()) } answers { firstArg<Game>().copy(id = 2L) }

            service.createFromPgn(CreateGameFromPgnCommand(pgn = singleGamePgn)).result shouldBe GameResult.DRAW
        }

        it("[SetUp]/[FEN] PGN(hasSetup)이면 저장하지 않고 예외") {
            every { chessRules.parsePgn(any()) } returns parsed(hasSetup = true)

            shouldThrow<IllegalArgumentException> {
                service.createFromPgn(CreateGameFromPgnCommand(pgn = singleGamePgn))
            }
            coVerify(exactly = 0) { gameRepository.save(any()) }
        }

        it("여러 게임 PGN이면 파싱 전에 예외") {
            val multi = """
                [Event "G1"]

                1. e4 e5 1-0

                [Event "G2"]

                1. d4 d5 0-1
            """.trimIndent()

            shouldThrow<IllegalArgumentException> {
                service.createFromPgn(CreateGameFromPgnCommand(pgn = multi))
            }
            coVerify(exactly = 0) { gameRepository.save(any()) }
        }

        it("빈 PGN이면 예외") {
            shouldThrow<IllegalArgumentException> {
                service.createFromPgn(CreateGameFromPgnCommand(pgn = "   "))
            }
        }
    }
})
