package org.raonpark.chessriend.game.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.raonpark.chessriend.game.adapter.out.engine.ChessEngineProperties
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.domain.analysis.AnalysisProgress
import org.raonpark.chessriend.game.port.out.ChessEngine
import org.raonpark.chessriend.game.port.out.ChessRules
import org.raonpark.chessriend.game.port.out.GameAnalysisRepository
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.exception.GameNotFoundException
import java.time.Instant
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class RunGameAnalysisServiceTest : DescribeSpec({

    val gameRepository = mockk<GameRepository>()
    val chessEngine = mockk<ChessEngine>()
    val chessRules = mockk<ChessRules>()
    val analysisRepository = mockk<GameAnalysisRepository>()
    val props = ChessEngineProperties(depth = 18)

    val service = RunGameAnalysisService(gameRepository, chessEngine, chessRules, analysisRepository, props)

    fun game(id: Long) = Game(
        id = id,
        source = GameSource.LICHESS,
        sourceGameId = "src-$id",
        ownerUsername = "u",
        players = Players(Player("W", 1500), Player("B", 1500)),
        moves = listOf(
            Move(1, Color.WHITE, "e4", "", null, null),
            Move(1, Color.BLACK, "e5", "", null, null),
        ),
        result = GameResult.DRAW,
        timeControl = TimeControl(10.minutes, 0.seconds, TimeCategory.RAPID),
        opening = null,
        pgn = "1. e4 e5 1/2-1/2",
        playedAt = Instant.now(),
        importedAt = Instant.now(),
    )

    describe("runAnalysis") {
        it("게임이 없으면 GameNotFoundException") {
            coEvery { gameRepository.findById(999L) } returns null

            shouldThrow<GameNotFoundException> {
                service.runAnalysis(999L).toList()
            }
        }

        it("포지션별 진행률을 emit 하고 분석을 저장한 뒤 완료를 emit") {
            val fens = listOf("fen0", "fen1", "fen2")
            coEvery { gameRepository.findById(1L) } returns game(1L)
            every { chessRules.reconstructFens(listOf("e4", "e5")) } returns fens
            coEvery { chessEngine.evaluate("fen0", 18) } returns EvalScore(20, null)
            coEvery { chessEngine.evaluate("fen1", 18) } returns EvalScore(15, null)
            coEvery { chessEngine.evaluate("fen2", 18) } returns EvalScore(25, null)
            every { chessRules.analyzeMove(any(), any()) } returns null
            coEvery { analysisRepository.save(eq(1L), any()) } answers { secondArg() }

            val events = service.runAnalysis(1L).toList()

            // 3 progress + 1 complete
            events.size shouldBe 4
            (events[0] as AnalysisProgress.Progress) shouldBe AnalysisProgress.Progress(1, 3)
            (events[1] as AnalysisProgress.Progress) shouldBe AnalysisProgress.Progress(2, 3)
            (events[2] as AnalysisProgress.Progress) shouldBe AnalysisProgress.Progress(3, 3)

            val completed = events[3].shouldBeInstanceOf<AnalysisProgress.Completed>()
            completed.analysis.depth shouldBe 18
            completed.analysis.evaluations.size shouldBe 2 // 수 2개

            coVerify(exactly = 1) { analysisRepository.save(eq(1L), any()) }
        }
    }
})
