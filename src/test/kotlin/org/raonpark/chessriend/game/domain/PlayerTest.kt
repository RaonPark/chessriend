package org.raonpark.chessriend.game.domain

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe

class PlayerTest : DescribeSpec({

    val white = Player("Magnus", 2850)
    val black = Player("Hikaru", 2800)
    val players = Players(white, black)

    describe("Players.byColor") {
        it("WHITE로 조회하면 백 플레이어 반환") {
            players.byColor(Color.WHITE) shouldBe white
        }

        it("BLACK으로 조회하면 흑 플레이어 반환") {
            players.byColor(Color.BLACK) shouldBe black
        }
    }
})
