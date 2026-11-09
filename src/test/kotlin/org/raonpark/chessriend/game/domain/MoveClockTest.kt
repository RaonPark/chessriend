package org.raonpark.chessriend.game.domain

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import java.time.Instant
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class MoveClockTest : DescribeSpec({

    describe("PgnClocks.parseMainline") {
        it("chess.com 형식(소수점 포함)을 수 순서대로 읽는다") {
            val pgn = """
                [Event "Live Chess"]
                [TimeControl "300"]

                1. e4 {[%clk 0:04:59.9]} 1... e5 {[%clk 0:04:58.5]} 2. Nf3 {[%clk 0:04:42.1]} 1-0
            """.trimIndent()

            PgnClocks.parseMainline(pgn) shouldBe listOf(
                4.minutes + 59.seconds + 900.milliseconds,
                4.minutes + 58.seconds + 500.milliseconds,
                4.minutes + 42.seconds + 100.milliseconds,
            )
        }

        it("lichess 형식(초 단위, 코멘트 앞뒤 공백)을 읽는다") {
            val pgn = "1. d4 { [%clk 0:09:58] } 1... d5 { [%clk 0:09:57] } *"
            PgnClocks.parseMainline(pgn) shouldBe listOf(9.minutes + 58.seconds, 9.minutes + 57.seconds)
        }

        it("변형선 안의 시계와 수는 건너뛴다") {
            val pgn = "1. e4 {[%clk 0:03:00]} (1. d4 {[%clk 0:02:00]} d5) 1... e5 {[%clk 0:02:59]} 1-0"
            PgnClocks.parseMainline(pgn) shouldBe listOf(3.minutes, 2.minutes + 59.seconds)
        }

        it("시계가 없는 수는 null, 시계 아닌 코멘트·NAG는 무시") {
            val pgn = "1. e4 \$1 {좋은 수} 1... e5 {[%clk 0:01:00]} 2. Nf3 1/2-1/2"
            PgnClocks.parseMainline(pgn) shouldBe listOf(null, 1.minutes, null)
        }

        it("수 번호가 붙어 있는 토큰(1.e4)도 수로 센다") {
            PgnClocks.parseMainline("1.e4 {[%clk 0:00:30]} e5 {[%clk 0:00:29]}") shouldBe
                listOf(30.seconds, 29.seconds)
        }

        it("1시간 이상도 읽는다") {
            PgnClocks.parseMainline("1. e4 {[%clk 1:29:58]}") shouldBe listOf(1.minutes * 89 + 58.seconds)
        }
    }

    describe("Game.moveClocks") {
        fun game(pgn: String, moveCount: Int, initial: Duration = 3.minutes, increment: Duration = 2.seconds) = Game(
            id = 1L,
            source = GameSource.CHESS_COM,
            sourceGameId = "x",
            ownerUsername = "alice",
            players = Players(Player("alice", 1500), Player("bob", 1400)),
            moves = List(moveCount) { i ->
                Move(number = i / 2 + 1, color = if (i % 2 == 0) Color.WHITE else Color.BLACK, san = "m$i", fen = "", timeSpent = null, comment = null)
            },
            result = GameResult.WHITE_WIN,
            timeControl = TimeControl(initial, increment, TimeCategory.BLITZ),
            opening = null,
            pgn = pgn,
            playedAt = Instant.parse("2026-10-01T00:00:00Z"),
            importedAt = Instant.parse("2026-10-01T00:00:00Z"),
        )

        it("쓴 시간 = 직전 내 시계(첫 수는 초기 시간) − 남은 시계 + 증가 시간") {
            val pgn = "1. e4 {[%clk 0:03:01]} e5 {[%clk 0:02:55]} 2. Nf3 {[%clk 0:02:50]} Nc6 {[%clk 0:02:57]}"
            game(pgn, 4).moveClocks() shouldBe listOf(
                MoveClock(remaining = 3.minutes + 1.seconds, spent = 1.seconds),   // 3:00 - 3:01 + 2
                MoveClock(remaining = 2.minutes + 55.seconds, spent = 7.seconds),  // 3:00 - 2:55 + 2
                MoveClock(remaining = 2.minutes + 50.seconds, spent = 13.seconds), // 3:01 - 2:50 + 2
                MoveClock(remaining = 2.minutes + 57.seconds, spent = Duration.ZERO), // 2:55 - 2:57 + 2
            )
        }

        it("쓴 시간이 음수로 계산되면 0으로 자른다") {
            val pgn = "1. e4 {[%clk 0:03:10]}"
            game(pgn, 1, increment = Duration.ZERO).moveClocks() shouldBe
                listOf(MoveClock(remaining = 3.minutes + 10.seconds, spent = Duration.ZERO))
        }

        it("초기 시간을 모르면 첫 두 수의 쓴 시간은 null") {
            val pgn = "1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:59]} 2. Nf3 {[%clk 0:02:58]}"
            game(pgn, 3, initial = Duration.ZERO, increment = Duration.ZERO).moveClocks() shouldBe listOf(
                MoveClock(3.minutes, null),
                MoveClock(2.minutes + 59.seconds, null),
                MoveClock(2.minutes + 58.seconds, 2.seconds),
            )
        }

        it("시계 개수가 수 개수와 다르면 모두 null (틀린 값을 보여주지 않음)") {
            val pgn = "1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:59]}"
            game(pgn, 3).moveClocks() shouldBe listOf(null, null, null)
        }

        it("PGN에 시계가 전혀 없으면 모두 null") {
            game("1. e4 e5 2. Nf3", 3).moveClocks() shouldBe listOf(null, null, null)
        }
    }
})
