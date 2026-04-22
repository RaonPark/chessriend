package org.raonpark.chessriend.game.application

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.take
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.port.`in`.ImportGameUseCase
import org.raonpark.chessriend.game.port.out.ChessGameClient
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.exception.UnsupportedGameSourceException
import org.springframework.stereotype.Service

@Service
class ImportGameService(
    private val clients: List<ChessGameClient>,
    private val gameRepository: GameRepository,
) : ImportGameUseCase {

    override fun importGames(source: GameSource, criteria: GameFetchCriteria): Flow<Game> {
        val client = clients.find { it.source == source }
            ?: throw UnsupportedGameSourceException(source.name)

        // max는 "저장될 새 게임 N개"를 의미. 중복 제거 후 take()로 적용해
        // 이미 임포트된 게임이 카운트를 갉아먹지 않도록 한다.
        // Flow 취소는 상류 WebClient까지 전파되어 API 호출이 조기에 중단됨.
        val newGames = client.fetchGames(criteria)
            .filter { game -> !gameRepository.existsBySourceGameId(game.sourceGameId) }
            .map { game -> game.copy(ownerUsername = criteria.username) }

        val limited = criteria.max?.let { newGames.take(it) } ?: newGames

        return limited.map { game -> gameRepository.save(game) }
    }
}
