package org.raonpark.chessriend.game.domain

data class GameAnnotation(
    val moveComments: Map<String, String> = emptyMap(),  // key: "{moveIndex}" (예: "5"), value: 메모
    val variations: List<Variation> = emptyList(),
    val moveArrows: Map<String, List<BoardArrow>> = emptyMap(),  // key: "{moveIndex}" (-1 = 시작 포지션), 해당 수 이후 포지션의 화살표
) {
    companion object {
        fun empty() = GameAnnotation()
    }
}

data class Variation(
    val startMoveIndex: Int,    // mainline에서 분기한 수 인덱스
    val moves: List<String>,    // SAN 수 목록
    val comment: String = "",   // 변형선 전체에 대한 메모
    val moveComments: Map<String, String> = emptyMap(),  // key: 변형선 내 수 인덱스, value: 메모
    val moveArrows: Map<String, List<BoardArrow>> = emptyMap(),  // key: 변형선 내 수 인덱스 (-1 = 분기 포지션)
)

/** 보드 위에 사용자가 그린 화살표. 색은 프론트가 그대로 CSS로 쓰므로 hex만 허용한다. */
data class BoardArrow(
    val startSquare: String,
    val endSquare: String,
    val color: String,
) {
    init {
        require(SQUARE.matches(startSquare)) { "Invalid square: $startSquare" }
        require(SQUARE.matches(endSquare)) { "Invalid square: $endSquare" }
        require(startSquare != endSquare) { "Arrow start and end must differ: $startSquare" }
        require(HEX_COLOR.matches(color)) { "Invalid arrow color: $color" }
    }

    companion object {
        private val SQUARE = Regex("^[a-h][1-8]$")
        private val HEX_COLOR = Regex("^#[0-9a-fA-F]{6}$")
    }
}

data class GameAnalysisData(
    val evaluations: List<MoveEvaluationData>,
    val depth: Int,
    val analyzedAt: String,
)

data class MoveEvaluationData(
    val moveIndex: Int,
    val evalBefore: EvalScore,
    val evalAfter: EvalScore,
    val cpLoss: Int,
    val classification: String?,  // "blunder", "mistake", "inaccuracy", or null
)

data class EvalScore(
    val cp: Int? = null,
    val mate: Int? = null,
)
