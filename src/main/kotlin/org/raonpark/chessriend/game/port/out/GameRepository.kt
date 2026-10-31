package org.raonpark.chessriend.game.port.out

import kotlinx.coroutines.flow.Flow
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameAnnotation
import org.raonpark.chessriend.game.domain.GameNote
import org.raonpark.chessriend.game.domain.GameSearchCriteria
import org.raonpark.chessriend.game.domain.OpeningCount

interface GameRepository {
    suspend fun save(game: Game): Game
    suspend fun existsBySourceGameId(sourceGameId: String): Boolean
    suspend fun findById(id: Long): Game?
    fun findAll(offset: Int, limit: Int, criteria: GameSearchCriteria): Flow<Game>
    suspend fun count(criteria: GameSearchCriteria): Long
    /** 오프닝 이름별 게임 수, 많은 순 (오프닝 없는 게임 제외) */
    suspend fun countByOpening(): List<OpeningCount>
    suspend fun deleteById(id: Long)
    suspend fun deleteByIds(ids: List<Long>)
    suspend fun deleteAll()
    suspend fun updateAnnotations(id: Long, annotations: GameAnnotation)
    suspend fun updateNote(id: Long, note: GameNote)
}
