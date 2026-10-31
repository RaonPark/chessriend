package org.raonpark.chessriend.game.domain

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe

class FolderTest : DescribeSpec({

    describe("named") {
        it("앞뒤 공백을 제거한다") {
            Folder.named("  시실리안 연구 ").name shouldBe "시실리안 연구"
        }

        it("빈 이름(공백만)은 예외") {
            shouldThrow<IllegalArgumentException> { Folder.named("   ") }
        }

        it("30자까지 허용, 31자는 예외") {
            Folder.named("가".repeat(30)).name.length shouldBe 30
            shouldThrow<IllegalArgumentException> { Folder.named("가".repeat(31)) }
        }
    }
})
