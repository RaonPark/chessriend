package org.raonpark.chessriend.game.domain

enum class Color {
    WHITE, BLACK;

    fun opposite(): Color = when (this) {
        WHITE -> BLACK
        BLACK -> WHITE
    }
}
