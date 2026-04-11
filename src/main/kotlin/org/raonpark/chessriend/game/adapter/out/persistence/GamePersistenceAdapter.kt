package org.raonpark.chessriend.game.adapter.out.persistence

import io.r2dbc.postgresql.codec.Json
import tools.jackson.databind.ObjectMapper
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.id.SnowflakeIdGenerator
import org.springframework.stereotype.Component
import kotlin.time.Duration.Companion.seconds

@Component
class GamePersistenceAdapter(
    private val repository: R2dbcGameRepository,
    private val snowflakeIdGenerator: SnowflakeIdGenerator,
    private val objectMapper: ObjectMapper,
) : GameRepository {

    override suspend fun save(game: Game): Game {
        val entity = toEntity(game)
        val saved = repository.save(entity)
        return toDomain(saved.copy(isNewEntity = false))
    }

    override suspend fun existsBySourceGameId(sourceGameId: String): Boolean =
        repository.existsBySourceGameId(sourceGameId)

    private fun toEntity(game: Game): GameEntity = GameEntity(
        id = game.id ?: snowflakeIdGenerator.nextId(),
        source = game.source.name,
        sourceGameId = game.sourceGameId,
        whiteName = game.players.white.name,
        whiteRating = game.players.white.rating,
        blackName = game.players.black.name,
        blackRating = game.players.black.rating,
        result = game.result.name,
        initialTime = game.timeControl.initialTime.inWholeSeconds,
        increment = game.timeControl.increment.inWholeSeconds,
        timeCategory = game.timeControl.category.name,
        openingEco = game.opening?.eco,
        openingName = game.opening?.name,
        moves = Json.of(objectMapper.writeValueAsString(game.moves.map { it.toMap() })),
        pgn = game.pgn,
        playedAt = game.playedAt,
        importedAt = game.importedAt,
        isNewEntity = game.id == null,
    )

    private fun toDomain(entity: GameEntity): Game = Game(
        id = entity.id,
        source = GameSource.valueOf(entity.source),
        sourceGameId = entity.sourceGameId,
        players = Players(
            white = Player(name = entity.whiteName, rating = entity.whiteRating),
            black = Player(name = entity.blackName, rating = entity.blackRating),
        ),
        moves = parseMoves(entity.moves.asString()),
        result = GameResult.valueOf(entity.result),
        timeControl = TimeControl(
            initialTime = entity.initialTime.seconds,
            increment = entity.increment.seconds,
            category = TimeCategory.valueOf(entity.timeCategory),
        ),
        opening = entity.openingName?.let {
            Opening(eco = entity.openingEco, name = it)
        },
        pgn = entity.pgn,
        playedAt = entity.playedAt,
        importedAt = entity.importedAt,
    )

    private fun Move.toMap(): Map<String, Any?> = mapOf(
        "number" to number,
        "color" to color.name,
        "san" to san,
        "fen" to fen,
        "timeSpent" to timeSpent?.inWholeSeconds,
        "comment" to comment,
    )

    @Suppress("UNCHECKED_CAST")
    private fun parseMoves(json: String): List<Move> {
        val list = objectMapper.readValue(json, List::class.java) as List<Map<String, Any?>>
        return list.map { map ->
            Move(
                number = (map["number"] as Number).toInt(),
                color = Color.valueOf(map["color"] as String),
                san = map["san"] as String,
                fen = map["fen"] as String,
                timeSpent = (map["timeSpent"] as? Number)?.toLong()?.seconds,
                comment = map["comment"] as? String,
            )
        }
    }
}
