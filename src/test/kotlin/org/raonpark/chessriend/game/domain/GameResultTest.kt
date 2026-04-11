package org.raonpark.chessriend.game.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe

class GameResultTest : DescribeSpec({

    describe("fromPgnResult") {
        it("1-0은 WHITE_WIN") {
            GameResult.fromPgnResult("1-0") shouldBe GameResult.WHITE_WIN
        }

        it("0-1은 BLACK_WIN") {
            GameResult.fromPgnResult("0-1") shouldBe GameResult.BLACK_WIN
        }

        it("1/2-1/2은 DRAW") {
            GameResult.fromPgnResult("1/2-1/2") shouldBe GameResult.DRAW
        }

        it("알 수 없는 결과는 예외") {
            shouldThrow<IllegalArgumentException> {
                GameResult.fromPgnResult("*")
            }
        }
    }

    describe("toPgnResult") {
        it("WHITE_WIN은 1-0") {
            GameResult.WHITE_WIN.toPgnResult() shouldBe "1-0"
        }

        it("BLACK_WIN은 0-1") {
            GameResult.BLACK_WIN.toPgnResult() shouldBe "0-1"
        }

        it("DRAW는 1/2-1/2") {
            GameResult.DRAW.toPgnResult() shouldBe "1/2-1/2"
        }
    }

    describe("fromPgnResult → toPgnResult 왕복 변환") {
        listOf("1-0", "0-1", "1/2-1/2").forEach { pgn ->
            it("$pgn → GameResult → $pgn") {
                GameResult.fromPgnResult(pgn).toPgnResult() shouldBe pgn
            }
        }
    }
})
