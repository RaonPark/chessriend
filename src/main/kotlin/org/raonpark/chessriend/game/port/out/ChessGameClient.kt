package org.raonpark.chessriend.game.port.out

import kotlinx.coroutines.flow.Flow
import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.TimeCategory
import java.time.Instant

data class GameFetchCriteria(
    val username: String,
    val since: Instant? = null,
    val until: Instant? = null,
    val max: Int? = null,
    val timeCategory: TimeCategory? = null,
    val rated: Boolean? = null,
    val color: Color? = null,
    val vs: String? = null,
)

interface ChessGameClient {
    fun fetchGames(criteria: GameFetchCriteria): Flow<Game>
}
