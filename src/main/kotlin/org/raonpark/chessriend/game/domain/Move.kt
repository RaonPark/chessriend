package org.raonpark.chessriend.game.domain

import kotlin.time.Duration

data class Move(
    val number: Int,
    val color: Color,
    val san: String,
    val fen: String,
    val timeSpent: Duration?,
    val comment: String?,
)
