package org.raonpark.chessriend.game.adapter.out.persistence

import org.springframework.data.annotation.Id
import org.springframework.data.relational.core.mapping.Table
import java.time.Instant

@Table("games")
data class GameEntity(
    @Id val id: Long? = null,
    val source: String,
    val sourceGameId: String,
    val whiteName: String,
    val whiteRating: Int?,
    val blackName: String,
    val blackRating: Int?,
    val result: String,
    val initialTime: Long,
    val increment: Long,
    val timeCategory: String,
    val openingEco: String?,
    val openingName: String?,
    val moves: String, // JSONB
    val pgn: String,
    val playedAt: Instant,
    val importedAt: Instant,
)
