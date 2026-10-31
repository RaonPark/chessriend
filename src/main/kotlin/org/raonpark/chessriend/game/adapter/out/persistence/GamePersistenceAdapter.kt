package org.raonpark.chessriend.game.adapter.out.persistence

import io.r2dbc.postgresql.codec.Json
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.reactive.asFlow
import kotlinx.coroutines.reactor.awaitSingle
import org.jooq.Condition
import org.jooq.DSLContext
import org.jooq.Field
import org.jooq.JSONB
import org.jooq.conf.ParamType
import org.jooq.impl.DSL
import tools.jackson.databind.ObjectMapper
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.jooq.tables.references.GAMES
import org.raonpark.chessriend.shared.id.SnowflakeIdGenerator
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.stereotype.Component
import kotlin.time.Duration.Companion.seconds

@Component
class GamePersistenceAdapter(
    private val repository: R2dbcGameRepository,
    private val databaseClient: DatabaseClient,
    private val dsl: DSLContext,
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
        val query = dsl.update(GAMES)
            .set(GAMES.ANNOTATIONS, JSONB.jsonb(json))
            .where(GAMES.ID.eq(id))

        executeUpdate(query)
    }

    override fun findAll(offset: Int, limit: Int, criteria: GameSearchCriteria): Flow<Game> {
        val finalQuery = dsl.select(DSL.asterisk())
            .from(GAMES)
            .where(conditionOf(criteria))
            .orderBy(GAMES.PLAYED_AT.desc())
            .limit(limit)
            .offset(offset)

        return bindQuery(finalQuery)
            .map { row, _ ->
                GameEntity(
                    id = row.get("id", Long::class.java)!!,
                    source = row.get("source", String::class.java)!!,
                    sourceGameId = row.get("source_game_id", String::class.java)!!,
                    ownerUsername = row.get("owner_username", String::class.java)!!,
                    whiteName = row.get("white_name", String::class.java)!!,
                    // 박싱 타입으로 조회 — rating 이 NULL 인 게임(FEN 생성·익명 등)에서 primitive int NPE 방지
                    whiteRating = row.get("white_rating", Int::class.javaObjectType),
                    blackName = row.get("black_name", String::class.java)!!,
                    blackRating = row.get("black_rating", Int::class.javaObjectType),
                    result = row.get("result", String::class.java)!!,
                    initialTime = row.get("initial_time", Long::class.java)!!,
                    increment = row.get("increment", Long::class.java)!!,
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

    override suspend fun count(criteria: GameSearchCriteria): Long {
        val query = dsl.selectCount()
            .from(GAMES)
            .where(conditionOf(criteria))

        return bindQuery(query)
            .map { row, _ -> row.get(0, Long::class.java)!! }
            .one()
            .awaitSingle()
    }

    // 소유자가 백/흑인지: 이름과 owner_username을 대소문자 무시 비교 (owner가 빈 문자열이면 둘 다 false)
    private val ownerIsWhite: Condition =
        GAMES.OWNER_USERNAME.ne("").and(DSL.lower(GAMES.WHITE_NAME).eq(DSL.lower(GAMES.OWNER_USERNAME)))
    private val ownerIsBlack: Condition =
        GAMES.OWNER_USERNAME.ne("").and(DSL.lower(GAMES.BLACK_NAME).eq(DSL.lower(GAMES.OWNER_USERNAME)))

    /** 검색 조건 → WHERE 절. bindQuery가 null 파라미터를 못 받으므로 null 비교는 isNull()만 사용 */
    private fun conditionOf(criteria: GameSearchCriteria): Condition {
        var condition: Condition = DSL.trueCondition()
        criteria.source?.let { condition = condition.and(GAMES.SOURCE.eq(it.name)) }
        criteria.timeCategory?.let { condition = condition.and(GAMES.TIME_CATEGORY.eq(it.name)) }
        criteria.outcome?.let { condition = condition.and(outcomeCondition(it)) }
        criteria.ratingBand?.let { condition = condition.and(ratingCondition(it, criteria.ratingBasis)) }
        return condition
    }

    private fun outcomeCondition(outcome: OwnerOutcome): Condition {
        val whiteWin = GAMES.RESULT.eq(GameResult.WHITE_WIN.name)
        val blackWin = GAMES.RESULT.eq(GameResult.BLACK_WIN.name)
        return when (outcome) {
            OwnerOutcome.WIN -> ownerIsWhite.and(whiteWin).or(ownerIsBlack.and(blackWin))
            OwnerOutcome.LOSS -> ownerIsWhite.and(blackWin).or(ownerIsBlack.and(whiteWin))
            OwnerOutcome.DRAW -> GAMES.RESULT.eq(GameResult.DRAW.name)
        }
    }

    private fun ratingCondition(band: RatingBand, basis: RatingBasis): Condition {
        // 기준 쪽 레이팅: 상대 = 소유자 반대편, 나 = 소유자 쪽. 소유자가 없으면 레이팅 조건에 걸리지 않음
        val (whenOwnerWhite, whenOwnerBlack) = when (basis) {
            RatingBasis.OPPONENT -> GAMES.BLACK_RATING to GAMES.WHITE_RATING
            RatingBasis.ME -> GAMES.WHITE_RATING to GAMES.BLACK_RATING
        }
        val rating: Field<Int?> = DSL.case_()
            .`when`(ownerIsWhite, whenOwnerWhite)
            .`when`(ownerIsBlack, whenOwnerBlack)
        val hasOwnerSide = ownerIsWhite.or(ownerIsBlack)
        if (band == RatingBand.UNRATED) return hasOwnerSide.and(rating.isNull)

        var condition = hasOwnerSide.and(rating.isNotNull)
        band.min?.let { condition = condition.and(rating.ge(it)) }
        band.max?.let { condition = condition.and(rating.le(it)) }
        return condition
    }

    private fun bindQuery(query: org.jooq.Query): DatabaseClient.GenericExecuteSpec {
        val sql = query.getSQL(ParamType.NAMED)
        var spec = databaseClient.sql(sql)
        query.params.entries.forEachIndexed { index, (_, param) ->
            // R2DBC Postgres 코덱은 jOOQ의 JSONB 타입을 직접 인코딩하지 못함 → R2DBC의 Json 으로 변환
            val value = when (val v = param.value!!) {
                is JSONB -> Json.of(v.data())
                else -> v
            }
            spec = spec.bind(index, value)
        }
        return spec
    }

    private suspend fun executeUpdate(query: org.jooq.Query) {
        bindQuery(query)
            .fetch()
            .rowsUpdated()
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

    private fun parseAnnotations(json: String): GameAnnotation =
        objectMapper.readValue(json, GameAnnotation::class.java)
}
