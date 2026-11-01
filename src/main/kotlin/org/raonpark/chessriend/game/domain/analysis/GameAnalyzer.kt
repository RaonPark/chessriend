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
     * @param engineLines 각 포지션의 MultiPV 결과(1·2순위, 최선수). 비우면 유일수는 판정하지 않는다.
     */
    fun computeClassifications(
        positionEvals: List<EvalScore>,
        moves: List<Move>,
        contexts: List<MoveContext?>,
        engineLines: List<PositionEval> = emptyList(),
    ): List<MoveEvaluationData> {
        val evaluations = ArrayList<MoveEvaluationData>(moves.size)

        for (i in moves.indices) {
            val evalBefore = positionEvals.getOrNull(i) ?: continue
            val evalAfter = positionEvals.getOrNull(i + 1) ?: continue

            // 백의 수: 점수가 떨어지면 손실 / 흑의 수: 백 관점 점수가 올라가면 흑에게 손실
            val isWhite = moves[i].color == Color.WHITE
            val cpBefore = MoveClassifier.evalToCp(evalBefore)
            val cpAfter = MoveClassifier.evalAfterMoveToCp(evalAfter, moverIsWhite = isWhite)
            val winBefore = MoveClassifier.winPercent(cpBefore)
            val winAfter = MoveClassifier.winPercent(cpAfter)

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
            // 유일수는 실수 계열도, brilliant 도 아닐 때만
            if (classification == null) {
                val line = engineLines.getOrNull(i)
                val playedUci = contexts.getOrNull(i)?.uci
                if (line != null) {
                    val playedIsBest = playedUci != null && playedUci == line.bestMove
                    // 승률은 둔 쪽 관점으로
                    fun moverWin(score: EvalScore): Double {
                        val white = MoveClassifier.winPercent(MoveClassifier.evalToCp(score))
                        return if (isWhite) white else 100.0 - white
                    }
                    val secondWin = line.secondBest?.let { moverWin(it) }
                    if (MoveClassifier.detectOnlyMove(playedIsBest, moverWin(evalBefore), secondWin)) {
                        classification = "only"
                    }
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
