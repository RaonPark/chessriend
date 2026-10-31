package org.raonpark.chessriend.game.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe

class BoardArrowTest : DescribeSpec({

    describe("생성") {
        it("유효한 칸과 hex 색이면 생성") {
            val arrow = BoardArrow(startSquare = "e2", endSquare = "e4", color = "#ffaa00")
            arrow.startSquare shouldBe "e2"
            arrow.endSquare shouldBe "e4"
        }

        it("보드 밖 칸이면 예외") {
            shouldThrow<IllegalArgumentException> { BoardArrow("i1", "e4", "#ffaa00") }
            shouldThrow<IllegalArgumentException> { BoardArrow("e2", "e9", "#ffaa00") }
        }

        it("시작/끝 칸이 같으면 예외") {
            shouldThrow<IllegalArgumentException> { BoardArrow("e2", "e2", "#ffaa00") }
        }

        it("hex 색이 아니면 예외") {
            shouldThrow<IllegalArgumentException> { BoardArrow("e2", "e4", "red") }
            shouldThrow<IllegalArgumentException> { BoardArrow("e2", "e4", "#ffaa00; background:url(x)") }
        }
    }
})
