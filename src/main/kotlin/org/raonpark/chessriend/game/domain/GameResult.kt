package org.raonpark.chessriend.game.domain

enum class GameResult {
    WHITE_WIN, BLACK_WIN, DRAW;

    companion object {
        // PGN 표준 결과 문자열에서 변환
        fun fromPgnResult(result: String): GameResult = when (result) {
            "1-0" -> WHITE_WIN
            "0-1" -> BLACK_WIN
            "1/2-1/2" -> DRAW
            else -> throw IllegalArgumentException("Unknown PGN result: $result")
        }
    }

    fun toPgnResult(): String = when (this) {
        WHITE_WIN -> "1-0"
        BLACK_WIN -> "0-1"
        DRAW -> "1/2-1/2"
    }
}
