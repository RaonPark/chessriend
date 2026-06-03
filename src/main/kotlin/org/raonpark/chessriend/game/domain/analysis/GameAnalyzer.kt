package org.raonpark.chessriend.game.domain.analysis

import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.Move
import org.raonpark.chessriend.game.domain.MoveEvaluationData
import kotlin.math.max

/**
 * 포지션 평가 배열 + 수 목록 + 희생 컨텍스트로부터 각 수의 분류를 계산.
 * 프론트 `computeClassifications` 1:1 포팅(순수 함수).
 */
object GameAnalyzer {

    /**
     * @param positionEvals 각 포지션 평가(백 관점). length = moves.size + 1.
     * @param moves 메인라인 수 목록.
     * @param contexts 각 수의 희생 컨텍스트(없으면 null). length = moves.size.
     */
    fun computeClassifications(
        positionEvals: List<EvalScore>,
        moves: List<Move>,
        contexts: List<MoveContext?>,
    ): List<MoveEvaluationData> {
        val evaluations = ArrayList<MoveEvaluationData>(moves.size)

        for (i in moves.indices) {
            val evalBefore = positionEvals.getOrNull(i) ?: continue
            val evalAfter = positionEvals.getOrNull(i + 1) ?: continue

            val cpBefore = MoveClassifier.evalToCp(evalBefore)
            val cpAfter = MoveClassifier.evalToCp(evalAfter)
            val winBefore = MoveClassifier.winPercent(cpBefore)
            val winAfter = MoveClassifier.winPercent(cpAfter)

            // 백의 수: 점수가 떨어지면 손실 / 흑의 수: 백 관점 점수가 올라가면 흑에게 손실
            val isWhite = moves[i].color == Color.WHITE
            val cpLoss = max(0, if (isWhite) cpBefore - cpAfter else cpAfter - cpBefore)
            val winLoss = max(0.0, if (isWhite) winBefore - winAfter else winAfter - winBefore)

            val base = MoveClassifier.classifyMove(winLoss)
            var classification = base
            // Brilliant 는 실수 계열이 아닐 때만 승격
            if (base == null) {
                val ctx = contexts.getOrNull(i)
                if (ctx != null &&
                    MoveClassifier.detectBrilliant(winLoss, ctx.piece, ctx.captured, ctx.isAtRisk)
                ) {
                    classification = "brilliant"
                }
            }

            evaluations += MoveEvaluationData(
                moveIndex = i,
                evalBefore = evalBefore,
                evalAfter = evalAfter,
                cpLoss = cpLoss,
                classification = classification,
            )
        }

        return evaluations
    }
}
