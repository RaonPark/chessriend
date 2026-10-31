package org.raonpark.chessriend.game.port.`in`

import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameAnnotation
import org.raonpark.chessriend.game.domain.GameSearchCriteria
import org.raonpark.chessriend.shared.domain.PagedResult

interface GetGameUseCase {
    suspend fun getGame(id: Long): Game
    suspend fun getGames(page: Int, size: Int, criteria: GameSearchCriteria): PagedResult<Game>
    suspend fun deleteGame(id: Long)
    suspend fun deleteGames(ids: List<Long>)
    suspend fun deleteAllGames()
    suspend fun updateAnnotations(id: Long, annotations: GameAnnotation)
}
