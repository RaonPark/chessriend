package org.raonpark.chessriend.game.application

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import org.raonpark.chessriend.game.adapter.out.engine.ChessEngineProperties
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.GameAnalysisData
import org.raonpark.chessriend.game.domain.analysis.AnalysisProgress
import org.raonpark.chessriend.game.domain.analysis.GameAnalyzer
import org.raonpark.chessriend.game.port.`in`.RunGameAnalysisUseCase
import org.raonpark.chessriend.game.port.out.ChessEngine
import org.raonpark.chessriend.game.port.out.ChessRules
import org.raonpark.chessriend.game.port.out.GameAnalysisRepository
import org.raonpark.chessriend.game.port.out.GameRepository
import org.raonpark.chessriend.shared.exception.GameNotFoundException
import org.springframework.stereotype.Service
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * 게임 전체 분석 오케스트레이션:
 * 1) 게임 조회 → 2) SAN 재생으로 FEN 재구성 → 3) 각 포지션 엔진 평가(진행률 emit) →
 * 4) 희생 컨텍스트 + 분류 계산 → 5) 저장 → 6) 완료 emit.
 */
@Service
class RunGameAnalysisService(
    private val gameRepository: GameRepository,
    private val chessEngine: ChessEngine,
    private val chessRules: ChessRules,
    private val gameAnalysisRepository: GameAnalysisRepository,
    private val engineProperties: ChessEngineProperties,
) : RunGameAnalysisUseCase {

    override fun runAnalysis(gameId: Long): Flow<AnalysisProgress> = flow {
        val game = gameRepository.findById(gameId) ?: throw GameNotFoundException(gameId)
        val depth = engineProperties.depth

        val sans = game.moves.map { it.san }
        val fens = chessRules.reconstructFens(sans)
        val total = fens.size
        if (fens.size < sans.size + 1) {
            log.warn { "SAN replay was partial: gameId=$gameId fens=${fens.size} moves=${sans.size}" }
        }

        val positionEvals = ArrayList<EvalScore>(total)
        for ((i, fen) in fens.withIndex()) {
            currentCoroutineContext().ensureActive()
            positionEvals += chessEngine.evaluate(fen, depth)
            emit(AnalysisProgress.Progress(current = i + 1, total = total))
        }

        // 희생 컨텍스트는 각 수의 직전 포지션(fens[i])에서 재판정 (프론트 extractMoveContext 와 동일)
        val contexts = game.moves.indices.map { i ->
            fens.getOrNull(i)?.let { fen -> chessRules.analyzeMove(fen, sans[i]) }
        }
        val evaluations = GameAnalyzer.computeClassifications(positionEvals, game.moves, contexts)

        val analysis = GameAnalysisData(
            evaluations = evaluations,
            depth = depth,
            analyzedAt = Instant.now().toString(),
        )
        gameAnalysisRepository.save(gameId, analysis)
        log.info { "game analysis computed: gameId=$gameId depth=$depth evals=${evaluations.size}" }

        emit(AnalysisProgress.Completed(analysis))
    }
}
