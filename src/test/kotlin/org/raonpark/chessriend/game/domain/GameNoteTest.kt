package org.raonpark.chessriend.game.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe

class GameNoteTest : DescribeSpec({

    describe("of") {
        it("앞뒤 공백을 제거하고, 비어 있으면 null") {
            GameNote.of("  역전승 ", "  ") shouldBe GameNote(nickname = "역전승", memo = null)
            GameNote.of(null, null) shouldBe GameNote.EMPTY
        }

        it("애칭은 50자, 메모는 2000자까지") {
            GameNote.of("가".repeat(50), "m".repeat(2000)).nickname!!.length shouldBe 50
            shouldThrow<IllegalArgumentException> { GameNote.of("가".repeat(51), null) }
            shouldThrow<IllegalArgumentException> { GameNote.of(null, "m".repeat(2001)) }
        }
    }
})
