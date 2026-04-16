package org.raonpark.chessriend.game.adapter.`in`.web

import org.raonpark.chessriend.game.domain.*
import java.time.Instant

data class GameResponse(
    val id: String,
    val source: String,
    val sourceGameId: String,
    val ownerUsername: String,
    val white: PlayerResponse,
    val black: PlayerResponse,
    val result: String,
    val timeControl: TimeControlResponse,
    val opening: OpeningResponse?,
    val totalMoves: Int,
    val playedAt: Instant,
) {
    companion object {
        fun from(game: Game): GameResponse = GameResponse(
            id = game.id!!.toString(),
            source = game.source.name,
            sourceGameId = game.sourceGameId,
            ownerUsername = game.ownerUsername,
            white = PlayerResponse(game.players.white.name, game.players.white.rating),
            black = PlayerResponse(game.players.black.name, game.players.black.rating),
            result = game.result.toPgnResult(),
            timeControl = TimeControlResponse(
                time = game.timeControl.toString(),
                category = game.timeControl.category.name,
            ),
            opening = game.opening?.let { OpeningResponse(it.eco, it.name) },
            totalMoves = game.totalMoves,
            playedAt = game.playedAt,
        )
    }
}

data class PlayerResponse(
    val name: String,
    val rating: Int?,
)

data class TimeControlResponse(
    val time: String,
    val category: String,
)

data class OpeningResponse(
    val eco: String?,
    val name: String,
)

data class MoveResponse(
    val number: Int,
    val color: String,
    val san: String,
) {
    companion object {
        fun from(move: Move): MoveResponse = MoveResponse(
            number = move.number,
            color = move.color.name,
            san = move.san,
        )
    }
}

data class GameDetailResponse(
    val id: String,
    val source: String,
    val sourceGameId: String,
    val ownerUsername: String,
    val white: PlayerResponse,
    val black: PlayerResponse,
    val result: String,
    val timeControl: TimeControlResponse,
    val opening: OpeningResponse?,
    val moves: List<MoveResponse>,
    val annotations: AnnotationResponse,
    val totalMoves: Int,
    val playedAt: Instant,
) {
    companion object {
        fun from(game: Game): GameDetailResponse = GameDetailResponse(
            id = game.id!!.toString(),
            source = game.source.name,
            sourceGameId = game.sourceGameId,
            ownerUsername = game.ownerUsername,
            white = PlayerResponse(game.players.white.name, game.players.white.rating),
            black = PlayerResponse(game.players.black.name, game.players.black.rating),
            result = game.result.toPgnResult(),
            timeControl = TimeControlResponse(
                time = game.timeControl.toString(),
                category = game.timeControl.category.name,
            ),
            opening = game.opening?.let { OpeningResponse(it.eco, it.name) },
            moves = game.moves.map { MoveResponse.from(it) },
            annotations = AnnotationResponse.from(game.annotations),
            totalMoves = game.totalMoves,
            playedAt = game.playedAt,
        )
    }
}

data class AnnotationRequest(
    val moveComments: Map<String, String> = emptyMap(),
    val variations: List<VariationRequest> = emptyList(),
) {
    fun toDomain(): GameAnnotation = GameAnnotation(
        moveComments = moveComments,
        variations = variations.map { it.toDomain() },
    )
}

data class VariationRequest(
    val startMoveIndex: Int,
    val moves: List<String>,
    val comment: String = "",
    val moveComments: Map<String, String> = emptyMap(),
) {
    fun toDomain(): org.raonpark.chessriend.game.domain.Variation =
        org.raonpark.chessriend.game.domain.Variation(
            startMoveIndex = startMoveIndex,
            moves = moves,
            comment = comment,
            moveComments = moveComments,
        )
}

data class AnnotationResponse(
    val moveComments: Map<String, String>,
    val variations: List<VariationResponse>,
) {
    companion object {
        fun from(annotation: GameAnnotation): AnnotationResponse = AnnotationResponse(
            moveComments = annotation.moveComments,
            variations = annotation.variations.map { VariationResponse.from(it) },
        )
    }
}

data class VariationResponse(
    val startMoveIndex: Int,
    val moves: List<String>,
    val comment: String,
    val moveComments: Map<String, String> = emptyMap(),
) {
    companion object {
        fun from(v: org.raonpark.chessriend.game.domain.Variation): VariationResponse =
            VariationResponse(
                startMoveIndex = v.startMoveIndex,
                moves = v.moves,
                comment = v.comment,
                moveComments = v.moveComments,
            )
    }
}

data class PagedGameResponse(
    val content: List<GameResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
    val hasNext: Boolean,
    val hasPrevious: Boolean,
)
