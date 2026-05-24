package org.raonpark.chessriend.game.adapter.out.persistence

import io.r2dbc.postgresql.codec.Json
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.jooq.DSLContext
import org.jooq.JSONB
import org.jooq.conf.ParamType
import org.jooq.impl.DSL
import tools.jackson.databind.ObjectMapper
import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.domain.MoveEvaluationData
import org.raonpark.chessriend.game.port.out.GameAnalysisRepository
import org.raonpark.chessriend.jooq.tables.references.GAME_ANALYSES
import org.raonpark.chessriend.shared.id.SnowflakeIdGenerator
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.stereotype.Component
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset

@Component
class GameAnalysisPersistenceAdapter(
    private val databaseClient: DatabaseClient,
    private val dsl: DSLContext,
    private val snowflakeIdGenerator: SnowflakeIdGenerator,
    private val objectMapper: ObjectMapper,
) : GameAnalysisRepository {

    override suspend fun save(gameId: Long, analysis: GameAnalysisData): GameAnalysisData {
        val evalsJson = objectMapper.writeValueAsString(analysis.evaluations)
        val analyzedAt = Instant.parse(analysis.analyzedAt).atOffset(ZoneOffset.UTC)
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val newId = snowflakeIdGenerator.nextId()

        val query = dsl.insertInto(GAME_ANALYSES)
            .set(GAME_ANALYSES.ID, newId)
            .set(GAME_ANALYSES.GAME_ID, gameId)
            .set(GAME_ANALYSES.DEPTH, analysis.depth)
            .set(GAME_ANALYSES.ANALYZED_AT, analyzedAt)
            .set(GAME_ANALYSES.EVALUATIONS, JSONB.jsonb(evalsJson))
            .set(GAME_ANALYSES.CREATED_AT, now)
            .set(GAME_ANALYSES.UPDATED_AT, now)
            .onConflict(GAME_ANALYSES.GAME_ID)
            .doUpdate()
            .set(GAME_ANALYSES.DEPTH, analysis.depth)
            .set(GAME_ANALYSES.ANALYZED_AT, analyzedAt)
            .set(GAME_ANALYSES.EVALUATIONS, JSONB.jsonb(evalsJson))
            .set(GAME_ANALYSES.UPDATED_AT, now)

        executeUpdate(query)
        return analysis
    }

    override suspend fun findByGameId(gameId: Long): GameAnalysisData? {
        val query = dsl.select(DSL.asterisk())
            .from(GAME_ANALYSES)
            .where(GAME_ANALYSES.GAME_ID.eq(gameId))

        return bindQuery(query)
            .map { row, _ ->
                GameAnalysisData(
                    evaluations = parseEvaluations(row.get("evaluations", Json::class.java)!!.asString()),
                    depth = row.get("depth", Int::class.java)!!,
                    analyzedAt = row.get("analyzed_at", Instant::class.java)!!.toString(),
                )
            }
            .first()
            .awaitSingleOrNull()
    }

    override suspend fun existsByGameId(gameId: Long): Boolean {
        // selectOne()의 inline 1이 jOOQ params에 포함되면 R2DBC bind 인덱스와 어긋남 → ID 컬럼으로 대체
        val query = dsl.select(GAME_ANALYSES.ID)
            .from(GAME_ANALYSES)
            .where(GAME_ANALYSES.GAME_ID.eq(gameId))
            .limit(1)

        return bindQuery(query)
            .map { _, _ -> true }
            .first()
            .awaitSingleOrNull() == true
    }

    override suspend fun deleteByGameId(gameId: Long) {
        executeUpdate(dsl.deleteFrom(GAME_ANALYSES).where(GAME_ANALYSES.GAME_ID.eq(gameId)))
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

    private fun parseEvaluations(json: String): List<MoveEvaluationData> {
        val type = objectMapper.typeFactory
            .constructCollectionType(List::class.java, MoveEvaluationData::class.java)
        return objectMapper.readValue(json, type)
    }
}
