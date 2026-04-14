package org.raonpark.chessriend.game.port.out

import kotlinx.coroutines.flow.Flow
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameAnnotation
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.domain.TimeCategory

interface GameRepository {
    suspend fun save(game: Game): Game
    suspend fun existsBySourceGameId(sourceGameId: String): Boolean
    suspend fun findById(id: Long): Game?
    fun findAll(offset: Int, limit: Int, source: GameSource?, timeCategory: TimeCategory?): Flow<Game>
    suspend fun count(source: GameSource?, timeCategory: TimeCategory?): Long
    suspend fun deleteById(id: Long)
    suspend fun deleteByIds(ids: List<Long>)
    suspend fun deleteAll()
    suspend fun updateAnnotations(id: Long, annotations: GameAnnotation)
}
