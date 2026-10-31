package org.raonpark.chessriend.game.application

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import org.raonpark.chessriend.game.domain.Folder
import org.raonpark.chessriend.game.port.out.FolderRepository
import org.raonpark.chessriend.shared.exception.DuplicateFolderNameException
import org.raonpark.chessriend.shared.exception.FolderNotFoundException

class FolderServiceTest : DescribeSpec({

    val repository = mockk<FolderRepository>(relaxUnitFun = true)
    val service = FolderService(repository)

    beforeEach { clearMocks(repository) }

    describe("createFolder") {
        it("이름을 정리해서 만들고, 함께 넘긴 게임을 넣는다") {
            coEvery { repository.existsByName("시실리안 연구", null) } returns false
            coEvery { repository.insert(Folder(null, "시실리안 연구")) } returns Folder(10L, "시실리안 연구")

            val created = service.createFolder("  시실리안 연구 ", listOf(1L, 2L))

            created shouldBe Folder(10L, "시실리안 연구")
            coVerify { repository.addGames(10L, listOf(1L, 2L)) }
        }

        it("같은 이름의 폴더가 있으면 DuplicateFolderNameException") {
            coEvery { repository.existsByName("블리츠", null) } returns true
            shouldThrow<DuplicateFolderNameException> { service.createFolder("블리츠", emptyList()) }
        }
    }

    describe("renameFolder") {
        it("없는 폴더면 FolderNotFoundException") {
            coEvery { repository.findById(99L) } returns null
            shouldThrow<FolderNotFoundException> { service.renameFolder(99L, "새 이름") }
        }

        it("다른 폴더가 쓰는 이름이면 DuplicateFolderNameException (자기 자신은 제외하고 검사)") {
            coEvery { repository.findById(1L) } returns Folder(1L, "A")
            coEvery { repository.existsByName("B", 1L) } returns true
            shouldThrow<DuplicateFolderNameException> { service.renameFolder(1L, "B") }
        }

        it("이름을 바꾼다") {
            coEvery { repository.findById(1L) } returns Folder(1L, "A")
            coEvery { repository.existsByName("B", 1L) } returns false

            service.renameFolder(1L, " B ") shouldBe Folder(1L, "B")
            coVerify { repository.rename(1L, "B") }
        }
    }

    describe("deleteFolder / addGames / removeGames") {
        it("없는 폴더면 FolderNotFoundException") {
            coEvery { repository.findById(99L) } returns null
            shouldThrow<FolderNotFoundException> { service.deleteFolder(99L) }
            shouldThrow<FolderNotFoundException> { service.addGames(99L, listOf(1L)) }
            shouldThrow<FolderNotFoundException> { service.removeGames(99L, listOf(1L)) }
        }

        it("폴더가 있으면 위임한다") {
            coEvery { repository.findById(1L) } returns Folder(1L, "A")
            service.addGames(1L, listOf(5L))
            service.removeGames(1L, listOf(6L))
            service.deleteFolder(1L)
            coVerify { repository.addGames(1L, listOf(5L)) }
            coVerify { repository.removeGames(1L, listOf(6L)) }
            coVerify { repository.delete(1L) }
        }
    }

    describe("findFoldersOfGames") {
        it("빈 목록이면 저장소를 조회하지 않는다") {
            service.findFoldersOfGames(emptyList()) shouldBe emptyMap()
        }
    }
})
