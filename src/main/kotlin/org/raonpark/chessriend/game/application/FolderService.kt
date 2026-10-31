package org.raonpark.chessriend.game.application

import io.github.oshai.kotlinlogging.KotlinLogging
import org.raonpark.chessriend.game.domain.Folder
import org.raonpark.chessriend.game.domain.FolderSummary
import org.raonpark.chessriend.game.port.`in`.ManageFolderUseCase
import org.raonpark.chessriend.game.port.out.FolderRepository
import org.raonpark.chessriend.shared.exception.DuplicateFolderNameException
import org.raonpark.chessriend.shared.exception.FolderNotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

@Service
class FolderService(
    private val folderRepository: FolderRepository,
) : ManageFolderUseCase {

    override suspend fun getFolders(): List<FolderSummary> = folderRepository.findAllWithCounts()

    @Transactional
    override suspend fun createFolder(name: String, gameIds: List<Long>): Folder {
        val folder = Folder.named(name)
        if (folderRepository.existsByName(folder.name, null)) throw DuplicateFolderNameException(folder.name)
        val created = folderRepository.insert(folder)
        if (gameIds.isNotEmpty()) folderRepository.addGames(created.id!!, gameIds)
        log.info { "folder created: id=${created.id}, games=${gameIds.size}" }
        return created
    }

    @Transactional
    override suspend fun renameFolder(id: Long, name: String): Folder {
        val current = requireFolder(id)
        val renamed = current.copy(name = Folder.named(name).name)
        if (folderRepository.existsByName(renamed.name, id)) throw DuplicateFolderNameException(renamed.name)
        folderRepository.rename(id, renamed.name)
        return renamed
    }

    @Transactional
    override suspend fun deleteFolder(id: Long) {
        requireFolder(id)
        folderRepository.delete(id)
        log.info { "folder deleted: id=$id" }
    }

    override suspend fun addGames(folderId: Long, gameIds: List<Long>) {
        requireFolder(folderId)
        folderRepository.addGames(folderId, gameIds)
    }

    override suspend fun removeGames(folderId: Long, gameIds: List<Long>) {
        requireFolder(folderId)
        folderRepository.removeGames(folderId, gameIds)
    }

    override suspend fun findFoldersOfGames(gameIds: List<Long>): Map<Long, List<Folder>> {
        if (gameIds.isEmpty()) return emptyMap()
        return folderRepository.findFoldersByGameIds(gameIds)
    }

    private suspend fun requireFolder(id: Long): Folder =
        folderRepository.findById(id) ?: throw FolderNotFoundException(id)
}
