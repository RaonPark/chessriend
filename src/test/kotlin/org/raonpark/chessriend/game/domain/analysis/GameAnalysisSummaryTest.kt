package org.raonpark.chessriend.game.domain.analysis

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.domain.MoveEvaluationData

class GameAnalysisSummaryTest : DescribeSpec({

    // 짝수 moveIndex = 백의 수 (평가 하락이 손실), 홀수 = 흑의 수 (평가 상승이 손실)
    fun ev(moveIndex: Int, loss: Int, classification: String? = null) = MoveEvaluationData(
        moveIndex = moveIndex,
        evalBefore = EvalScore(cp = 0),
        evalAfter = EvalScore(cp = if (moveIndex % 2 == 0) -loss else loss),
        cpLoss = loss,
        classification = classification,
    )

    fun analysis(vararg evaluations: MoveEvaluationData) =
        GameAnalysisData(evaluations = evaluations.toList(), depth = 18, analyzedAt = "2026-10-01T00:00:00Z")

    describe("from") {
        it("색별로 분류 개수를 센다") {
            val summary = GameAnalysisSummary.from(
                analysis(ev(0, 10, "mistake"), ev(1, 0), ev(2, 300, "blunder"), ev(3, 120, "mistake"), ev(5, 0, "brilliant")),
            )
            summary.white shouldBe SideAnalysisSummary(brilliant = 0, blunder = 1, mistake = 1, inaccuracy = 0, acpl = 155)
            summary.black.mistake shouldBe 1
            summary.black.brilliant shouldBe 1
            summary.depth shouldBe 18
        }

        it("평균 cp loss는 반올림 (프론트와 같은 규칙)") {
            val summary = GameAnalysisSummary.from(analysis(ev(0, 10), ev(1, 0), ev(2, 21), ev(3, 120)))
            summary.white.acpl shouldBe 16 // 15.5 → 16
            summary.black.acpl shouldBe 60
        }

        it("평가는 ±1000cp로 제한한다 — 메이트를 놓쳐도 평균이 폭주하지 않음") {
            val missedMate = MoveEvaluationData(
                moveIndex = 0,
                evalBefore = EvalScore(mate = 2),
                evalAfter = EvalScore(cp = 0),
                cpLoss = 9998,
                classification = "blunder",
            )
            GameAnalysisSummary.from(analysis(missedMate)).white.acpl shouldBe 1000
        }

        it("메이트 수순을 계속 진행하면 손실 0") {
            val keepMating = MoveEvaluationData(0, EvalScore(mate = 3), EvalScore(mate = 2), 0, null)
            GameAnalysisSummary.from(analysis(keepMating)).white.acpl shouldBe 0
        }

        it("메이트로 끝낸 수(수 직후 mate 0)는 손실 0 — 메이트시킨 쪽 평균이 부풀지 않음") {
            val whiteMates = MoveEvaluationData(0, EvalScore(mate = 1), EvalScore(mate = 0), 19999, "blunder")
            GameAnalysisSummary.from(analysis(whiteMates)).white.acpl shouldBe 0
            val blackMates = MoveEvaluationData(1, EvalScore(mate = -1), EvalScore(mate = 0), 19999, "blunder")
            GameAnalysisSummary.from(analysis(blackMates)).black.acpl shouldBe 0
        }

        it("해당 색의 평가가 없으면 acpl은 null") {
            val summary = GameAnalysisSummary.from(analysis(ev(0, 30)))
            summary.white.acpl shouldBe 30
            summary.black.acpl shouldBe null
        }
    }
})
