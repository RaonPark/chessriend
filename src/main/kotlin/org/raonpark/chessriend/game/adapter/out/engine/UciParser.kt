package org.raonpark.chessriend.game.adapter.out.engine

import org.raonpark.chessriend.game.domain.EvalScore

/**
 * UCI `info ... score cp|mate N` 라인 파서.
 *
 * UCI 점수는 **side-to-move 관점**이므로 백 관점으로 정규화한다(useStockfish.ts 와 동일):
 * FEN 의 차례가 흑('b')이면 부호를 뒤집는다.
 *
 * 프로세스 spawn 없이 단위 테스트 가능하도록 순수 함수로 분리.
 */
object UciParser {
    private val CP = Regex("""\bscore cp (-?\d+)""")
    private val MATE = Regex("""\bscore mate (-?\d+)""")

    /** FEN 차례에 따른 부호 보정값(백=+1, 흑=-1). */
    fun flipFor(fen: String): Int =
        if (fen.trim().split(Regex("\\s+")).getOrNull(1) == "b") -1 else 1

    /**
     * 단일 `info` 라인에서 점수를 백 관점으로 추출. score 가 없으면 null.
     */
    fun parseScore(line: String, flip: Int): EvalScore? {
        if (!line.startsWith("info") || " score " !in line) return null
        CP.find(line)?.let { return EvalScore(cp = it.groupValues[1].toInt() * flip, mate = null) }
        MATE.find(line)?.let { return EvalScore(cp = null, mate = it.groupValues[1].toInt() * flip) }
        return null
    }

    /**
     * `bestmove` 이전까지의 라인들 중 **마지막** score 를 백 관점으로 반환.
     * 점수 라인이 하나도 없으면 null.
     */
    fun extractEval(lines: List<String>, fen: String): EvalScore? {
        val flip = flipFor(fen)
        var last: EvalScore? = null
        for (line in lines) {
            parseScore(line, flip)?.let { last = it }
            if (line.startsWith("bestmove")) break
        }
        return last
    }
}
