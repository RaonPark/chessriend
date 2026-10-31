package org.raonpark.chessriend.game.adapter.`in`.web

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webtestclient.autoconfigure.AutoConfigureWebTestClient
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import org.springframework.test.web.reactive.server.expectBody
import org.testcontainers.postgresql.PostgreSQLContainer
import java.util.UUID

/** 폴더 API 통합 테스트 (실제 서비스 + Testcontainers DB) */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
class FolderControllerTest {

    companion object {
        val postgres = PostgreSQLContainer("postgres:17").apply { start() }

        @DynamicPropertySource
        @JvmStatic
        fun configureProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.r2dbc.url") {
                "r2dbc:postgresql://${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}"
            }
            registry.add("spring.r2dbc.username") { postgres.username }
            registry.add("spring.r2dbc.password") { postgres.password }
            registry.add("spring.flyway.url") { postgres.jdbcUrl }
            registry.add("spring.flyway.user") { postgres.username }
            registry.add("spring.flyway.password") { postgres.password }
        }
    }

    @Autowired
    lateinit var webTestClient: WebTestClient

    private val tag = UUID.randomUUID().toString().take(6)

    private fun create(name: String): String {
        val body = webTestClient.post().uri("/api/folders")
            .bodyValue(mapOf("name" to name))
            .exchange()
            .expectStatus().isCreated
            .expectBody<Map<String, Any>>()
            .returnResult().responseBody!!
        return body["id"] as String
    }

    @Test
    fun `폴더를 만들면 201과 함께 정리된 이름·게임 수 0을 돌려주고 목록에 나온다`() {
        webTestClient.post().uri("/api/folders")
            .bodyValue(mapOf("name" to "  연구 $tag  "))
            .exchange()
            .expectStatus().isCreated
            .expectBody()
            .jsonPath("$.name").isEqualTo("연구 $tag")
            .jsonPath("$.gameCount").isEqualTo(0)

        webTestClient.get().uri("/api/folders")
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$[?(@.name == '연구 $tag')]").exists()
    }

    @Test
    fun `같은 이름이면 409, 빈 이름이면 400`() {
        create("중복 $tag")
        webTestClient.post().uri("/api/folders").bodyValue(mapOf("name" to "중복 $tag"))
            .exchange().expectStatus().isEqualTo(409)
        webTestClient.post().uri("/api/folders").bodyValue(mapOf("name" to "   "))
            .exchange().expectStatus().isBadRequest
    }

    @Test
    fun `이름 변경과 삭제, 없는 폴더는 404`() {
        val id = create("원래 $tag")

        webTestClient.patch().uri("/api/folders/$id").bodyValue(mapOf("name" to "새 $tag"))
            .exchange().expectStatus().isOk
            .expectBody().jsonPath("$.name").isEqualTo("새 $tag")

        webTestClient.delete().uri("/api/folders/$id").exchange().expectStatus().isNoContent
        webTestClient.delete().uri("/api/folders/$id").exchange().expectStatus().isNotFound
        webTestClient.post().uri("/api/folders/$id/games").bodyValue(listOf("1"))
            .exchange().expectStatus().isNotFound
    }
}
