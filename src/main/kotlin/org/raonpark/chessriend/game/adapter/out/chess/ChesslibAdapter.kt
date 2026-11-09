package org.raonpark.chessriend.game.adapter.out.chess

import com.github.bhlangonijr.chesslib.Board
import com.github.bhlangonijr.chesslib.Piece
import com.github.bhlangonijr.chesslib.PieceType
import com.github.bhlangonijr.chesslib.Square
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
 * 희생(isAtRisk) 판정 — 정적 교환 평가(SEE), **합법 수만** 사용:
 * - 수를 둔 뒤 상대가 목적지에서 교환을 시작해 양쪽이 최선으로 잡고 되잡을 때 상대가 얻는 가치를 구한다.
 * - 그 값에서 내가 이 수로 잡은 기물 가치를 뺀 순손실이 [MoveClassifier.SACRIFICE_MIN_LOSS] 이상이면 희생.
 * - 합법 수만 쓰므로 킹에 핀된 기물이나, 지켜지는 칸으로 가는 킹은 공격자로 치지 않는다.
 * - 방어자가 있어도 더 싼 기물에게 잡혀 손해면 희생, 같은 가치끼리 교환해 본전이면 희생이 아니다.
 * - 그 칸 밖의 전술(포크·스큐어로 되찾기)은 보지 않는다. 그런 수의 좋고 나쁨은 엔진 평가(Win% 손실)가 거른다.
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
            event = Regex("""\[Event\s+"([^"]*)"\s*]""").find(pgn)?.groupValues?.get(1)?.takeIf { it.isNotBlank() },
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

            val movedKind = movedPiece.pieceType.toKind()
            val capturedValue = if (capturedPiece == Piece.NONE) 0 else MoveClassifier.pieceValue(capturedPiece.pieceType.toKind())
            // 상대 차례에서 목적지 교환으로 상대가 얻는 가치 − 내가 이 수로 얻은 가치
            val netLoss = exchangeGain(board, move.to) - capturedValue
            val isAtRisk = netLoss >= MoveClassifier.SACRIFICE_MIN_LOSS

            MoveContext(
                piece = movedKind,
                captured = if (capturedPiece == Piece.NONE) null else capturedPiece.pieceType.toKind(),
                isAtRisk = isAtRisk,
                uci = move.toString().lowercase(),
            )
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            log.debug(e) { "희생 판정 실패: san=$san fen=$fenBefore" }
            null
        }
    }

    /**
     * 정적 교환 평가: 차례인 쪽이 [square]의 기물을 합법 수로 잡기 시작해, 양쪽이 가장 싼 기물로 잡고 되잡을 때
     * 차례인 쪽이 얻는 가치 (중간에 멈출 수 있으므로 0 이상). [board]는 수를 두고 되돌려 원상태로 남긴다.
     */
    private fun exchangeGain(board: Board, square: Square): Int {
        val target = board.getPiece(square).takeIf { it != Piece.NONE } ?: return 0
        val capture = board.legalMoves()
            .filter { it.to == square && (it.promotion == Piece.NONE || it.promotion.pieceType == PieceType.QUEEN) }
            .minByOrNull { attackerOrder(board.getPiece(it.from)) }
            ?: return 0
        val promotionBonus = if (capture.promotion == Piece.NONE) 0 else MoveClassifier.pieceValue(PieceKind.QUEEN) - MoveClassifier.pieceValue(PieceKind.PAWN)
        val gain = MoveClassifier.pieceValue(target.pieceType.toKind()) + promotionBonus
        board.doMove(capture)
        val recapture = exchangeGain(board, square)
        board.undoMove()
        return maxOf(0, gain - recapture)
    }

    /** 가장 싼 기물로 먼저 잡는다. 킹은 마지막 (지켜지지 않는 칸만 잡을 수 있으므로 교환의 끝) */
    private fun attackerOrder(piece: Piece): Int =
        if (piece.pieceType == PieceType.KING) Int.MAX_VALUE else MoveClassifier.pieceValue(piece.pieceType.toKind())

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
