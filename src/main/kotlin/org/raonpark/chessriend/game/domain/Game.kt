package org.raonpark.chessriend.game.domain

import java.time.Instant
import kotlin.time.Duration

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
    val annotations: GameAnnotation = GameAnnotation.empty(),
    val note: GameNote = GameNote.EMPTY,
) {
    val totalMoves: Int
        get() = moves.size

    val lastPosition: String?
        get() = moves.lastOrNull()?.fen

    fun movesBy(color: Color): List<Move> = moves.filter { it.color == color }

    fun moveAt(number: Int, color: Color): Move? =
        moves.find { it.number == number && it.color == color }

    /**
     * 수마다 남은 시계와 쓴 시간 (원본 PGN의 `%clk` 기준). 시계 개수가 수 개수와 다르면
     * 어느 수의 시계인지 확신할 수 없으므로 모두 null.
     * 쓴 시간 = 직전 내 시계(첫 수는 초기 시간) − 남은 시계 + 증가 시간 (음수는 0)
     */
    fun moveClocks(): List<MoveClock?> {
        val clocks = PgnClocks.parseMainline(pgn)
        if (clocks.size != moves.size || clocks.all { it == null }) return List(moves.size) { null }
        val initial = timeControl.initialTime.takeIf { it > Duration.ZERO }
        return clocks.mapIndexed { i, remaining ->
            remaining?.let {
                val previous = if (i >= 2) clocks[i - 2] else initial
                val spent = previous?.let { prev -> (prev - remaining + timeControl.increment).coerceAtLeast(Duration.ZERO) }
                MoveClock(remaining = remaining, spent = spent)
            }
        }
    }
}
