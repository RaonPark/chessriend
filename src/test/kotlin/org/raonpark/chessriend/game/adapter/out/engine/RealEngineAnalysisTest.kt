package org.raonpark.chessriend.game.adapter.out.engine

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.raonpark.chessriend.game.adapter.out.chess.ChesslibAdapter
import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.Move
import org.raonpark.chessriend.game.domain.analysis.GameAnalyzer
import java.io.File

/**
 * 실제 Stockfish 바이너리로 게임 전체를 분석하는 수용(acceptance) 테스트.
 *
 * 기본 비활성 — `RUN_ENGINE_TEST` 환경변수가 있고 stockfish 실행 파일이 존재할 때만 동작.
 * 실행: `RUN_ENGINE_TEST=1 ./gradlew test --tests "*RealEngineAnalysisTest"`
 *
 * 게이트: 경기 284447503368060928 의 11.Bxf7+(index 20)가 depth 18 에서 Brilliant 여야 한다
 * (백엔드 chesslib 희생 판정 + 네이티브 엔진이 프론트 결과와 동등함을 검증).
 */
class RealEngineAnalysisTest : DescribeSpec({

    val enginePath = System.getenv("CHESS_ENGINE_PATH") ?: "/opt/homebrew/bin/stockfish"
    val enabled = System.getenv("RUN_ENGINE_TEST") != null && File(enginePath).canExecute()

    // 경기 284447503368060928 의 SAN 수열 (39수)
    val sans = listOf(
        "e4", "e5", "Nc3", "Nf6", "f4", "Nc6", "fxe5", "Nxe5", "d4", "Nc6",
        "e5", "Ng8", "Nf3", "Bb4", "Bc4", "Bxc3+", "bxc3", "d6", "O-O", "dxe5",
        "Bxf7+", "Kxf7", "Ng5+", "Ke8", "Qf3", "Nf6", "Ne4", "Bg4", "Nxf6+", "Qxf6",
        "Qxg4", "Qd6", "Qxg7", "Rf8", "Bh6", "exd4", "Rxf8+", "Qxf8", "Qxf8+",
    )

    val moves = sans.mapIndexed { i, san ->
        Move(
            number = i / 2 + 1,
            color = if (i % 2 == 0) Color.WHITE else Color.BLACK,
            san = san, fen = "", timeSpent = null, comment = null,
        )
    }

    describe("실제 엔진 전체 분석") {
        it("11.Bxf7+(index 20)가 depth 18 에서 brilliant").config(enabled = enabled) {
            val props = ChessEngineProperties(path = enginePath, depth = 18, threads = 1, poolSize = 4)
            val pool = StockfishEnginePool(props)
            val engine = StockfishEngineAdapter(pool, props)
            val rules = ChesslibAdapter()

            try {
                runBlocking {
                    val fens = rules.reconstructFens(sans)
                    fens.size shouldBe sans.size + 1

                    val evals = coroutineScope {
                        fens.map { fen -> async { engine.evaluate(fen, props.depth) } }.awaitAll()
                    }
                    val contexts = sans.indices.map { i -> rules.analyzeMove(fens[i], sans[i]) }
                    val result = GameAnalyzer.computeClassifications(evals, moves, contexts)

                    result[20].classification shouldBe "brilliant"
                    // 오탐 점검: brilliant 는 1개여야
                    result.count { it.classification == "brilliant" } shouldBe 1
                }
            } finally {
                pool.destroy()
            }
        }
    }
})
