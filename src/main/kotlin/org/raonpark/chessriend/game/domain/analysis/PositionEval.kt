package org.raonpark.chessriend.game.domain.analysis

import org.raonpark.chessriend.game.domain.EvalScore

/**
 * 한 포지션에 대한 엔진 결과 (모든 점수는 **백 관점**).
 *
 * @property best 1순위 라인의 평가
 * @property secondBest 2순위 라인의 평가. 합법수가 하나뿐이면 null (MultiPV 라인이 하나만 나옴)
 * @property bestMove 1순위 수 (UCI 표기, 예: "e2e4", "e7e8q"). 알 수 없으면 null
 */
data class PositionEval(
    val best: EvalScore,
    val secondBest: EvalScore? = null,
    val bestMove: String? = null,
)
