package org.raonpark.chessriend.game.adapter.out.chess

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.analysis.PieceKind

private const val START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

/**
 * chesslib 기반 희생 판정이 프론트 chess.js extractMoveContext 와 동등한지 검증.
 * 핵심 게이트: 그릭 기프트형 Bxf7+ (킹만 되잡는 비숍 희생) → isAtRisk.
 */
class ChesslibAdapterTest : DescribeSpec({

    val adapter = ChesslibAdapter()

    describe("reconstructFens") {
        it("시작 포지션 + 각 수 적용 후 FEN, 길이 = 수+1") {
            val fens = adapter.reconstructFens(listOf("e4", "e5", "Nf3"))
            fens.size shouldBe 4
            fens[0] shouldBe START_FEN
            fens[1].split(" ")[1] shouldBe "b" // e4 후 흑 차례
        }

        it("빈 수열 → 시작 포지션만") {
            adapter.reconstructFens(emptyList()).size shouldBe 1
        }
    }

    describe("analyzeMove 희생 판정") {
        it("Bxf7+ : 킹만 되잡는 비숍 희생(킹 0 < 비숍 3, 미방어) → isAtRisk") {
            val fens = adapter.reconstructFens(listOf("e4", "e5", "Bc4", "Nc6"))
            val ctx = adapter.analyzeMove(fens.last(), "Bxf7+")!!

            ctx.piece shouldBe PieceKind.BISHOP
            ctx.captured shouldBe PieceKind.PAWN
            ctx.isAtRisk shouldBe true
        }

        it("Nxe5 : 동가치 나이트에게만 공격받음(3<3 거짓) → isAtRisk=false") {
            val fens = adapter.reconstructFens(listOf("e4", "e5", "Nf3", "Nc6"))
            val ctx = adapter.analyzeMove(fens.last(), "Nxe5")!!

            ctx.piece shouldBe PieceKind.KNIGHT
            ctx.captured shouldBe PieceKind.PAWN
            ctx.isAtRisk shouldBe false
        }

        it("exd5 : 동가치 폰 포획 + 비위험 → isAtRisk=false") {
            val fens = adapter.reconstructFens(listOf("e4", "d5"))
            val ctx = adapter.analyzeMove(fens.last(), "exd5")!!

            ctx.captured shouldBe PieceKind.PAWN
            ctx.isAtRisk shouldBe false
        }

        it("잘못된 SAN → null") {
            adapter.analyzeMove(START_FEN, "Zz9").shouldBeNull()
        }
    }
})
