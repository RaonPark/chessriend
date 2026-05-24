package org.raonpark.chessriend.game.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.GameAnalysisRepository
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.exception.GameNotFoundException
import java.time.Instant
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class SaveGameAnalysisServiceTest : DescribeSpec({

    val gameRepository = mockk<GameRepository>()
    val analysisRepository = mockk<GameAnalysisRepository>()
    val service = SaveGameAnalysisService(gameRepository, analysisRepository)

    fun game(id: Long) = Game(
        id = id,
        source = GameSource.LICHESS,
        sourceGameId = "src-$id",
        ownerUsername = "u",
        players = Players(Player("W", 1500), Player("B", 1500)),
        moves = listOf(Move(1, Color.WHITE, "e4", "fen", 3.seconds, null)),
        result = GameResult.WHITE_WIN,
        timeControl = TimeControl(10.minutes, 0.seconds, TimeCategory.RAPID),
        opening = null,
        pgn = "1. e4 1-0",
        playedAt = Instant.now(),
        importedAt = Instant.now(),
    )

    val analysis = GameAnalysisData(
        evaluations = listOf(
            MoveEvaluationData(0, EvalScore(20, null), EvalScore(15, null), 5, null),
        ),
        depth = 18,
        analyzedAt = "2026-05-24T10:00:00Z",
    )

    describe("saveAnalysis") {
        it("게임이 없으면 GameNotFoundException을 던진다") {
            coEvery { gameRepository.findById(999L) } returns null

            shouldThrow<GameNotFoundException> {
                service.saveAnalysis(999L, analysis)
            }
        }

        it("게임이 있으면 분석을 저장하고 반환한다") {
            coEvery { gameRepository.findById(1L) } returns game(1L)
            coEvery { analysisRepository.save(1L, analysis) } returns analysis

            val result = service.saveAnalysis(1L, analysis)

            result shouldBe analysis
            coVerify(exactly = 1) { analysisRepository.save(1L, analysis) }
        }
    }
})
