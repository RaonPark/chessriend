package org.raonpark.chessriend.game.adapter.`in`.web

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.shouldBe
import org.raonpark.chessriend.game.domain.BoardArrow
import org.raonpark.chessriend.game.domain.GameAnnotation
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.jacksonObjectMapper

class AnnotationDtoTest : DescribeSpec({

    describe("화살표 매핑") {
        it("요청의 메인라인/변형선 화살표가 도메인을 거쳐 응답까지 유지") {
            val request = AnnotationRequest(
                moveArrows = mapOf("3" to listOf(BoardArrowDto("e2", "e4", "#ffaa00"))),
                variations = listOf(
                    VariationRequest(
                        startMoveIndex = 2,
                        moves = listOf("Nf3"),
                        moveArrows = mapOf("0" to listOf(BoardArrowDto("g1", "f3", "#4caf50"))),
                    ),
                ),
            )

            val response = AnnotationResponse.from(request.toDomain())

            response.moveArrows["3"] shouldBe listOf(BoardArrowDto("e2", "e4", "#ffaa00"))
            response.variations[0].moveArrows["0"] shouldBe listOf(BoardArrowDto("g1", "f3", "#4caf50"))
        }

        it("빈 화살표 목록 키는 저장하지 않음") {
            val request = AnnotationRequest(moveArrows = mapOf("1" to emptyList()))
            request.toDomain().moveArrows.shouldBeEmpty()
        }
    }

    describe("기존 저장 데이터 호환") {
        val mapper: ObjectMapper = jacksonObjectMapper()

        it("moveArrows 필드가 없는 JSON도 읽힘") {
            val legacy = """{"moveComments":{"0":"hi"},"variations":[{"startMoveIndex":0,"moves":["e5"],"comment":""}]}"""
            val annotation = mapper.readValue(legacy, GameAnnotation::class.java)
            annotation.moveArrows.shouldBeEmpty()
            annotation.variations[0].moveArrows.shouldBeEmpty()
        }

        it("화살표가 JSON 왕복 후에도 유지") {
            val original = GameAnnotation(moveArrows = mapOf("-1" to listOf(BoardArrow("d2", "d4", "#f44336"))))
            val restored = mapper.readValue(mapper.writeValueAsString(original), GameAnnotation::class.java)
            restored shouldBe original
        }
    }

    describe("목록 응답의 분석 요약") {
        val game = org.raonpark.chessriend.game.domain.Game(
            id = 1L,
            source = org.raonpark.chessriend.game.domain.GameSource.LICHESS,
            sourceGameId = "x",
            ownerUsername = "alice",
            players = org.raonpark.chessriend.game.domain.Players(
                org.raonpark.chessriend.game.domain.Player("alice", 1500),
                org.raonpark.chessriend.game.domain.Player("bob", 1400),
            ),
            moves = emptyList(),
            result = org.raonpark.chessriend.game.domain.GameResult.WHITE_WIN,
            timeControl = org.raonpark.chessriend.game.domain.TimeControl(
                kotlin.time.Duration.parse("10m"), kotlin.time.Duration.ZERO,
                org.raonpark.chessriend.game.domain.TimeCategory.RAPID,
            ),
            opening = null,
            pgn = "",
            playedAt = java.time.Instant.parse("2026-10-01T00:00:00Z"),
            importedAt = java.time.Instant.parse("2026-10-01T00:00:00Z"),
        )

        it("분석이 없으면 analysisSummary는 null") {
            GameResponse.from(game).analysisSummary shouldBe null
        }

        it("분석 요약이 있으면 백·흑별로 담긴다") {
            val summary = org.raonpark.chessriend.game.domain.analysis.GameAnalysisSummary(
                depth = 18,
                white = org.raonpark.chessriend.game.domain.analysis.SideAnalysisSummary(0, 1, 2, 3, 42),
                black = org.raonpark.chessriend.game.domain.analysis.SideAnalysisSummary(1, 0, 0, 0, null),
            )

            val response = GameResponse.from(game, summary).analysisSummary!!

            response.depth shouldBe 18
            response.white shouldBe SideAnalysisSummaryResponse(brilliant = 0, blunder = 1, mistake = 2, inaccuracy = 3, acpl = 42)
            response.black.acpl shouldBe null
        }
    }
})
