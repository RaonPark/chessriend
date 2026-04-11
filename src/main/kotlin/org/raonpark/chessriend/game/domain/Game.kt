package org.raonpark.chessriend.game.domain

import java.time.Instant

data class Game(
    val id: Long?,
    val source: GameSource,
    val sourceGameId: String,
    val ownerUsername: String,
    val players: Players,
    val moves: List<Move>,
    val result: GameResult,
    val timeControl: TimeControl,
    val opening: Opening?,
    val pgn: String,
    val playedAt: Instant,
    val importedAt: Instant,
) {
    val totalMoves: Int
        get() = moves.size

    val lastPosition: String?
        get() = moves.lastOrNull()?.fen

    fun movesBy(color: Color): List<Move> = moves.filter { it.color == color }

    fun moveAt(number: Int, color: Color): Move? =
        moves.find { it.number == number && it.color == color }
}
