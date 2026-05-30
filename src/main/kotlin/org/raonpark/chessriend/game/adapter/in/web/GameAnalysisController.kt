package org.raonpark.chessriend.game.adapter.`in`.web

import org.raonpark.chessriend.game.port.`in`.GetGameAnalysisUseCase
import org.raonpark.chessriend.game.port.`in`.SaveGameAnalysisUseCase
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/games/{gameId}/analysis")
class GameAnalysisController(
    private val saveGameAnalysisUseCase: SaveGameAnalysisUseCase,
    private val getGameAnalysisUseCase: GetGameAnalysisUseCase,
) {

    @PostMapping
    suspend fun saveAnalysis(
        @PathVariable gameId: Long,
        @RequestBody request: GameAnalysisRequest,
    ): GameAnalysisResponse =
        GameAnalysisResponse.from(saveGameAnalysisUseCase.saveAnalysis(gameId, request.toDomain()))

    @GetMapping
    suspend fun getAnalysis(@PathVariable gameId: Long): GameAnalysisResponse =
        GameAnalysisResponse.from(getGameAnalysisUseCase.getAnalysis(gameId))
}
