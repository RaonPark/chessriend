package org.raonpark.chessriend.game.port.out

import org.raonpark.chessriend.game.domain.EvalScore

/**
 * 체스 엔진(Stockfish) 평가 포트.
 *
 * 한 포지션(FEN)을 주어진 depth 로 평가하여 **백 관점**으로 정규화한 [EvalScore]를 돌려준다.
 * 구현체(in-process 프로세스 풀)는 adapter/out/engine 에 위치하며, 추후 사이드카/원격 서비스로
 * 교체하더라도 이 포트는 불변이다.
 */
interface ChessEngine {
    suspend fun evaluate(fen: String, depth: Int): EvalScore
}
