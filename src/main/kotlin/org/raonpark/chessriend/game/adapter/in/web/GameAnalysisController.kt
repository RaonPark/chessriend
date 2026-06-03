package org.raonpark.chessriend.game.adapter.`in`.web

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import org.raonpark.chessriend.game.domain.analysis.AnalysisProgress
import org.raonpark.chessriend.game.port.`in`.GetGameAnalysisUseCase
import org.raonpark.chessriend.game.port.`in`.RunGameAnalysisUseCase
import org.raonpark.chessriend.game.port.`in`.SaveGameAnalysisUseCase
import org.springframework.http.MediaType
import org.springframework.http.codec.ServerSentEvent
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
    private val runGameAnalysisUseCase: RunGameAnalysisUseCase,
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

    /**
     * 백엔드 Stockfish 로 게임 전체를 분석하고 진행률/결과를 SSE 로 스트리밍.
     * - event: progress  data: { current, total }
     * - event: complete  data: GameAnalysisResponse
     */
    @GetMapping("/run", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun runAnalysis(@PathVariable gameId: Long): Flow<ServerSentEvent<Any>> =
        runGameAnalysisUseCase.runAnalysis(gameId).map { progress ->
            when (progress) {
                is AnalysisProgress.Progress -> sse(
                    "progress",
                    AnalysisProgressEvent(current = progress.current, total = progress.total),
                )

                is AnalysisProgress.Completed -> sse(
                    "complete",
                    GameAnalysisResponse.from(progress.analysis),
                )
            }
        }

    private fun sse(event: String, data: Any): ServerSentEvent<Any> =
        ServerSentEvent.builder<Any>().event(event).data(data).build()
}
