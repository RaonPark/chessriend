package org.raonpark.chessriend.game.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.mockk
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.domain.MoveEvaluationData
import org.raonpark.chessriend.game.port.out.GameAnalysisRepository
import org.raonpark.chessriend.shared.exception.GameAnalysisNotFoundException

class GetGameAnalysisServiceTest : DescribeSpec({

    val analysisRepository = mockk<GameAnalysisRepository>()
    val service = GetGameAnalysisService(analysisRepository)

    val analysis = GameAnalysisData(
        evaluations = listOf(
            MoveEvaluationData(0, EvalScore(20, null), EvalScore(15, null), 5, null),
        ),
        depth = 18,
        analyzedAt = "2026-05-24T10:00:00Z",
    )

    describe("getAnalysis") {
        it("분석이 있으면 반환한다") {
            coEvery { analysisRepository.findByGameId(1L) } returns analysis

            val result = service.getAnalysis(1L)

            result shouldBe analysis
        }

        it("분석이 없으면 GameAnalysisNotFoundException을 던진다") {
            coEvery { analysisRepository.findByGameId(999L) } returns null

            shouldThrow<GameAnalysisNotFoundException> {
                service.getAnalysis(999L)
            }
        }
    }

    describe("findAnalysis") {
        it("분석이 있으면 반환한다") {
            coEvery { analysisRepository.findByGameId(1L) } returns analysis

            service.findAnalysis(1L) shouldBe analysis
        }

        it("분석이 없으면 null을 반환한다 (백워드 호환 경로)") {
            coEvery { analysisRepository.findByGameId(999L) } returns null

            service.findAnalysis(999L) shouldBe null
        }
    }
})
