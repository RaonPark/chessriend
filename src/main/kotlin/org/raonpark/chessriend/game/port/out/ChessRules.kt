package org.raonpark.chessriend.game.port.out

import org.raonpark.chessriend.game.domain.analysis.MoveContext

/**
 * 체스 규칙 처리 포트 — SAN 재생을 통한 FEN 재구성 + 희생 판정.
 * 도메인을 체스 라이브러리(chesslib)로부터 격리한다. 구현은 adapter/out/chess.
 */
interface ChessRules {
    /**
     * 시작 포지션부터 SAN 수열을 재생하여 각 포지션 FEN 목록을 반환.
     * 정상 재생 시 반환 길이 = sans.size + 1 (index 0 = 시작 포지션, index i+1 = sans[i] 적용 후).
     * 잘못된 수를 만나면 그 지점까지만 재생한 부분 목록을 반환한다.
     */
    fun reconstructFens(sans: List<String>): List<String>

    /**
     * [fenBefore] 에서 [san] 을 두었을 때의 희생 컨텍스트.
     * 파싱/적용 실패 시 null.
     */
    fun analyzeMove(fenBefore: String, san: String): MoveContext?
}
