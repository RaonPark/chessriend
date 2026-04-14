package org.raonpark.chessriend.game.adapter.out.persistence

import io.r2dbc.postgresql.codec.Json
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.reactive.asFlow
import kotlinx.coroutines.reactive.awaitFirstOrNull
import kotlinx.coroutines.reactor.awaitSingle
import tools.jackson.databind.ObjectMapper
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.id.SnowflakeIdGenerator
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.stereotype.Component
import kotlin.time.Duration.Companion.seconds

@Component
class GamePersistenceAdapter(
    private val repository: R2dbcGameRepository,
    private val databaseClient: DatabaseClient,
    private val snowflakeIdGenerator: SnowflakeIdGenerator,
    private val objectMapper: ObjectMapper,
) : GameRepository {

    override suspend fun save(game: Game): Game {
        val entity = toEntity(game)
        val saved = repository.save(entity)
        saved.isNewEntity = false
        return toDomain(saved)
    }

    override suspend fun existsBySourceGameId(sourceGameId: String): Boolean =
        repository.existsBySourceGameId(sourceGameId)

    override suspend fun findById(id: Long): Game? =
        repository.findById(id)?.let { toDomain(it) }

    override suspend fun deleteById(id: Long) {
        repository.deleteById(id)
    }

    override suspend fun deleteByIds(ids: List<Long>) {
        if (ids.isEmpty()) return
        repository.deleteAllByIdIn(ids)
    }

    override suspend fun deleteAll() {
        repository.deleteAll()
    }

    override suspend fun updateAnnotations(id: Long, annotations: GameAnnotation) {
        val json = objectMapper.writeValueAsString(annotations)
        databaseClient.sql("UPDATE games SET annotations = :annotations::jsonb WHERE id = :id")
            .bind("annotations", json)
            .bind("id", id)
            .then()
            .awaitFirstOrNull()
    }

    override fun findAll(offset: Int, limit: Int, source: GameSource?, timeCategory: TimeCategory?): Flow<Game> {
        val conditions = mutableListOf<String>()
        val bindings = mutableMapOf<String, Any>()

        if (source != null) {
            conditions.add("source = :source")
            bindings["source"] = source.name
        }
        if (timeCategory != null) {
            conditions.add("time_category = :timeCategory")
            bindings["timeCategory"] = timeCategory.name
        }

        val whereClause = if (conditions.isEmpty()) "" else "WHERE ${conditions.joinToString(" AND ")}"
        val sql = "SELECT * FROM games $whereClause ORDER BY played_at DESC LIMIT :limit OFFSET :offset"

        var spec = databaseClient.sql(sql)
        bindings.forEach { (key, value) -> spec = spec.bind(key, value) }
        spec = spec.bind("limit", limit).bind("offset", offset)

        return spec.map { row, metadata ->
            GameEntity(
                id = row.get("id", java.lang.Long::class.java)!!.toLong(),
                source = row.get("source", String::class.java)!!,
                sourceGameId = row.get("source_game_id", String::class.java)!!,
                ownerUsername = row.get("owner_username", String::class.java)!!,
                whiteName = row.get("white_name", String::class.java)!!,
                whiteRating = row.get("white_rating", java.lang.Integer::class.java)?.toInt(),
                blackName = row.get("black_name", String::class.java)!!,
                blackRating = row.get("black_rating", java.lang.Integer::class.java)?.toInt(),
                result = row.get("result", String::class.java)!!,
                initialTime = row.get("initial_time", java.lang.Long::class.java)!!.toLong(),
                increment = row.get("increment", java.lang.Long::class.java)!!.toLong(),
                timeCategory = row.get("time_category", String::class.java)!!,
                openingEco = row.get("opening_eco", String::class.java),
                openingName = row.get("opening_name", String::class.java),
                moves = row.get("moves", Json::class.java)!!,
                pgn = row.get("pgn", String::class.java)!!,
                playedAt = row.get("played_at", java.time.Instant::class.java)!!,
                importedAt = row.get("imported_at", java.time.Instant::class.java)!!,
                annotations = row.get("annotations", Json::class.java) ?: Json.of("""{"moveComments":{},"variations":[]}"""),
            ).also { it.isNewEntity = false }
        }.all().asFlow().map { toDomain(it) }
    }

    override suspend fun count(source: GameSource?, timeCategory: TimeCategory?): Long {
        val conditions = mutableListOf<String>()
        val bindings = mutableMapOf<String, Any>()

        if (source != null) {
            conditions.add("source = :source")
            bindings["source"] = source.name
        }
        if (timeCategory != null) {
            conditions.add("time_category = :timeCategory")
            bindings["timeCategory"] = timeCategory.name
        }

        val whereClause = if (conditions.isEmpty()) "" else "WHERE ${conditions.joinToString(" AND ")}"
        val sql = "SELECT COUNT(*) FROM games $whereClause"

        var spec = databaseClient.sql(sql)
        bindings.forEach { (key, value) -> spec = spec.bind(key, value) }

        return spec.map { row, _ -> row.get(0, java.lang.Long::class.java)!!.toLong() }
            .one()
            .awaitSingle()
    }

    private fun toEntity(game: Game): GameEntity {
        val entity = GameEntity(
            id = game.id ?: snowflakeIdGenerator.nextId(),
            source = game.source.name,
            sourceGameId = game.sourceGameId,
            ownerUsername = game.ownerUsername,
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
            annotations = Json.of(objectMapper.writeValueAsString(game.annotations)),
        )
        entity.isNewEntity = game.id == null
        return entity
    }

    private fun toDomain(entity: GameEntity): Game = Game(
        id = entity.id,
        source = GameSource.valueOf(entity.source),
        sourceGameId = entity.sourceGameId,
        ownerUsername = entity.ownerUsername,
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
        annotations = parseAnnotations(entity.annotations.asString()),
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

    @Suppress("UNCHECKED_CAST")
    private fun parseAnnotations(json: String): GameAnnotation {
        val map = objectMapper.readValue(json, Map::class.java) as Map<String, Any?>
        val moveComments = (map["moveComments"] as? Map<String, String>) ?: emptyMap()
        val variations = (map["variations"] as? List<Map<String, Any?>>)?.map { v ->
            Variation(
                startMoveIndex = (v["startMoveIndex"] as Number).toInt(),
                moves = (v["moves"] as List<String>),
                comment = v["comment"] as? String ?: "",
            )
        } ?: emptyList()
        return GameAnnotation(moveComments = moveComments, variations = variations)
    }
}
