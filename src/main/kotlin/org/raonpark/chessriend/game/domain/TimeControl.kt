package org.raonpark.chessriend.game.domain

import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

enum class TimeCategory {
    ULTRABULLET, BULLET, BLITZ, RAPID, CLASSICAL,
    /** 일일(통신) 체스: 한 수에 하루~며칠 (lichess Correspondence / chess.com Daily) */
    CORRESPONDENCE,
    /** 시간 정보가 없거나 해석할 수 없는 게임 (PGN 직접 입력 등) */
    OTHER;

    companion object {
        /** lichess 식 추정: 예상 소요(base + 40*inc)로 카테고리 판정 */
        fun infer(initialSeconds: Long, incrementSeconds: Long): TimeCategory {
            val estimated = initialSeconds + 40 * incrementSeconds
            return when {
                estimated < 30 -> ULTRABULLET
                estimated < 180 -> BULLET
                estimated < 480 -> BLITZ
                estimated < 1500 -> RAPID
                else -> CLASSICAL
            }
        }
    }
}

data class TimeControl(
    val initialTime: Duration,
    val increment: Duration,
    val category: TimeCategory,
) {
    companion object {
        private const val ONE_DAY_SECONDS = 86_400L
        private val DAILY_EVENT = Regex("daily|correspondence", RegexOption.IGNORE_CASE)
        private val BASE_PLUS_INCREMENT = Regex("""(\d+)\+(\d+)""")
        private val BASE_ONLY = Regex("""\*?(\d+)""") // "*60"은 모래시계 → 기본 시간처럼 취급
        private val MOVES_PER_SECONDS = Regex("""(\d+)/(\d+)""")

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

        /**
         * PGN `[TimeControl]` 태그(+ `[Event]`) 해석. 표준 형식:
         * - `600+5` 기본+증분, `180` 기본만, `*60` 모래시계
         * - `40/7200` 수/초, `40/7200:3600` 구간제 → 첫 구간 기준
         * - `1/259200`처럼 한 수에 하루 이상 → 일일 체스
         * Event에 Daily/Correspondence가 있으면 일일 체스. 그 외(`-`, `?`, 없음, 해석 불가)는 기타.
         */
        fun fromPgnTag(raw: String?, event: String?): TimeControl {
            if (event != null && DAILY_EVENT.containsMatchIn(event)) {
                return parseFirstPeriod(raw)?.copy(category = TimeCategory.CORRESPONDENCE)
                    ?: TimeControl(Duration.ZERO, Duration.ZERO, TimeCategory.CORRESPONDENCE)
            }
            return parseFirstPeriod(raw) ?: TimeControl(Duration.ZERO, Duration.ZERO, TimeCategory.OTHER)
        }

        private fun parseFirstPeriod(raw: String?): TimeControl? {
            val first = raw?.trim()?.substringBefore(':')?.takeIf { it.isNotEmpty() } ?: return null
            BASE_PLUS_INCREMENT.matchEntire(first)?.let { m ->
                val (base, inc) = m.destructured
                return of(base.toLong(), inc.toLong())
            }
            BASE_ONLY.matchEntire(first)?.let { m -> return of(m.groupValues[1].toLong(), 0) }
            MOVES_PER_SECONDS.matchEntire(first)?.let { m ->
                val moves = m.groupValues[1].toLong()
                val seconds = m.groupValues[2].toLong()
                if (moves > 0 && seconds / moves >= ONE_DAY_SECONDS) {
                    return TimeControl(seconds.seconds, Duration.ZERO, TimeCategory.CORRESPONDENCE)
                }
                return of(seconds, 0)
            }
            return null
        }

        private fun of(baseSeconds: Long, incrementSeconds: Long) =
            TimeControl(baseSeconds.seconds, incrementSeconds.seconds, TimeCategory.infer(baseSeconds, incrementSeconds))
    }

    override fun toString(): String =
        "${initialTime.inWholeMinutes}+${increment.inWholeSeconds}"
}
