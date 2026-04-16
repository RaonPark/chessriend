package org.raonpark.chessriend.game.domain

data class GameAnnotation(
    val moveComments: Map<String, String> = emptyMap(),  // key: "{moveIndex}" (예: "5"), value: 메모
    val variations: List<Variation> = emptyList(),
    val analysis: GameAnalysisData? = null,
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
)

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
