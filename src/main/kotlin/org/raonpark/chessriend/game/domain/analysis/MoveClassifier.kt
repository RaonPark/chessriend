package org.raonpark.chessriend.game.domain.analysis

import org.raonpark.chessriend.game.domain.EvalScore
import kotlin.math.abs
import kotlin.math.exp

/**
 * 수 분류 핵심 로직. 프론트 `classification.ts` 를 1:1 포팅(순수 함수, 외부 의존 zero).
 *
 * cpLoss 절대값 대신 lichess 식 **기대 승률(Win%) 손실**로 분류한다.
 */
object MoveClassifier {

    private const val MATE_SCORE = 10000

    /** "거의 최선수" 기준 — Win% 손실이 이 값(%p) 미만이면 희생이 유효하다고 본다. */
    const val BRILLIANT_WIN_TOLERANCE = 2.0

    /** 기물 가치(체스 통념). 킹은 잡힐 수 없으므로 공격자 가치/이동 기물 가치 모두 0으로 둔다. */
    private val VALUES: Map<PieceKind, Int> = mapOf(
        PieceKind.PAWN to 1,
        PieceKind.KNIGHT to 3,
        PieceKind.BISHOP to 3,
        PieceKind.ROOK to 5,
        PieceKind.QUEEN to 9,
        PieceKind.KING to 0,
    )

    fun pieceValue(kind: PieceKind): Int = VALUES.getValue(kind)

    /** mate/cp 평가를 centipawn 단일 값으로 변환(백 관점). mate-in-N → ±(MATE_SCORE - |N|). */
    fun evalToCp(score: EvalScore): Int {
        val mate = score.mate
        return if (mate != null) {
            if (mate > 0) MATE_SCORE - abs(mate) else -(MATE_SCORE - abs(mate))
        } else {
            score.cp ?: 0
        }
    }

    /** centipawn → 기대 승률(0..100). lichess 계수 사용. */
    fun winPercent(cp: Int): Double = 100.0 / (1.0 + exp(-0.00368208 * cp))

    /**
     * Win% 손실(%p) 기준 분류.
     * Blunder ≥ 30, Mistake ≥ 20, Inaccuracy ≥ 10, 그 외 null.
     */
    fun classifyMove(winLoss: Double): String? = when {
        winLoss >= 30 -> "blunder"
        winLoss >= 20 -> "mistake"
        winLoss >= 10 -> "inaccuracy"
        else -> null
    }

    /**
     * Brilliant(!!): 기물을 희생에 놓았음에도 Win% 손실이 거의 없는 수.
     * - winLoss < tolerance
     * - isAtRisk (방어 없이 더 싼 기물에게 노출)
     * - 포획 수라면 이동 기물이 포획 기물보다 비싸야 진짜 희생
     */
    fun detectBrilliant(winLoss: Double, piece: PieceKind, captured: PieceKind?, isAtRisk: Boolean): Boolean {
        if (winLoss >= BRILLIANT_WIN_TOLERANCE) return false
        if (!isAtRisk) return false
        if (captured != null && pieceValue(piece) <= pieceValue(captured)) return false
        return true
    }
}
