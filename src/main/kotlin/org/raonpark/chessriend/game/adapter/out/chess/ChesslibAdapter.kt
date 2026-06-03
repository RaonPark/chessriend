package org.raonpark.chessriend.game.adapter.out.chess

import com.github.bhlangonijr.chesslib.Bitboard
import com.github.bhlangonijr.chesslib.Board
import com.github.bhlangonijr.chesslib.Piece
import com.github.bhlangonijr.chesslib.PieceType
import com.github.bhlangonijr.chesslib.move.MoveList
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CancellationException
import org.raonpark.chessriend.game.domain.analysis.MoveClassifier
import org.raonpark.chessriend.game.domain.analysis.MoveContext
import org.raonpark.chessriend.game.domain.analysis.PieceKind
import org.raonpark.chessriend.game.port.out.ChessRules
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * chesslib 기반 [ChessRules] 구현. 체스 라이브러리 의존을 이 어댑터에 가둔다.
 *
 * 희생 판정은 프론트 `extractMoveContext`(chess.js `attackers`) 와 동등하게:
 * - 이동 후 목적지를 공격하는 적 기물 중 최저 가치(킹=0)가 이동 기물보다 싸고
 * - 아군 방어자가 없으면 isAtRisk.
 */
@Component
class ChesslibAdapter : ChessRules {

    override fun reconstructFens(sans: List<String>): List<String> {
        val board = Board()
        val fens = mutableListOf(board.fen)
        if (sans.isEmpty()) return fens

        val moveList = MoveList()
        return try {
            moveList.loadFromSan(sans.joinToString(" "))
            for (move in moveList) {
                board.doMove(move)
                fens += board.fen
            }
            fens
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            log.warn(e) { "SAN 재생 실패 — ${fens.size - 1}/${sans.size} 수까지만 재구성" }
            fens
        }
    }

    override fun analyzeMove(fenBefore: String, san: String): MoveContext? {
        return try {
            val moveList = MoveList(fenBefore)
            moveList.loadFromSan(san)
            val move = moveList.firstOrNull() ?: return null

            val board = Board().apply { loadFromFen(fenBefore) }
            val movedPiece = board.getPiece(move.from)
            val capturedPiece = board.getPiece(move.to)
            board.doMove(move)

            val moverSide = movedPiece.pieceSide
            val opponentSide = moverSide.flip()
            val toSq = move.to

            val enemyAttackers = Bitboard.bbToSquareList(board.squareAttackedBy(toSq, opponentSide))
            val isDefended = board.squareAttackedBy(toSq, moverSide) != 0L

            val cheapestAttacker = enemyAttackers
                .minOfOrNull { sq -> MoveClassifier.pieceValue(board.getPiece(sq).pieceType.toKind()) }
                ?: Int.MAX_VALUE

            val movedKind = movedPiece.pieceType.toKind()
            val isAtRisk = !isDefended && cheapestAttacker < MoveClassifier.pieceValue(movedKind)

            MoveContext(
                piece = movedKind,
                captured = if (capturedPiece == Piece.NONE) null else capturedPiece.pieceType.toKind(),
                isAtRisk = isAtRisk,
            )
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            log.debug(e) { "희생 판정 실패: san=$san fen=$fenBefore" }
            null
        }
    }

    private fun PieceType.toKind(): PieceKind = when (this) {
        PieceType.PAWN -> PieceKind.PAWN
        PieceType.KNIGHT -> PieceKind.KNIGHT
        PieceType.BISHOP -> PieceKind.BISHOP
        PieceType.ROOK -> PieceKind.ROOK
        PieceType.QUEEN -> PieceKind.QUEEN
        PieceType.KING -> PieceKind.KING
        PieceType.NONE -> error("unexpected NONE piece type on attacker square")
    }
}
