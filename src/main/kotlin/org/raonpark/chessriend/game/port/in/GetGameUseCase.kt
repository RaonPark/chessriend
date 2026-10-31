package org.raonpark.chessriend.game.port.`in`

import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameAnnotation
import org.raonpark.chessriend.game.domain.GameNote
import org.raonpark.chessriend.game.domain.GameSearchCriteria
import org.raonpark.chessriend.game.domain.OpeningCount
import org.raonpark.chessriend.shared.domain.PagedResult

interface GetGameUseCase {
    suspend fun getGame(id: Long): Game
    suspend fun getGames(page: Int, size: Int, criteria: GameSearchCriteria): PagedResult<Game>
    suspend fun getOpeningCounts(): List<OpeningCount>
    suspend fun deleteGame(id: Long)
    suspend fun deleteGames(ids: List<Long>)
    suspend fun deleteAllGames()
    suspend fun updateAnnotations(id: Long, annotations: GameAnnotation)
    /** 게임 애칭·메모 저장 (정리된 값을 돌려줌). 너무 길면 IllegalArgumentException → 400 */
    suspend fun updateNote(id: Long, nickname: String?, memo: String?): GameNote
}
