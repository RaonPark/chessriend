package org.raonpark.chessriend.game.adapter.out.engine

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.analysis.PositionEval

private const val WHITE_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
private const val BLACK_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1"

class UciParserMultiPvTest : DescribeSpec({

    describe("parseInfo") {
        it("multipv 번호, 점수(백 관점), pv 첫 수를 추출") {
            val info = UciParser.parseInfo("info depth 12 seldepth 14 multipv 2 score cp 36 nodes 1 pv d2d4 g8f6", 1)!!
            info.multipv shouldBe 2
            info.score shouldBe EvalScore(cp = 36, mate = null)
            info.move shouldBe "d2d4"
        }

        it("multipv 가 없으면 1번 라인으로 본다") {
            UciParser.parseInfo("info depth 10 score cp 20 pv e2e4", 1)!!.multipv shouldBe 1
        }

        it("흑 차례면 부호를 뒤집는다") {
            UciParser.parseInfo("info depth 10 multipv 1 score cp 50 pv e7e5", -1)!!.score shouldBe EvalScore(cp = -50, mate = null)
        }

        it("score 가 없는 라인은 null") {
            UciParser.parseInfo("info depth 1 multipv 1 nodes 20", 1).shouldBeNull()
            UciParser.parseInfo("bestmove e2e4", 1).shouldBeNull()
        }

        it("pv 가 없으면 move 는 null") {
            UciParser.parseInfo("info depth 10 multipv 1 score cp 20", 1)!!.move.shouldBeNull()
        }
    }

    describe("extractPositionEval") {
        it("라인별 마지막 점수를 1·2순위로 반환하고 최선수는 1순위 pv 첫 수") {
            val lines = listOf(
                "info depth 11 multipv 1 score cp 30 pv e2e4 e7e5",
                "info depth 11 multipv 2 score cp 25 pv d2d4 d7d5",
                "info depth 12 multipv 1 score cp 43 pv e2e4 e7e6",
                "info depth 12 multipv 2 score cp 36 pv d2d4 g8f6",
                "bestmove e2e4 ponder e7e6",
            )
            UciParser.extractPositionEval(lines, WHITE_FEN) shouldBe
                PositionEval(best = EvalScore(cp = 43), secondBest = EvalScore(cp = 36), bestMove = "e2e4")
        }

        it("흑 차례면 두 점수 모두 백 관점으로 반전") {
            val lines = listOf(
                "info depth 12 multipv 1 score cp 40 pv e7e5",
                "info depth 12 multipv 2 score cp -200 pv a7a5",
                "bestmove e7e5",
            )
            UciParser.extractPositionEval(lines, BLACK_FEN) shouldBe
                PositionEval(best = EvalScore(cp = -40), secondBest = EvalScore(cp = 200), bestMove = "e7e5")
        }

        it("라인이 하나뿐(강제 수)이면 secondBest 는 null") {
            val lines = listOf("info depth 12 multipv 1 score cp 10 pv e1f1", "bestmove e1f1")
            UciParser.extractPositionEval(lines, WHITE_FEN) shouldBe
                PositionEval(best = EvalScore(cp = 10), secondBest = null, bestMove = "e1f1")
        }

        it("bestmove 이후 라인은 무시") {
            val lines = listOf(
                "info depth 12 multipv 1 score cp 43 pv e2e4",
                "bestmove e2e4",
                "info depth 99 multipv 2 score cp 999 pv d2d4",
            )
            UciParser.extractPositionEval(lines, WHITE_FEN)!!.secondBest.shouldBeNull()
        }

        it("1순위 점수가 없으면 null") {
            UciParser.extractPositionEval(listOf("bestmove e2e4"), WHITE_FEN).shouldBeNull()
        }
    }
})
