package org.raonpark.chessriend.game.domain

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import java.time.Instant
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class GameTest : DescribeSpec({

    val moves = listOf(
        Move(1, Color.WHITE, "e4", "fen1", 5.seconds, null),
        Move(1, Color.BLACK, "e5", "fen2", 3.seconds, null),
        Move(2, Color.WHITE, "Nf3", "fen3", 4.seconds, null),
        Move(2, Color.BLACK, "Nc6", "fen4", 2.seconds, null),
        Move(3, Color.WHITE, "Bb5", "fen5", 6.seconds, null),
    )

    val game = Game(
        id = 1L,
        source = GameSource.LICHESS,
        sourceGameId = "abc123",
        ownerUsername = "Magnus",
        players = Players(
            white = Player("Magnus", 2850),
            black = Player("Hikaru", 2800),
        ),
        moves = moves,
        result = GameResult.WHITE_WIN,
        timeControl = TimeControl(10.minutes, 0.seconds, TimeCategory.RAPID),
        opening = Opening("C65", "Ruy Lopez: Berlin Defense"),
        pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5",
        playedAt = Instant.parse("2026-04-10T12:00:00Z"),
        importedAt = Instant.parse("2026-04-10T13:00:00Z"),
    )

    describe("totalMoves") {
        it("전체 수의 개수를 반환") {
            game.totalMoves shouldBe 5
        }

        it("빈 게임은 0") {
            game.copy(moves = emptyList()).totalMoves shouldBe 0
        }
    }

    describe("lastPosition") {
        it("마지막 수의 FEN을 반환") {
            game.lastPosition shouldBe "fen5"
        }

        it("수가 없으면 null") {
            game.copy(moves = emptyList()).lastPosition shouldBe null
        }
    }

    describe("movesBy") {
        it("WHITE 수만 필터링") {
            val whiteMoves = game.movesBy(Color.WHITE)
            whiteMoves.size shouldBe 3
            whiteMoves.map { it.san } shouldBe listOf("e4", "Nf3", "Bb5")
        }

        it("BLACK 수만 필터링") {
            val blackMoves = game.movesBy(Color.BLACK)
            blackMoves.size shouldBe 2
            blackMoves.map { it.san } shouldBe listOf("e5", "Nc6")
        }
    }

    describe("moveAt") {
        it("특정 수번과 색으로 조회") {
            game.moveAt(2, Color.WHITE)?.san shouldBe "Nf3"
            game.moveAt(2, Color.BLACK)?.san shouldBe "Nc6"
        }

        it("존재하지 않는 수번은 null") {
            game.moveAt(10, Color.WHITE) shouldBe null
        }
    }
})
