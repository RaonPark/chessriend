package org.raonpark.chessriend.game.adapter.out.engine

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 백엔드 Stockfish 엔진 설정.
 *
 * - [path]: stockfish 실행 파일 경로 (dev: brew, prod: 컨테이너 내 설치 경로)
 * - [depth]: 분석 깊이. 프론트 constants.ts `ANALYSIS_DEPTH`(18)와 lockstep.
 * - [threads]/[hashMb]: 프로세스당 UCI 옵션. 프로세스 풀 방식이라 보통 Threads=1.
 * - [poolSize]: 동시 탐색 가능한 프로세스 수.
 * - [perPositionTimeoutMs]: 한 포지션 `go depth` 타임아웃.
 */
@ConfigurationProperties(prefix = "chess.engine")
data class ChessEngineProperties(
    val path: String = "/opt/homebrew/bin/stockfish",
    val depth: Int = 18,
    val threads: Int = 1,
    val hashMb: Int = 128,
    val poolSize: Int = 2,
    val perPositionTimeoutMs: Long = 15_000,
)
