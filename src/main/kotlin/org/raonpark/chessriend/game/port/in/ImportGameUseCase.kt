package org.raonpark.chessriend.game.port.`in`

import kotlinx.coroutines.flow.Flow
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.port.out.GameFetchCriteria

interface ImportGameUseCase {
    fun importGames(source: GameSource, criteria: GameFetchCriteria): Flow<Game>
}
