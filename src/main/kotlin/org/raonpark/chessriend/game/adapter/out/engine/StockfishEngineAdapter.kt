package org.raonpark.chessriend.game.adapter.out.engine

import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.port.out.ChessEngine
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.stereotype.Component

/**
 * [ChessEngine] 의 in-process Stockfish 구현. 평가를 [StockfishEnginePool] 에 위임한다.
 */
@Component
@EnableConfigurationProperties(ChessEngineProperties::class)
class StockfishEngineAdapter(
    private val pool: StockfishEnginePool,
    private val props: ChessEngineProperties,
) : ChessEngine {

    override suspend fun evaluate(fen: String, depth: Int): EvalScore =
        pool.borrow { proc -> proc.evaluate(fen, depth, props.perPositionTimeoutMs) }
}
