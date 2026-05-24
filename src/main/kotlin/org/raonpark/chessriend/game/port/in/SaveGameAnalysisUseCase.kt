package org.raonpark.chessriend.game.port.`in`

import org.raonpark.chessriend.game.domain.GameAnalysisData

interface SaveGameAnalysisUseCase {
    suspend fun saveAnalysis(gameId: Long, analysis: GameAnalysisData): GameAnalysisData
}
