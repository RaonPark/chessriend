package org.raonpark.chessriend.game.domain.analysis

/**
 * 분류 로직에서 쓰는 기물 종류(도메인 전용, 외부 라이브러리와 무관).
 */
enum class PieceKind {
    PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING
}

/**
 * 한 수의 희생 판정 컨텍스트 (프론트 classification.ts 의 MoveContext 대응).
 *
 * @property piece 이동한 기물
 * @property captured 포획한 기물 (없으면 null)
 * @property isAtRisk 이동 후 기물이 방어 없이, 더 싼 적 기물(킹=0)에게 잡힐 위치에 놓였는지
 */
data class MoveContext(
    val piece: PieceKind,
    val captured: PieceKind?,
    val isAtRisk: Boolean,
)
