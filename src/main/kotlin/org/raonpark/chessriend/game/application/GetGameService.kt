package org.raonpark.chessriend.game.application

import kotlinx.coroutines.flow.toList
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.domain.TimeCategory
import org.raonpark.chessriend.game.port.`in`.GetGameUseCase
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.domain.PagedResult
import org.raonpark.chessriend.shared.exception.GameNotFoundException
import org.springframework.stereotype.Service

@Service
class GetGameService(
    private val gameRepository: GameRepository,
) : GetGameUseCase {

    override suspend fun getGame(id: Long): Game =
        gameRepository.findById(id) ?: throw GameNotFoundException(id)

    override suspend fun deleteGame(id: Long) {
        gameRepository.findById(id) ?: throw GameNotFoundException(id)
        gameRepository.deleteById(id)
    }

    override suspend fun getGames(
        page: Int,
        size: Int,
        source: GameSource?,
        timeCategory: TimeCategory?,
    ): PagedResult<Game> {
        val offset = page * size
        val content = gameRepository.findAll(offset, size, source, timeCategory).toList()
        val totalElements = gameRepository.count(source, timeCategory)
        val totalPages = if (totalElements == 0L) 0 else ((totalElements + size - 1) / size).toInt()

        return PagedResult(
            content = content,
            page = page,
            size = size,
            totalElements = totalElements,
            totalPages = totalPages,
        )
    }
}
