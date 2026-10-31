package org.raonpark.chessriend.game.adapter.out.persistence

import io.r2dbc.postgresql.codec.Json
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.jooq.DSLContext
import org.jooq.JSONB
import org.jooq.conf.ParamType
import org.jooq.impl.DSL
import org.raonpark.chessriend.game.domain.Folder
import org.raonpark.chessriend.game.domain.FolderSummary
import org.raonpark.chessriend.game.port.out.FolderRepository
import org.raonpark.chessriend.jooq.tables.references.FOLDERS
import org.raonpark.chessriend.jooq.tables.references.GAMES
import org.raonpark.chessriend.jooq.tables.references.GAME_FOLDERS
import org.raonpark.chessriend.shared.exception.DuplicateFolderNameException
import org.raonpark.chessriend.shared.id.SnowflakeIdGenerator
import org.springframework.dao.DuplicateKeyException
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.stereotype.Component
import java.time.OffsetDateTime
import java.time.ZoneOffset

@Component
class FolderPersistenceAdapter(
    private val databaseClient: DatabaseClient,
    private val dsl: DSLContext,
    private val snowflakeIdGenerator: SnowflakeIdGenerator,
) : FolderRepository {

    override suspend fun insert(folder: Folder): Folder {
        val id = snowflakeIdGenerator.nextId()
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val query = dsl.insertInto(FOLDERS)
            .set(FOLDERS.ID, id)
            .set(FOLDERS.NAME, folder.name)
            .set(FOLDERS.CREATED_AT, now)
            .set(FOLDERS.UPDATED_AT, now)
        try {
            executeUpdate(query)
        } catch (e: DuplicateKeyException) {
            // 서비스의 사전 검사와 동시에 들어온 요청 → 유니크 제약으로 걸러짐
            throw DuplicateFolderNameException(folder.name)
        }
        return folder.copy(id = id)
    }

    override suspend fun findById(id: Long): Folder? =
        bindQuery(dsl.select(FOLDERS.ID, FOLDERS.NAME).from(FOLDERS).where(FOLDERS.ID.eq(id)))
            .map { row, _ -> Folder(row.get("id", Long::class.java)!!, row.get("name", String::class.java)!!) }
            .first()
            .awaitSingleOrNull()

    override suspend fun existsByName(name: String, excludeId: Long?): Boolean {
        var condition = FOLDERS.NAME.eq(name)
        excludeId?.let { condition = condition.and(FOLDERS.ID.ne(it)) }
        return bindQuery(dsl.select(FOLDERS.ID).from(FOLDERS).where(condition).limit(1))
            .map { _, _ -> true }
            .first()
            .awaitSingleOrNull() == true
    }

    override suspend fun findAllWithCounts(): List<FolderSummary> {
        val gameCount = DSL.count(GAME_FOLDERS.GAME_ID).`as`("game_count")
        val query = dsl.select(FOLDERS.ID, FOLDERS.NAME, gameCount)
            .from(FOLDERS)
            .leftJoin(GAME_FOLDERS).on(GAME_FOLDERS.FOLDER_ID.eq(FOLDERS.ID))
            .groupBy(FOLDERS.ID, FOLDERS.NAME, FOLDERS.CREATED_AT)
            .orderBy(FOLDERS.CREATED_AT.asc(), FOLDERS.ID.asc())
        return bindQuery(query)
            .map { row, _ ->
                FolderSummary(
                    folder = Folder(row.get("id", Long::class.java)!!, row.get("name", String::class.java)!!),
                    gameCount = row.get("game_count", Long::class.java)!!,
                )
            }
            .all()
            .collectList()
            .awaitSingle()
    }

    override suspend fun rename(id: Long, name: String) {
        val query = dsl.update(FOLDERS)
            .set(FOLDERS.NAME, name)
            .set(FOLDERS.UPDATED_AT, OffsetDateTime.now(ZoneOffset.UTC))
            .where(FOLDERS.ID.eq(id))
        try {
            executeUpdate(query)
        } catch (e: DuplicateKeyException) {
            throw DuplicateFolderNameException(name)
        }
    }

    override suspend fun delete(id: Long) {
        executeUpdate(dsl.deleteFrom(FOLDERS).where(FOLDERS.ID.eq(id)))
    }

    override suspend fun addGames(folderId: Long, gameIds: List<Long>) {
        if (gameIds.isEmpty()) return
        // 존재하는 게임만 골라 넣고(FK 위반 방지), 이미 들어 있으면 무시
        val query = dsl.insertInto(GAME_FOLDERS, GAME_FOLDERS.GAME_ID, GAME_FOLDERS.FOLDER_ID)
            .select(
                dsl.select(GAMES.ID, DSL.`val`(folderId))
                    .from(GAMES)
                    .where(GAMES.ID.`in`(gameIds)),
            )
            .onConflictDoNothing()
        executeUpdate(query)
    }

    override suspend fun removeGames(folderId: Long, gameIds: List<Long>) {
        if (gameIds.isEmpty()) return
        executeUpdate(
            dsl.deleteFrom(GAME_FOLDERS)
                .where(GAME_FOLDERS.FOLDER_ID.eq(folderId))
                .and(GAME_FOLDERS.GAME_ID.`in`(gameIds)),
        )
    }

    override suspend fun findFoldersByGameIds(gameIds: List<Long>): Map<Long, List<Folder>> {
        if (gameIds.isEmpty()) return emptyMap()
        val query = dsl.select(GAME_FOLDERS.GAME_ID, FOLDERS.ID, FOLDERS.NAME)
            .from(GAME_FOLDERS)
            .join(FOLDERS).on(FOLDERS.ID.eq(GAME_FOLDERS.FOLDER_ID))
            .where(GAME_FOLDERS.GAME_ID.`in`(gameIds))
            .orderBy(FOLDERS.CREATED_AT.asc(), FOLDERS.ID.asc())
        return bindQuery(query)
            .map { row, _ ->
                row.get("game_id", Long::class.java)!! to
                    Folder(row.get("id", Long::class.java)!!, row.get("name", String::class.java)!!)
            }
            .all()
            .collectList()
            .awaitSingle()
            .groupBy({ it.first }, { it.second })
    }

    private fun bindQuery(query: org.jooq.Query): DatabaseClient.GenericExecuteSpec {
        var spec = databaseClient.sql(query.getSQL(ParamType.NAMED))
        query.params.entries.forEachIndexed { index, (_, param) ->
            val value = when (val v = param.value!!) {
                is JSONB -> Json.of(v.data())
                else -> v
            }
            spec = spec.bind(index, value)
        }
        return spec
    }

    private suspend fun executeUpdate(query: org.jooq.Query) {
        bindQuery(query).fetch().rowsUpdated().awaitSingle()
    }
}
