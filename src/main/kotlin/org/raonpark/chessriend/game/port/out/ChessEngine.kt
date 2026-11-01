package org.raonpark.chessriend.game.port.out

import org.raonpark.chessriend.game.domain.analysis.PositionEval

/**
 * 체스 엔진(Stockfish) 평가 포트.
 *
 * 한 포지션(FEN)을 주어진 depth 로 평가하여 **백 관점**으로 정규화한 [PositionEval]
 * (1순위 평가 + 2순위 평가 + 최선수)을 돌려준다. 2순위는 MultiPV 로 얻으며 유일수 판정에 쓰인다.
 * 구현체(in-process 프로세스 풀)는 adapter/out/engine 에 위치하며, 추후 사이드카/원격 서비스로
 * 교체하더라도 이 포트는 불변이다.
 */
interface ChessEngine {
    suspend fun evaluate(fen: String, depth: Int): PositionEval
}
