package org.raonpark.chessriend.game.port.`in`

import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.domain.analysis.GameAnalysisSummary

interface GetGameAnalysisUseCase {
    suspend fun getAnalysis(gameId: Long): GameAnalysisData
    suspend fun findAnalysis(gameId: Long): GameAnalysisData?
    /** 게임 목록용: 여러 게임의 분석 요약 (분석 없는 게임은 빠짐) */
    suspend fun findSummaries(gameIds: List<Long>): Map<Long, GameAnalysisSummary>
}
