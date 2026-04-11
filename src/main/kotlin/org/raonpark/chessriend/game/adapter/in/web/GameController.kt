package org.raonpark.chessriend.game.adapter.`in`.web

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.domain.TimeCategory
import org.raonpark.chessriend.game.port.`in`.GetGameUseCase
import org.raonpark.chessriend.game.port.`in`.ImportGameUseCase
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.*
import java.time.Instant

@RestController
@RequestMapping("/api/games")
class GameController(
    private val importGameUseCase: ImportGameUseCase,
    private val getGameUseCase: GetGameUseCase,
) {

    @GetMapping
    suspend fun getGames(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
        @RequestParam(required = false) source: GameSource?,
        @RequestParam(required = false) timeCategory: TimeCategory?,
    ): PagedGameResponse {
        val result = getGameUseCase.getGames(page, size, source, timeCategory)
        return PagedGameResponse(
            content = result.content.map { GameResponse.from(it) },
            page = result.page,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
            hasNext = result.hasNext,
            hasPrevious = result.hasPrevious,
        )
    }

    @GetMapping("/{id}")
    suspend fun getGame(@PathVariable id: Long): GameResponse {
        val game = getGameUseCase.getGame(id)
        return GameResponse.from(game)
    }

    @DeleteMapping("/{id}")
    suspend fun deleteGame(@PathVariable id: Long) {
        getGameUseCase.deleteGame(id)
    }

    @DeleteMapping("/batch")
    suspend fun deleteGames(@RequestBody ids: List<Long>) {
        getGameUseCase.deleteGames(ids)
    }

    @DeleteMapping("/all")
    suspend fun deleteAllGames() {
        getGameUseCase.deleteAllGames()
    }

    @GetMapping("/import", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun importGames(
        @RequestParam source: GameSource,
        @RequestParam username: String,
        @RequestParam(required = false) since: Instant?,
        @RequestParam(required = false) until: Instant?,
        @RequestParam(required = false) max: Int?,
        @RequestParam(required = false) timeCategory: TimeCategory?,
        @RequestParam(required = false) rated: Boolean?,
        @RequestParam(required = false) color: Color?,
        @RequestParam(required = false) vs: String?,
    ): Flow<GameResponse> {
        val criteria = GameFetchCriteria(
            username = username,
            since = since,
            until = until,
            max = max,
            timeCategory = timeCategory,
            rated = rated,
            color = color,
            vs = vs,
        )

        return importGameUseCase.importGames(source, criteria)
            .map { game -> GameResponse.from(game) }
    }
}
