package org.raonpark.chessriend.game.adapter.`in`.web

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.domain.TimeCategory
import org.raonpark.chessriend.game.port.`in`.ImportGameUseCase
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.*
import java.time.Instant

@RestController
@RequestMapping("/api/games")
class GameController(
    private val importGameUseCase: ImportGameUseCase,
) {

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
