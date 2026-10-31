package org.raonpark.chessriend.game.port.`in`

import org.raonpark.chessriend.game.domain.Folder
import org.raonpark.chessriend.game.domain.FolderSummary

interface ManageFolderUseCase {
    suspend fun getFolders(): List<FolderSummary>
    /** 이름 정리(trim) 후 생성, [gameIds]가 있으면 바로 넣음 */
    suspend fun createFolder(name: String, gameIds: List<Long>): Folder
    suspend fun renameFolder(id: Long, name: String): Folder
    suspend fun deleteFolder(id: Long)
    suspend fun addGames(folderId: Long, gameIds: List<Long>)
    suspend fun removeGames(folderId: Long, gameIds: List<Long>)
    /** 게임 목록의 폴더 태그용 */
    suspend fun findFoldersOfGames(gameIds: List<Long>): Map<Long, List<Folder>>
}
