package org.raonpark.chessriend.game.port.`in`

import org.raonpark.chessriend.game.domain.Game

/**
 * 사용자가 붙여넣은 PGN 문자열로 게임을 생성한다.
 * 외부 소스 임포트([ImportGameUseCase]) 와 분리된 로컬 생성 경로.
 */
interface CreateGameFromPgnUseCase {
    suspend fun createFromPgn(command: CreateGameFromPgnCommand): Game
}

/** PGN 게임 생성 커맨드. [pgn] 만 필수. */
data class CreateGameFromPgnCommand(
    val pgn: String,
    val ownerUsername: String = "",
)
