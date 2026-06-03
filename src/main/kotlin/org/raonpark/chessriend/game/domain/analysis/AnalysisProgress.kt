package org.raonpark.chessriend.game.domain.analysis

import org.raonpark.chessriend.game.domain.GameAnalysisData

/**
 * 백엔드 분석 진행 상태. SSE 스트림으로 흘려보낸다.
 */
sealed interface AnalysisProgress {
    /** 포지션 평가 진행률. */
    data class Progress(val current: Int, val total: Int) : AnalysisProgress

    /** 분석 완료 + 저장된 결과. */
    data class Completed(val analysis: GameAnalysisData) : AnalysisProgress
}
