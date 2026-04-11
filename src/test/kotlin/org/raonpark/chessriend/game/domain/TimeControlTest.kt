package org.raonpark.chessriend.game.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class TimeControlTest : DescribeSpec({

    describe("fromString") {
        it("600+0을 파싱하면 10분 + 0초 RAPID") {
            val tc = TimeControl.fromString("600+0", TimeCategory.RAPID)
            tc.initialTime shouldBe 10.minutes
            tc.increment shouldBe 0.seconds
            tc.category shouldBe TimeCategory.RAPID
        }

        it("180+2를 파싱하면 3분 + 2초 BLITZ") {
            val tc = TimeControl.fromString("180+2", TimeCategory.BLITZ)
            tc.initialTime shouldBe 3.minutes
            tc.increment shouldBe 2.seconds
            tc.category shouldBe TimeCategory.BLITZ
        }

        it("잘못된 형식은 예외") {
            shouldThrow<IllegalArgumentException> {
                TimeControl.fromString("invalid", TimeCategory.BLITZ)
            }
        }
    }

    describe("toString") {
        it("분+초 단위로 출력") {
            val tc = TimeControl(10.minutes, 5.seconds, TimeCategory.RAPID)
            tc.toString() shouldBe "10+5"
        }
    }
})
