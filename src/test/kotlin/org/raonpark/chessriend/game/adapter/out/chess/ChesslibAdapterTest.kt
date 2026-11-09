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

        it("Nxe5 : 나이트를 주고 폰 하나(순손실 2) → isAtRisk") {
            val fens = adapter.reconstructFens(listOf("e4", "e5", "Nf3", "Nc6"))
            val ctx = adapter.analyzeMove(fens.last(), "Nxe5")!!

            ctx.piece shouldBe PieceKind.KNIGHT
            ctx.captured shouldBe PieceKind.PAWN
            ctx.isAtRisk shouldBe true
        }

        it("exd5 : 동가치 폰 포획 + 비위험 → isAtRisk=false") {
            val fens = adapter.reconstructFens(listOf("e4", "d5"))
            val ctx = adapter.analyzeMove(fens.last(), "exd5")!!

            ctx.captured shouldBe PieceKind.PAWN
            ctx.isAtRisk shouldBe false
        }

        // 실제 경기 342145170189320192의 29.Qxh5: g6 폰이 Rg2-g6-Kg7로 킹에 핀 → 퀸을 잡을 수 없다
        it("Qxh5 : 노리는 폰이 킹에 핀되어 합법적으로 잡을 수 없음 → isAtRisk=false") {
            val ctx = adapter.analyzeMove("r3r3/p4pkp/4p1p1/1p4Qn/2pq4/5P2/PPP1B1R1/1K4R1 w - - 0 29", "Qxh5")!!

            ctx.piece shouldBe PieceKind.QUEEN
            ctx.captured shouldBe PieceKind.KNIGHT
            ctx.isAtRisk shouldBe false
        }

        it("Qxh5 : 같은 포지션에서 핀이 없으면(룩 제거) 폰이 퀸을 잡음 → isAtRisk") {
            val ctx = adapter.analyzeMove("r3r3/p4pkp/4p1p1/1p4Qn/2pq4/5P2/PPP1B3/1K6 w - - 0 29", "Qxh5")!!
            ctx.isAtRisk shouldBe true
        }

        it("Nd5 : 폰이 지켜도 더 싼 폰에게 잡혀 순손실 2(3-1) → isAtRisk (방어돼도 교환에서 손해)") {
            val ctx = adapter.analyzeMove("6k1/8/2p5/8/4PN2/8/8/6K1 w - - 0 1", "Nd5")!!
            ctx.isAtRisk shouldBe true
        }

        it("Nd5 : 같은 가치(나이트)에게만 노출되고 폰이 지킴 → 교환하면 본전 → isAtRisk=false") {
            val ctx = adapter.analyzeMove("6k1/8/1n6/8/4PN2/8/8/6K1 w - - 0 1", "Nd5")!!
            ctx.isAtRisk shouldBe false
        }

        it("f4 : 폰 희생(순손실 1)은 희생으로 보지 않음 (갬빗이 브릴리언트로 쏟아지지 않게)") {
            val fens = adapter.reconstructFens(listOf("e4", "e5"))
            adapter.analyzeMove(fens.last(), "f4")!!.isAtRisk shouldBe false
        }

        it("킹은 지켜지는 기물을 잡을 수 없음 → 킹만 노리고 방어된 비숍은 희생 아님") {
            // 백 비숍 f7(폰 g6이 지킴)을 흑 킹 g8만 노림
            val ctx = adapter.analyzeMove("6k1/8/6P1/8/2B5/8/8/6K1 w - - 0 1", "Bf7+")!!
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
            p.event shouldBe "Casual Game"
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
