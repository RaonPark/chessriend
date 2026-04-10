package org.raonpark.chessriend.game.port.out

import org.raonpark.chessriend.game.domain.Game

interface GameRepository {
    suspend fun save(game: Game): Game
    suspend fun existsBySourceGameId(sourceGameId: String): Boolean
}
