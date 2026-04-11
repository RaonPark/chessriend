package org.raonpark.chessriend.game.domain

data class Player(
    val name: String,
    val rating: Int?,
)

data class Players(
    val white: Player,
    val black: Player,
) {
    fun byColor(color: Color): Player = when (color) {
        Color.WHITE -> white
        Color.BLACK -> black
    }
}
