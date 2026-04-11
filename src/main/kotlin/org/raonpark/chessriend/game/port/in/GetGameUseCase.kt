package org.raonpark.chessriend.game.port.`in`

import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.domain.TimeCategory
import org.raonpark.chessriend.shared.domain.PagedResult

interface GetGameUseCase {
    suspend fun getGame(id: Long): Game
    suspend fun getGames(page: Int, size: Int, source: GameSource?, timeCategory: TimeCategory?): PagedResult<Game>
    suspend fun deleteGame(id: Long)
}
