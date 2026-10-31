package org.raonpark.chessriend.game.domain.analysis

import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.domain.MoveEvaluationData
import kotlin.math.max
import kotlin.math.roundToInt

/** 한 플레이어의 분석 요약: 분류별 개수 + 평균 centipawn loss (해당 색의 평가가 없으면 null) */
data class SideAnalysisSummary(
    val brilliant: Int,
    val blunder: Int,
    val mistake: Int,
    val inaccuracy: Int,
    val acpl: Int?,
)

/**
 * 게임 목록 등에서 보여줄 분석 요약.
 * 평균 cp loss는 lichess ACPL처럼 평가를 ±1000cp로 제한해 계산한다 (프론트 `analysisStats.ts`와 같은 규칙).
 * 저장된 `cpLoss`는 메이트를 ±10000으로 환산한 값이라 그대로 평균 내면 값이 폭주한다.
 */
data class GameAnalysisSummary(
    val depth: Int,
    val white: SideAnalysisSummary,
    val black: SideAnalysisSummary,
) {
    companion object {
        private const val CP_CEILING = 1000

        fun from(analysis: GameAnalysisData): GameAnalysisSummary {
            // 표준 시작 포지션 기준: 짝수 moveIndex = 백의 수
            val (whiteEvals, blackEvals) = analysis.evaluations.partition { it.moveIndex % 2 == 0 }
            return GameAnalysisSummary(
                depth = analysis.depth,
                white = summarize(whiteEvals, isWhite = true),
                black = summarize(blackEvals, isWhite = false),
            )
        }

        private fun summarize(evaluations: List<MoveEvaluationData>, isWhite: Boolean): SideAnalysisSummary {
            val counts = evaluations.groupingBy { it.classification }.eachCount()
            val acpl = evaluations
                .map { moveCpLoss(it.evalBefore, it.evalAfter, isWhite) }
                .takeIf { it.isNotEmpty() }
                ?.average()
                ?.roundToInt()
            return SideAnalysisSummary(
                brilliant = counts["brilliant"] ?: 0,
                blunder = counts["blunder"] ?: 0,
                mistake = counts["mistake"] ?: 0,
                inaccuracy = counts["inaccuracy"] ?: 0,
                acpl = acpl,
            )
        }

        private fun moveCpLoss(before: EvalScore, after: EvalScore, isWhite: Boolean): Int {
            val b = clampedCp(before)
            val a = clampedCp(after)
            return max(0, if (isWhite) b - a else a - b)
        }

        private fun clampedCp(score: EvalScore): Int =
            score.mate?.let { if (it > 0) CP_CEILING else -CP_CEILING }
                ?: (score.cp ?: 0).coerceIn(-CP_CEILING, CP_CEILING)
    }
}
