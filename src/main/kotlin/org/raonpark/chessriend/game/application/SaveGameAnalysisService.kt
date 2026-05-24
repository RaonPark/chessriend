package org.raonpark.chessriend.game.application

import io.github.oshai.kotlinlogging.KotlinLogging
import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.port.`in`.SaveGameAnalysisUseCase
import org.raonpark.chessriend.game.port.out.GameAnalysisRepository
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.exception.GameNotFoundException
import org.springframework.stereotype.Service

private val log = KotlinLogging.logger {}

@Service
class SaveGameAnalysisService(
    private val gameRepository: GameRepository,
    private val gameAnalysisRepository: GameAnalysisRepository,
) : SaveGameAnalysisUseCase {

    override suspend fun saveAnalysis(gameId: Long, analysis: GameAnalysisData): GameAnalysisData {
        gameRepository.findById(gameId) ?: throw GameNotFoundException(gameId)
        val saved = gameAnalysisRepository.save(gameId, analysis)
        log.info { "game analysis saved: gameId=$gameId depth=${analysis.depth} evals=${analysis.evaluations.size}" }
        return saved
    }
}
