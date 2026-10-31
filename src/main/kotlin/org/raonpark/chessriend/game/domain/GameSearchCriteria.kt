package org.raonpark.chessriend.game.domain

/** 게임 목록 검색 조건. 모든 조건은 AND로 결합되고, null/기본값은 "조건 없음". */
data class GameSearchCriteria(
    val source: GameSource? = null,
    val timeCategory: TimeCategory? = null,
    /** 소유자 관점 결과. 소유자가 없는 게임은 WIN/LOSS에 걸리지 않음 (DRAW는 결과만 봄) */
    val outcome: OwnerOutcome? = null,
    val ratingBand: RatingBand? = null,
    /** 레이팅 구간을 누구 기준으로 볼지. 소유자가 없는 게임은 레이팅 조건에 걸리지 않음 */
    val ratingBasis: RatingBasis = RatingBasis.OPPONENT,
)

enum class OwnerOutcome { WIN, LOSS, DRAW }

enum class RatingBasis { OPPONENT, ME }

/** 레이팅 구간. [min]/[max]는 포함 범위, null이면 열린 구간. [UNRATED]는 레이팅이 없는 경우 */
enum class RatingBand(val min: Int?, val max: Int?) {
    UNDER_1200(null, 1199),
    FROM_1200_TO_1499(1200, 1499),
    FROM_1500_TO_1799(1500, 1799),
    FROM_1800_TO_2099(1800, 2099),
    FROM_2100(2100, null),
    UNRATED(null, null),
}
