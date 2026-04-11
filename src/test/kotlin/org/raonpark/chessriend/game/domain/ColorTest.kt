package org.raonpark.chessriend.game.domain

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe

class ColorTest : DescribeSpec({

    describe("opposite") {
        it("WHITE의 반대는 BLACK") {
            Color.WHITE.opposite() shouldBe Color.BLACK
        }

        it("BLACK의 반대는 WHITE") {
            Color.BLACK.opposite() shouldBe Color.WHITE
        }
    }
})
