package org.raonpark.chessriend.game.port.`in`

import org.raonpark.chessriend.game.domain.GameAnalysisData

interface GetGameAnalysisUseCase {
    suspend fun getAnalysis(gameId: Long): GameAnalysisData
    suspend fun findAnalysis(gameId: Long): GameAnalysisData?
}
