package org.raonpark.chessriend.game.domain

import kotlin.time.Duration
import kotlin.time.Duration.Companion.hours
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

/** 수 직후 남은 시계와 그 수에 쓴 시간. [spent]는 직전 시계를 모르면 null */
data class MoveClock(
    val remaining: Duration,
    val spent: Duration?,
)

/**
 * PGN 코멘트의 `[%clk h:mm:ss(.f)]`(chess.com·lichess 공통)를 읽는다.
 * 원본 PGN에서 매번 읽으므로 이미 가져온 게임도 다시 가져올 필요가 없다.
 */
object PgnClocks {
    private val HEADER_LINE = Regex("""^\s*\[\w+\s+"[^"]*"]\s*$""", RegexOption.MULTILINE)
    private val CLK = Regex("""\[%clk\s+(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?]""")
    private val MOVE_NUMBER_PREFIX = Regex("""^\d+\.+""")
    private val RESULTS = setOf("1-0", "0-1", "1/2-1/2", "*")
    private const val TOKEN_END = " \t\r\n{}();"

    /** 본선 수마다 그 수 뒤 코멘트의 시계. 시계가 없으면 null. 변형선(괄호) 안은 건너뛴다 */
    fun parseMainline(pgn: String): List<Duration?> {
        val text = pgn.replace(HEADER_LINE, "")
        val clocks = mutableListOf<Duration?>()
        var depth = 0
        var i = 0
        while (i < text.length) {
            when (val c = text[i]) {
                '{' -> {
                    val end = text.indexOf('}', i).let { if (it < 0) text.length else it }
                    if (depth == 0 && clocks.isNotEmpty()) {
                        parseClock(text.substring(i + 1, end))?.let { clocks[clocks.lastIndex] = it }
                    }
                    i = end + 1
                }
                ';' -> i = text.indexOf('\n', i).let { if (it < 0) text.length else it + 1 }
                '(' -> { depth++; i++ }
                ')' -> { depth = maxOf(0, depth - 1); i++ }
                else -> {
                    if (c.isWhitespace()) { i++; continue }
                    var end = i
                    while (end < text.length && text[end] !in TOKEN_END) end++
                    val token = text.substring(i, end).replace(MOVE_NUMBER_PREFIX, "")
                    if (depth == 0 && isMove(token)) clocks.add(null)
                    i = maxOf(end, i + 1)
                }
            }
        }
        return clocks
    }

    private fun isMove(token: String): Boolean =
        token.isNotEmpty() && token !in RESULTS && !token.startsWith("$")

    private fun parseClock(comment: String): Duration? {
        val m = CLK.find(comment) ?: return null
        val (h, min, s, frac) = m.destructured
        val millis = if (frac.isEmpty()) 0 else frac.padEnd(3, '0').toInt()
        return h.toLong().hours + min.toLong().minutes + s.toLong().seconds + millis.milliseconds
    }
}
