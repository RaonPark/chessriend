package org.raonpark.chessriend.game.adapter.out.client

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "lichess.api")
data class LichessConfig(
    val baseUrl: String = "https://lichess.org",
    val token: String = "",
)
