package org.raonpark.chessriend.game.application

import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.port.`in`.GetGameAnalysisUseCase
import org.raonpark.chessriend.game.port.out.GameAnalysisRepository
import org.raonpark.chessriend.shared.exception.GameAnalysisNotFoundException
import org.springframework.stereotype.Service

@Service
class GetGameAnalysisService(
    private val gameAnalysisRepository: GameAnalysisRepository,
) : GetGameAnalysisUseCase {

    override suspend fun getAnalysis(gameId: Long): GameAnalysisData =
        gameAnalysisRepository.findByGameId(gameId)
            ?: throw GameAnalysisNotFoundException(gameId)

    override suspend fun findAnalysis(gameId: Long): GameAnalysisData? =
        gameAnalysisRepository.findByGameId(gameId)
}
