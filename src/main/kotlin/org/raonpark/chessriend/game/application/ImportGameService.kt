package org.raonpark.chessriend.game.application

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.port.`in`.ImportGameUseCase
import org.raonpark.chessriend.game.port.out.ChessGameClient
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.raonpark.chessriend.game.port.out.GameRepository
import org.springframework.stereotype.Service

@Service
class ImportGameService(
    private val clients: List<ChessGameClient>,
    private val gameRepository: GameRepository,
) : ImportGameUseCase {

    override fun importGames(source: GameSource, criteria: GameFetchCriteria): Flow<Game> {
        val client = clients.find { it.source == source }
            ?: throw IllegalArgumentException("Unsupported game source: $source")

        return client.fetchGames(criteria)
            .filter { game -> !gameRepository.existsBySourceGameId(game.sourceGameId) }
            .map { game -> gameRepository.save(game) }
    }
}
