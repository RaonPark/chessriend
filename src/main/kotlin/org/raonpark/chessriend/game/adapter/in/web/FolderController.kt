package org.raonpark.chessriend.game.adapter.`in`.web

import org.raonpark.chessriend.game.port.`in`.ManageFolderUseCase
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

/** LNB "내 폴더": 폴더 생성·이름 변경·삭제, 게임 넣기/빼기 */
@RestController
@RequestMapping("/api/folders")
class FolderController(
    private val manageFolderUseCase: ManageFolderUseCase,
) {

    @GetMapping
    suspend fun getFolders(): List<FolderResponse> =
        manageFolderUseCase.getFolders().map { FolderResponse.from(it) }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    suspend fun createFolder(@RequestBody request: CreateFolderRequest): FolderResponse {
        val folder = manageFolderUseCase.createFolder(request.name, request.gameIds)
        return findResponse(folder.id!!)
    }

    @PatchMapping("/{id}")
    suspend fun renameFolder(@PathVariable id: Long, @RequestBody request: RenameFolderRequest): FolderResponse {
        manageFolderUseCase.renameFolder(id, request.name)
        return findResponse(id)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    suspend fun deleteFolder(@PathVariable id: Long) {
        manageFolderUseCase.deleteFolder(id)
    }

    @PostMapping("/{id}/games")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    suspend fun addGames(@PathVariable id: Long, @RequestBody gameIds: List<Long>) {
        manageFolderUseCase.addGames(id, gameIds)
    }

    @DeleteMapping("/{id}/games")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    suspend fun removeGames(@PathVariable id: Long, @RequestBody gameIds: List<Long>) {
        manageFolderUseCase.removeGames(id, gameIds)
    }

    // 게임 수까지 담아 응답 (넣으려던 게임 중 없는 게임은 무시되므로 실제 수를 다시 조회)
    private suspend fun findResponse(id: Long): FolderResponse =
        FolderResponse.from(manageFolderUseCase.getFolders().first { it.folder.id == id })
}

data class CreateFolderRequest(
    val name: String,
    val gameIds: List<Long> = emptyList(),
)

data class RenameFolderRequest(val name: String)

data class FolderResponse(
    val id: String,
    val name: String,
    val gameCount: Long,
) {
    companion object {
        fun from(summary: org.raonpark.chessriend.game.domain.FolderSummary): FolderResponse =
            FolderResponse(id = summary.folder.id!!.toString(), name = summary.folder.name, gameCount = summary.gameCount)
    }
}
