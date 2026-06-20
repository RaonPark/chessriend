package org.raonpark.chessriend.game.adapter.out.chess

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.Color
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

    describe("parsePgn") {
        val pgn = """
            [Event "Casual Game"]
            [White "Adolf Anderssen"]
            [Black "Jean Dufresne"]
            [Result "1-0"]
            [WhiteElo "2600"]
            [BlackElo "2500"]
            [TimeControl "600+5"]
            [ECO "C52"]
            [Opening "Evans Gambit"]

            1. e4 {best by test} e5 2. Nf3 Nc6 3. Bb5 (3. Bc4 {italian} Bc5 (3... Nf6 4. d3) 4. b4) 3... a6 4. Ba4 {post-var} Nf6 1-0
        """.trimIndent()

        it("태그(플레이어/레이팅/결과/시간/오프닝)를 추출한다") {
            val p = adapter.parsePgn(pgn)
            p.whiteName shouldBe "Adolf Anderssen"
            p.whiteRating shouldBe 2600
            p.blackName shouldBe "Jean Dufresne"
            p.blackRating shouldBe 2500
            p.result shouldBe "1-0"
            p.timeControl shouldBe "600+5"
            p.eco shouldBe "C52"
            p.openingName shouldBe "Evans Gambit"
            p.hasSetup shouldBe false
        }

        it("메인라인 수순과 각 수의 fen을 재구성한다") {
            val p = adapter.parsePgn(pgn)
            p.moves.map { it.san } shouldBe listOf("e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6")
            p.moves[0].color shouldBe Color.WHITE
            p.moves[1].color shouldBe Color.BLACK
            p.moves[0].fen.split(" ")[1] shouldBe "b" // e4 후 흑 차례
        }

        it("메인라인 코멘트를 ply 인덱스로 매핑한다(변형선 내부 코멘트는 메인에 섞이지 않음)") {
            val p = adapter.parsePgn(pgn)
            // e4(0) 뒤 코멘트, Ba4(6) 뒤 코멘트. 변형선 내 'italian'은 제외.
            p.moveComments["0"] shouldBe "best by test"
            p.moveComments["6"] shouldBe "post-var"
            p.moveComments.containsValue("italian") shouldBe false
        }

        it("1단계 변형선만 매핑하고 중첩은 생략한다") {
            val p = adapter.parsePgn(pgn)
            p.variations shouldHaveSize 1
            val v = p.variations.first()
            v.moves shouldBe listOf("Bc4", "Bc5", "b4")
            v.startMoveIndex shouldBe 3 // Bb5(index4) 대체 → 분기점은 Nc6(index3) 이후
        }

        it("[%clk] 등 엔진 주석은 코멘트에서 제거한다") {
            val withClk = """
                [White "A"]
                [Black "B"]
                [Result "*"]

                1. e4 { [%clk 0:09:58] } e5 *
            """.trimIndent()
            val p = adapter.parsePgn(withClk)
            p.moveComments.containsKey("0") shouldBe false // clk만 있던 코멘트는 제거되어 비어 누락
        }

        it("[SetUp]/[FEN] PGN은 hasSetup=true") {
            val setup = """
                [White "A"]
                [Black "B"]
                [Result "*"]
                [SetUp "1"]
                [FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"]

                1... e5 *
            """.trimIndent()
            adapter.parsePgn(setup).hasSetup shouldBe true
        }

        it("수가 없는 PGN은 예외") {
            shouldThrow<IllegalArgumentException> {
                adapter.parsePgn("""[White "A"]${"\n"}[Black "B"]${"\n"}[Result "*"]${"\n"}${"\n"}*""")
            }
        }
    }
})
