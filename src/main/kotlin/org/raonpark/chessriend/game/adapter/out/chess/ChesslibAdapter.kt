package org.raonpark.chessriend.game.adapter.out.chess

import com.github.bhlangonijr.chesslib.Bitboard
import com.github.bhlangonijr.chesslib.Board
import com.github.bhlangonijr.chesslib.Piece
import com.github.bhlangonijr.chesslib.PieceType
import com.github.bhlangonijr.chesslib.game.GameResult as ChesslibGameResult
import com.github.bhlangonijr.chesslib.move.MoveList
import com.github.bhlangonijr.chesslib.pgn.GameLoader
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CancellationException
import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.Move
import org.raonpark.chessriend.game.domain.ParsedPgn
import org.raonpark.chessriend.game.domain.Variation
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

    override fun parsePgn(pgn: String): ParsedPgn {
        // [SetUp]/[FEN] 태그 = 비표준 시작 포지션 → v1 미지원 신호
        val hasSetup = Regex("""\[\s*(SetUp|FEN)\s+"[^"]*"\s*]""", RegexOption.IGNORE_CASE)
            .containsMatchIn(pgn)

        val game = try {
            GameLoader.loadNextGame(pgn.split("\n").iterator())
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            throw IllegalArgumentException("PGN을 해석할 수 없습니다.")
        } ?: throw IllegalArgumentException("PGN을 해석할 수 없습니다.")

        try {
            game.loadMoveText()
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            throw IllegalArgumentException("PGN 기보를 해석할 수 없습니다: ${e.message}")
        }

        val sans = try {
            game.halfMoves?.toSanArray()?.toList().orEmpty()
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            throw IllegalArgumentException("PGN 수순을 해석할 수 없습니다.")
        }
        if (sans.isEmpty()) throw IllegalArgumentException("PGN에 수가 없습니다.")

        val fens = reconstructFens(sans)
        val moves = sans.mapIndexed { i, san ->
            Move(
                number = i / 2 + 1,
                color = if (i % 2 == 0) Color.WHITE else Color.BLACK,
                san = san,
                fen = fens.getOrElse(i + 1) { "" },
                timeSpent = null,
                comment = null,
            )
        }

        // chesslib는 코멘트/변형선을 전역 ply 카운터로 키잉한다(변형선 수도 셈).
        // 메인라인 emit 후 해당 카운터에 분기하는 변형선을 재귀로 소비하여, 각 메인라인 수의 전역 카운터를 복원한다.
        val variationsByKey: Map<Int, List<MoveList>> = game.variations ?: emptyMap()
        val mainlineCounters = IntArray(sans.size)
        var counter = 0
        fun walk(lineSans: List<String>, isMainline: Boolean) {
            lineSans.forEachIndexed { idx, _ ->
                counter++
                val c = counter
                if (isMainline) mainlineCounters[idx] = c
                variationsByKey[c]?.forEach { v ->
                    val vs = runCatching { v.toSanArray()?.toList().orEmpty() }.getOrDefault(emptyList())
                    walk(vs, false)
                }
            }
        }
        walk(sans, true)
        val counterToMainlineIndex = mainlineCounters.withIndex().associate { (i, c) -> c to i }

        // 메인라인 코멘트만 매핑 (key = 0-based ply 인덱스 문자열). [%clk ...] 등 엔진 주석은 제거.
        val rawComments: Map<Int, String> = game.comments ?: emptyMap()
        val moveComments = LinkedHashMap<String, String>()
        moves.indices.forEach { i ->
            val raw = rawComments[mainlineCounters[i]] ?: return@forEach
            val cleaned = cleanComment(raw)
            if (cleaned.isNotEmpty()) moveComments[i.toString()] = cleaned
        }

        // 최상위(parent == -1) 변형선만 1단계로 매핑. 중첩(parent != -1)은 생략.
        val variations = mutableListOf<Variation>()
        variationsByKey.forEach { (key, list) ->
            list.forEach { ml ->
                if (ml.parent != -1) return@forEach
                val mainlineIndex = counterToMainlineIndex[key] ?: return@forEach
                val vsans = runCatching { ml.toSanArray()?.toList().orEmpty() }.getOrDefault(emptyList())
                if (vsans.isEmpty()) return@forEach
                variations += Variation(startMoveIndex = mainlineIndex - 1, moves = vsans)
            }
        }

        return ParsedPgn(
            whiteName = game.whitePlayer?.name?.takeIf { it.isNotBlank() },
            whiteRating = game.whitePlayer?.elo?.takeIf { it > 0 },
            blackName = game.blackPlayer?.name?.takeIf { it.isNotBlank() },
            blackRating = game.blackPlayer?.elo?.takeIf { it > 0 },
            result = game.result.toPgnResult(),
            timeControl = Regex("""\[TimeControl\s+"([^"]*)"\s*]""").find(pgn)
                ?.groupValues?.get(1)?.takeIf { it.isNotBlank() && it != "-" },
            eco = game.eco?.takeIf { it.isNotBlank() },
            openingName = game.opening?.takeIf { it.isNotBlank() },
            date = game.date?.takeIf { it.isNotBlank() && !it.startsWith("?") },
            moves = moves,
            moveComments = moveComments,
            variations = variations,
            hasSetup = hasSetup,
        )
    }

    private fun cleanComment(raw: String): String =
        raw.replace(Regex("""\[%[^]]*]"""), "").trim()

    private fun ChesslibGameResult?.toPgnResult(): String = when (this) {
        ChesslibGameResult.WHITE_WON -> "1-0"
        ChesslibGameResult.BLACK_WON -> "0-1"
        ChesslibGameResult.DRAW -> "1/2-1/2"
        else -> "*"
    }

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
