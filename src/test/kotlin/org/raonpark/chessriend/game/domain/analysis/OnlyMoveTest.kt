package org.raonpark.chessriend.game.domain.analysis

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.Move

class OnlyMoveTest : DescribeSpec({

    describe("MoveClassifier.detectOnlyMove") {
        it("1순위를 두었고, 유리/동등을 유지하며, 2순위부터 불리하고, 차이가 충분하면 유일수") {
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 55.0, secondWin = 30.0) shouldBe true
        }

        it("둔 수가 1순위가 아니면 유일수 아님") {
            MoveClassifier.detectOnlyMove(playedIsBest = false, bestWin = 55.0, secondWin = 30.0) shouldBe false
        }

        it("2순위가 없으면(강제 수) 유일수 아님") {
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 55.0, secondWin = null) shouldBe false
        }

        it("1순위가 이미 불리하면(45% 미만) 유일수 아님") {
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 44.9, secondWin = 5.0) shouldBe false
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 45.0, secondWin = 5.0) shouldBe true
        }

        it("2순위도 여전히 유리/동등(50% 이상)이면 유일수 아님") {
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 90.0, secondWin = 50.0) shouldBe false
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 90.0, secondWin = 49.9) shouldBe true
        }

        it("1·2순위 승률 차이가 20%p 미만이면 유일수 아님") {
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 52.0, secondWin = 48.0) shouldBe false
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 60.0, secondWin = 40.1) shouldBe false
            MoveClassifier.detectOnlyMove(playedIsBest = true, bestWin = 60.0, secondWin = 40.0) shouldBe true
        }
    }

    describe("GameAnalyzer.computeClassifications — 유일수") {
        val whiteMove = Move(1, Color.WHITE, "e4", "", null, null)
        val blackMove = Move(1, Color.BLACK, "e5", "", null, null)
        fun ctx(uci: String) = MoveContext(PieceKind.PAWN, null, false, uci)

        it("백: 1순위를 두고 2순위가 크게 불리하면 only") {
            val result = GameAnalyzer.computeClassifications(
                positionEvals = listOf(EvalScore(cp = 50), EvalScore(cp = 50)),
                moves = listOf(whiteMove),
                contexts = listOf(ctx("e2e4")),
                engineLines = listOf(PositionEval(EvalScore(cp = 50), EvalScore(cp = -300), "e2e4")),
            )
            result[0].classification shouldBe "only"
        }

        it("흑: 백 관점 점수를 둔 쪽 관점으로 바꿔 판정한다") {
            val result = GameAnalyzer.computeClassifications(
                positionEvals = listOf(EvalScore(cp = 0), EvalScore(cp = -50), EvalScore(cp = -50)),
                moves = listOf(whiteMove, blackMove),
                contexts = listOf(null, ctx("e7e5")),
                engineLines = listOf(
                    PositionEval(EvalScore(cp = 0), null, null),
                    // 흑 관점 최선 +50(백 관점 -50), 2순위는 흑에게 -300(백 관점 +300)
                    PositionEval(EvalScore(cp = -50), EvalScore(cp = 300), "e7e5"),
                ),
            )
            result[1].classification shouldBe "only"
        }

        it("흑이 이미 불리한 포지션(백 관점 +400)이면 only 아님") {
            val result = GameAnalyzer.computeClassifications(
                positionEvals = listOf(EvalScore(cp = 0), EvalScore(cp = 400), EvalScore(cp = 400)),
                moves = listOf(whiteMove, blackMove),
                contexts = listOf(null, ctx("e7e5")),
                engineLines = listOf(
                    PositionEval(EvalScore(cp = 0), null, null),
                    PositionEval(EvalScore(cp = 400), EvalScore(cp = 900), "e7e5"),
                ),
            )
            result[1].classification shouldBe null
        }

        it("둔 수가 1순위가 아니면 only 아님") {
            val result = GameAnalyzer.computeClassifications(
                positionEvals = listOf(EvalScore(cp = 50), EvalScore(cp = 45)),
                moves = listOf(whiteMove),
                contexts = listOf(ctx("e2e4")),
                engineLines = listOf(PositionEval(EvalScore(cp = 50), EvalScore(cp = -300), "d2d4")),
            )
            result[0].classification shouldBe null
        }

        it("실수 계열이면 only 로 승격되지 않는다") {
            val result = GameAnalyzer.computeClassifications(
                positionEvals = listOf(EvalScore(cp = 50), EvalScore(cp = -400)),
                moves = listOf(whiteMove),
                contexts = listOf(ctx("e2e4")),
                engineLines = listOf(PositionEval(EvalScore(cp = 50), EvalScore(cp = -300), "e2e4")),
            )
            result[0].classification shouldBe "blunder"
        }

        it("engineLines 를 안 주면 기존처럼 only 없이 분류") {
            val result = GameAnalyzer.computeClassifications(
                positionEvals = listOf(EvalScore(cp = 50), EvalScore(cp = 50)),
                moves = listOf(whiteMove),
                contexts = listOf(ctx("e2e4")),
            )
            result[0].classification shouldBe null
        }
    }
})
