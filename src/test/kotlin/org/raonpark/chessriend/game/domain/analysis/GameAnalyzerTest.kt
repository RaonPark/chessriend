package org.raonpark.chessriend.game.domain.analysis

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.Color
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.game.domain.Move

private fun move(color: Color, san: String) = Move(
    number = 1, color = color, san = san, fen = "", timeSpent = null, comment = null,
)

/**
 * 프론트 computeClassifications 케이스를 1:1 포팅(순수 — 희생 컨텍스트는 직접 주입).
 */
class GameAnalyzerTest : DescribeSpec({

    describe("computeClassifications") {
        it("각 수의 cpLoss 와 Win% 기반 classification 을 계산") {
            val moves = listOf(move(Color.WHITE, "e4"), move(Color.BLACK, "e5"), move(Color.WHITE, "Qh5"))
            val evals = listOf(
                EvalScore(20, null), EvalScore(15, null), EvalScore(50, null), EvalScore(-100, null),
            )
            val result = GameAnalyzer.computeClassifications(evals, moves, listOf(null, null, null))

            result shouldHaveSize 3
            result[0].cpLoss shouldBe 5
            result[0].classification.shouldBeNull()
            result[1].cpLoss shouldBe 35
            result[1].classification.shouldBeNull()
            result[2].cpLoss shouldBe 150
            result[2].classification shouldBe "inaccuracy" // 13.7%p
        }

        it("메이트 점수 전환을 처리(큰 손실 → blunder)") {
            val moves = listOf(move(Color.WHITE, "f3"))
            val evals = listOf(EvalScore(500, null), EvalScore(null, -2))
            val result = GameAnalyzer.computeClassifications(evals, moves, listOf(null))

            result[0].classification shouldBe "blunder"
        }

        it("좋은 수는 cpLoss 가 음수로 안 떨어지고 null") {
            val moves = listOf(move(Color.WHITE, "Nf3"))
            val evals = listOf(EvalScore(-50, null), EvalScore(100, null))
            val result = GameAnalyzer.computeClassifications(evals, moves, listOf(null))

            result[0].cpLoss shouldBe 0
            result[0].classification.shouldBeNull()
        }

        it("빈 수 목록 → 빈 결과") {
            GameAnalyzer.computeClassifications(listOf(EvalScore(0, null)), emptyList(), emptyList()) shouldHaveSize 0
        }

        it("희생 + 낮은 Win% 손실 + isAtRisk → brilliant 승격") {
            // Bxf7+ 형: +5.5 우세 유지(555→517, winLoss≈1.5%p), 비숍이 폰 잡고 위험 노출
            val moves = listOf(move(Color.WHITE, "Bxf7+"))
            val evals = listOf(EvalScore(555, null), EvalScore(517, null))
            val ctx = MoveContext(piece = PieceKind.BISHOP, captured = PieceKind.PAWN, isAtRisk = true)

            val result = GameAnalyzer.computeClassifications(evals, moves, listOf(ctx))

            result[0].cpLoss shouldBe 38
            result[0].classification shouldBe "brilliant"
        }

        it("큰 손실이 있는 희생은 brilliant 로 승격되지 않음") {
            val moves = listOf(move(Color.WHITE, "Nxe5"))
            val evals = listOf(EvalScore(20, null), EvalScore(-800, null))
            val ctx = MoveContext(piece = PieceKind.KNIGHT, captured = PieceKind.PAWN, isAtRisk = true)

            val result = GameAnalyzer.computeClassifications(evals, moves, listOf(ctx))

            result[0].classification shouldBe "blunder"
        }
    }
})
