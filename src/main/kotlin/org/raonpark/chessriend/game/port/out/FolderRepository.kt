package org.raonpark.chessriend.game.port.out

import org.raonpark.chessriend.game.domain.Folder
import org.raonpark.chessriend.game.domain.FolderSummary

interface FolderRepository {
    /** 이름 유니크 제약 위반 시 DuplicateFolderNameException */
    suspend fun insert(folder: Folder): Folder
    suspend fun findById(id: Long): Folder?
    /** [excludeId] 폴더는 제외하고 같은 이름이 있는지 (이름 변경 시 자기 자신 제외) */
    suspend fun existsByName(name: String, excludeId: Long?): Boolean
    /** 생성 순 */
    suspend fun findAllWithCounts(): List<FolderSummary>
    suspend fun rename(id: Long, name: String)
    /** 폴더만 삭제 (게임은 남고 연결만 삭제) */
    suspend fun delete(id: Long)
    /** 이미 들어 있거나 존재하지 않는 게임은 무시 */
    suspend fun addGames(folderId: Long, gameIds: List<Long>)
    suspend fun removeGames(folderId: Long, gameIds: List<Long>)
    /** 게임 ID → 소속 폴더들 (폴더가 없는 게임은 결과에서 빠짐) */
    suspend fun findFoldersByGameIds(gameIds: List<Long>): Map<Long, List<Folder>>
}
