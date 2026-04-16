package org.raonpark.chessriend.game.domain

data class GameAnnotation(
    val moveComments: Map<String, String> = emptyMap(),  // key: "{moveIndex}" (예: "5"), value: 메모
    val variations: List<Variation> = emptyList(),
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
