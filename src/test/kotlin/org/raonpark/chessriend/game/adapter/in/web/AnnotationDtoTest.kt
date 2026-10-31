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
})
