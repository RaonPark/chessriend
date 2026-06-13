package org.raonpark.chessriend.game.port.`in`

import kotlinx.coroutines.flow.Flow
import org.raonpark.chessriend.game.domain.analysis.AnalysisProgress

/**
 * 백엔드에서 게임 전체를 Stockfish 로 분석하고 결과를 저장하는 유스케이스.
 * 진행률과 최종 결과를 [AnalysisProgress] 스트림으로 흘려보낸다.
 */
interface RunGameAnalysisUseCase {
    fun runAnalysis(gameId: Long): Flow<AnalysisProgress>
}
