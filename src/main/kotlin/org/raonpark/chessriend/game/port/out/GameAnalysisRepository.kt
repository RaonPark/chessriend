package org.raonpark.chessriend.game.port.out

import org.raonpark.chessriend.game.domain.GameAnalysisData

interface GameAnalysisRepository {
    suspend fun save(gameId: Long, analysis: GameAnalysisData): GameAnalysisData
    suspend fun findByGameId(gameId: Long): GameAnalysisData?
    suspend fun deleteByGameId(gameId: Long)
    suspend fun existsByGameId(gameId: Long): Boolean
}
