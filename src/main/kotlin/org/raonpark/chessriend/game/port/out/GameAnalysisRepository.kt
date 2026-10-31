package org.raonpark.chessriend.game.port.out

import org.raonpark.chessriend.game.domain.GameAnalysisData

interface GameAnalysisRepository {
    suspend fun save(gameId: Long, analysis: GameAnalysisData): GameAnalysisData
    suspend fun findByGameId(gameId: Long): GameAnalysisData?
    /** 여러 게임의 분석을 한 번에 조회 (분석 없는 게임은 결과에서 빠짐) */
    suspend fun findByGameIds(gameIds: List<Long>): Map<Long, GameAnalysisData>
    suspend fun deleteByGameId(gameId: Long)
    suspend fun existsByGameId(gameId: Long): Boolean
}
