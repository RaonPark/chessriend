package org.raonpark.chessriend.game.domain

/**
 * PGN 문자열을 파싱한 중간 결과 (도메인 순수 값 객체).
 * 체스 라이브러리(chesslib) 타입이 도메인/애플리케이션으로 새지 않도록 어댑터가 이 형태로 변환한다.
 *
 * - [moves] 메인라인 수순(각 Move.fen 재구성 포함)
 * - [moveComments] 프론트 표시용 메인라인 코멘트 (key = 0-based ply 인덱스 문자열)
 * - [variations] 메인라인에서 분기하는 1단계 변형선 (중첩 변형선은 미포함)
 * - [hasSetup] [SetUp]/[FEN] 태그 존재 여부 (비표준 시작 포지션 → v1 미지원)
 */
data class ParsedPgn(
    val whiteName: String?,
    val whiteRating: Int?,
    val blackName: String?,
    val blackRating: Int?,
    val result: String,            // "1-0" / "0-1" / "1/2-1/2" / "*"
    val timeControl: String?,      // 예: "600+5", 없으면 null
    val eco: String?,
    val openingName: String?,
    val date: String?,             // 예: "2024.01.31", 불명이면 null
    val moves: List<Move>,
    val moveComments: Map<String, String>,
    val variations: List<Variation>,
    val hasSetup: Boolean,
)
