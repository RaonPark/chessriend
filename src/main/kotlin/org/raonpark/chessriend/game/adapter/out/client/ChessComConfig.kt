package org.raonpark.chessriend.game.adapter.out.client

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "chesscom.api")
data class ChessComConfig(
    val baseUrl: String = "https://api.chess.com",
    val userAgent: String = "Chessriend/1.0",
)
