package org.raonpark.chessriend.game.domain

import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

enum class TimeCategory {
    ULTRABULLET, BULLET, BLITZ, RAPID, CLASSICAL, CORRESPONDENCE;
}

data class TimeControl(
    val initialTime: Duration,
    val increment: Duration,
    val category: TimeCategory,
) {
    companion object {
        // "600+0", "180+2" 같은 문자열에서 파싱 (초 단위)
        fun fromString(value: String, category: TimeCategory): TimeControl {
            val parts = value.split("+")
            require(parts.size == 2) { "Invalid time control format: $value" }
            val initial = parts[0].trim().toLong()
            val increment = parts[1].trim().toLong()
            return TimeControl(
                initialTime = initial.seconds,
                increment = increment.seconds,
                category = category,
            )
        }
    }

    override fun toString(): String =
        "${initialTime.inWholeSeconds}+${increment.inWholeSeconds}"
}
