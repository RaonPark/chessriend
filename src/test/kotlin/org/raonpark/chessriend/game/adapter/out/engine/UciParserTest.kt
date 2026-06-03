package org.raonpark.chessriend.game.adapter.out.engine

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.EvalScore

private const val WHITE_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
private const val BLACK_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1"

class UciParserTest : DescribeSpec({

    describe("flipFor") {
        it("백 차례면 +1") { UciParser.flipFor(WHITE_FEN) shouldBe 1 }
        it("흑 차례면 -1") { UciParser.flipFor(BLACK_FEN) shouldBe -1 }
    }

    describe("parseScore") {
        it("백 차례 cp 는 그대로") {
            UciParser.parseScore("info depth 18 score cp 34 pv e2e4", 1) shouldBe EvalScore(cp = 34, mate = null)
        }

        it("흑 차례 cp 는 부호 반전(백 관점)") {
            // 흑이 +50(흑 유리)이면 백 관점 -50
            UciParser.parseScore("info depth 18 score cp 50 pv", -1) shouldBe EvalScore(cp = -50, mate = null)
        }

        it("mate 점수도 부호 보정") {
            UciParser.parseScore("info depth 12 score mate 3 pv", 1) shouldBe EvalScore(cp = null, mate = 3)
            UciParser.parseScore("info depth 12 score mate 3 pv", -1) shouldBe EvalScore(cp = null, mate = -3)
        }

        it("음수 cp 도 처리") {
            UciParser.parseScore("info depth 10 score cp -120 pv", 1) shouldBe EvalScore(cp = -120, mate = null)
        }

        it("score 없는 info / 다른 라인은 null") {
            UciParser.parseScore("info depth 1 seldepth 2 nodes 20", 1).shouldBeNull()
            UciParser.parseScore("bestmove e2e4 ponder e7e5", 1).shouldBeNull()
            UciParser.parseScore("readyok", 1).shouldBeNull()
        }
    }

    describe("extractEval") {
        it("bestmove 직전 마지막 score 를 백 관점으로 반환") {
            val lines = listOf(
                "info depth 10 score cp 20 pv",
                "info depth 15 score cp 28 pv",
                "info depth 18 score cp 34 pv",
                "bestmove e2e4",
            )
            UciParser.extractEval(lines, WHITE_FEN) shouldBe EvalScore(cp = 34, mate = null)
        }

        it("흑 차례면 마지막 score 를 반전") {
            val lines = listOf(
                "info depth 17 score cp 40 pv",
                "info depth 18 score cp 60 pv",
                "bestmove d7d5",
            )
            UciParser.extractEval(lines, BLACK_FEN) shouldBe EvalScore(cp = -60, mate = null)
        }

        it("bestmove 이후 라인은 무시") {
            val lines = listOf(
                "info depth 18 score cp 34 pv",
                "bestmove e2e4",
                "info depth 99 score cp 999 pv",
            )
            UciParser.extractEval(lines, WHITE_FEN) shouldBe EvalScore(cp = 34, mate = null)
        }

        it("점수 라인이 없으면 null") {
            UciParser.extractEval(listOf("bestmove e2e4"), WHITE_FEN).shouldBeNull()
        }
    }
})
