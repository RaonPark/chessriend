package org.raonpark.chessriend.game.domain.analysis

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.EvalScore

/**
 * 프론트 classification.test.ts 의 evalToCp/classifyMove/detectBrilliant 케이스를 1:1 포팅.
 */
class MoveClassifierTest : DescribeSpec({

    describe("evalToCp") {
        it("cp 값을 그대로 반환") {
            MoveClassifier.evalToCp(EvalScore(cp = 150, mate = null)) shouldBe 150
            MoveClassifier.evalToCp(EvalScore(cp = -200, mate = null)) shouldBe -200
            MoveClassifier.evalToCp(EvalScore(cp = 0, mate = null)) shouldBe 0
        }
        it("양수 mate-in-N → 높은 양수 cp") {
            MoveClassifier.evalToCp(EvalScore(cp = null, mate = 1)) shouldBe 9999
            MoveClassifier.evalToCp(EvalScore(cp = null, mate = 5)) shouldBe 9995
        }
        it("음수 mate-in-N → 높은 음수 cp") {
            MoveClassifier.evalToCp(EvalScore(cp = null, mate = -1)) shouldBe -9999
            MoveClassifier.evalToCp(EvalScore(cp = null, mate = -3)) shouldBe -9997
        }
        it("cp/mate 모두 null → 0") {
            MoveClassifier.evalToCp(EvalScore(cp = null, mate = null)) shouldBe 0
        }
    }

    describe("classifyMove") {
        it("30%p 이상 → blunder") {
            MoveClassifier.classifyMove(30.0) shouldBe "blunder"
            MoveClassifier.classifyMove(50.0) shouldBe "blunder"
        }
        it("20-30%p → mistake") {
            MoveClassifier.classifyMove(20.0) shouldBe "mistake"
            MoveClassifier.classifyMove(29.0) shouldBe "mistake"
        }
        it("10-20%p → inaccuracy") {
            MoveClassifier.classifyMove(10.0) shouldBe "inaccuracy"
            MoveClassifier.classifyMove(19.0) shouldBe "inaccuracy"
        }
        it("10%p 미만 → null") {
            MoveClassifier.classifyMove(0.0).shouldBeNull()
            MoveClassifier.classifyMove(9.0).shouldBeNull()
        }
    }

    describe("detectBrilliant") {
        it("포획 희생: 비싼 기물로 싼 기물 잡고 위험 위치 + winLoss 작음 → true") {
            MoveClassifier.detectBrilliant(0.0, PieceKind.BISHOP, PieceKind.PAWN, true) shouldBe true
            MoveClassifier.detectBrilliant(1.0, PieceKind.QUEEN, PieceKind.PAWN, true) shouldBe true
            MoveClassifier.detectBrilliant(1.0, PieceKind.ROOK, PieceKind.KNIGHT, true) shouldBe true
        }
        it("비-포획 공짜 희생 → true") {
            MoveClassifier.detectBrilliant(0.0, PieceKind.QUEEN, null, true) shouldBe true
            MoveClassifier.detectBrilliant(1.0, PieceKind.ROOK, null, true) shouldBe true
        }
        it("isAtRisk=false → false") {
            MoveClassifier.detectBrilliant(0.0, PieceKind.QUEEN, PieceKind.PAWN, false) shouldBe false
            MoveClassifier.detectBrilliant(0.0, PieceKind.QUEEN, null, false) shouldBe false
            MoveClassifier.detectBrilliant(1.0, PieceKind.ROOK, PieceKind.KNIGHT, false) shouldBe false
        }
        it("같은 가치/더 싼 기물로 포획 → false") {
            MoveClassifier.detectBrilliant(0.0, PieceKind.KNIGHT, PieceKind.BISHOP, true) shouldBe false
            MoveClassifier.detectBrilliant(0.0, PieceKind.PAWN, PieceKind.QUEEN, true) shouldBe false
        }
        it("winLoss tolerance(2) 이상 → false") {
            MoveClassifier.detectBrilliant(1.0, PieceKind.QUEEN, PieceKind.PAWN, true) shouldBe true
            MoveClassifier.detectBrilliant(2.0, PieceKind.QUEEN, PieceKind.PAWN, true) shouldBe false
            MoveClassifier.detectBrilliant(5.0, PieceKind.ROOK, null, true) shouldBe false
        }
    }
})
