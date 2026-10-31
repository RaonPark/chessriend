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

    describe("fromPgnTag (PGN TimeControl 태그 해석)") {
        fun tc(raw: String?, event: String? = null) = TimeControl.fromPgnTag(raw, event)

        it("기본+증분 (600+5) → 시간으로 분류") {
            val t = tc("600+5")
            t.initialTime shouldBe 10.minutes
            t.increment shouldBe 5.seconds
            t.category shouldBe TimeCategory.RAPID
        }

        it("증분 없는 기본 시간 (180) → 블리츠") {
            val t = tc("180")
            t.initialTime shouldBe 3.minutes
            t.increment shouldBe 0.seconds
            t.category shouldBe TimeCategory.BLITZ
        }

        it("구간제 (40/7200:3600) → 첫 구간 기준 클래시컬") {
            tc("40/7200:3600").category shouldBe TimeCategory.CLASSICAL
        }

        it("한 수당 하루 이상 (1/259200) → 일일 체스") {
            tc("1/259200").category shouldBe TimeCategory.CORRESPONDENCE
        }

        it("모래시계 (*60) → 기본 60초로 분류") {
            tc("*60").category shouldBe TimeCategory.BULLET
        }

        it("Event에 Daily/Correspondence가 있으면 일일 체스 (TimeControl이 없어도)") {
            tc(null, "Let's Play! - Daily").category shouldBe TimeCategory.CORRESPONDENCE
            tc("-", "Casual correspondence game").category shouldBe TimeCategory.CORRESPONDENCE
        }

        it("시간 정보 없음(-, ?, 빈 값, 해석 불가) → 기타") {
            for (raw in listOf(null, "", "-", "?", "abc")) {
                val t = tc(raw)
                t.category shouldBe TimeCategory.OTHER
                t.initialTime shouldBe 0.seconds
            }
        }
    }
})
