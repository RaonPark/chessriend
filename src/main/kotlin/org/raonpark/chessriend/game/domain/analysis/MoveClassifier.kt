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

    /** 유일수: 1순위 수의 승률(둔 쪽 관점)이 이 값(%) 이상이어야 "유리/동등 유지". */
    const val ONLY_MIN_BEST_WIN = 45.0

    /** 유일수: 2순위 수의 승률(둔 쪽 관점)이 이 값(%) 미만이어야 "상대가 유리해짐". */
    const val ONLY_MAX_SECOND_WIN = 50.0

    /** 유일수: 1·2순위 승률 차이가 이 값(%p) 이상이어야 한다 (기존 Mistake 기준과 동일). */
    const val ONLY_MIN_WIN_GAP = 20.0

    /**
     * 희생: 둔 기물이 그 칸에서의 교환(SEE)으로 잃는 순손실이 이 값(기물 가치 점수) 이상.
     * 2 = 마이너 피스와 폰, 룩과 마이너(익스체인지). 폰 희생(1)은 제외한다 — 갬빗이 모두 브릴리언트가 되지 않게.
     */
    const val SACRIFICE_MIN_LOSS = 2

    /** 브릴리언트: 수를 둔 뒤 둔 쪽 승률(%)이 이 값 이상이어야 한다. 25% ≈ 약 −3폰 (이보다 나쁘면 이미 진 포지션) */
    const val BRILLIANT_MIN_WIN_AFTER = 25.0

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

    /**
     * 수를 둔 직후 포지션의 평가를 cp로 변환(백 관점).
     * UCI는 메이트된 포지션을 부호 없는 "mate 0"으로 주므로, 이때는 방금 둔 쪽([moverIsWhite])이 메이트시킨 것으로 본다.
     */
    fun evalAfterMoveToCp(score: EvalScore, moverIsWhite: Boolean): Int =
        if (score.mate == 0) (if (moverIsWhite) MATE_SCORE else -MATE_SCORE) else evalToCp(score)

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
     * 유일수(!): 내가 둔 수가 엔진 1순위이고, 2순위부터는 상대가 유리해지는 경우.
     * 승률은 모두 **둔 쪽 관점**(0..100).
     * - [playedIsBest]: 둔 수 == 1순위 수
     * - [secondWin]: 2순위 수의 승률. 합법수가 하나뿐이면 null → 강제 수이므로 유일수로 치지 않는다.
     */
    fun detectOnlyMove(playedIsBest: Boolean, bestWin: Double, secondWin: Double?): Boolean {
        if (!playedIsBest || secondWin == null) return false
        if (bestWin < ONLY_MIN_BEST_WIN) return false
        if (secondWin >= ONLY_MAX_SECOND_WIN) return false
        return bestWin - secondWin >= ONLY_MIN_WIN_GAP
    }

    /**
     * Brilliant(!!): 기물을 희생에 놓았음에도 Win% 손실이 거의 없는 수.
     * - winLoss < tolerance
     * - isAtRisk (방어 없이 더 싼 기물에게 노출)
     * - 포획 수라면 이동 기물이 포획 기물보다 비싸야 진짜 희생
     * - 수를 둔 뒤 둔 쪽 승률([moverWinAfter], %)이 [BRILLIANT_MIN_WIN_AFTER] 이상 — 이미 진 포지션에서는
     *   어떤 수든 승률이 0% 근처라 winLoss가 작게 나와 희생이 브릴리언트로 오인된다
     */
    fun detectBrilliant(winLoss: Double, piece: PieceKind, captured: PieceKind?, isAtRisk: Boolean, moverWinAfter: Double): Boolean {
        if (winLoss >= BRILLIANT_WIN_TOLERANCE) return false
        if (moverWinAfter < BRILLIANT_MIN_WIN_AFTER) return false
        if (!isAtRisk) return false
        if (captured != null && pieceValue(piece) <= pieceValue(captured)) return false
        return true
    }
}
