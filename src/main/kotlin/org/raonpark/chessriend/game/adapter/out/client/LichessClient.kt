package org.raonpark.chessriend.game.adapter.out.client

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.reactive.asFlow
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.ChessGameClient
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.raonpark.chessriend.shared.exception.ExternalApiException
import org.raonpark.chessriend.shared.exception.ExternalApiRateLimitException
import org.raonpark.chessriend.shared.exception.ExternalApiUserNotFoundException
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToFlux
import reactor.core.publisher.Mono
import java.time.Instant
import kotlin.time.Duration.Companion.seconds

@Component
@EnableConfigurationProperties(LichessConfig::class)
class LichessClient(
    private val lichessConfig: LichessConfig,
    private val objectMapper: ObjectMapper,
) : ChessGameClient {

    override val source: GameSource = GameSource.LICHESS

    private val webClient: WebClient by lazy {
        WebClient.builder()
            .baseUrl(lichessConfig.baseUrl)
            .apply {
                if (lichessConfig.token.isNotBlank()) {
                    it.defaultHeader("Authorization", "Bearer ${lichessConfig.token}")
                }
            }
            .build()
    }

    override fun fetchGames(criteria: GameFetchCriteria): Flow<Game> {
        return webClient.get()
            .uri { builder ->
                builder.path("/api/games/user/{username}")
                    .queryParamIfPresent("since", criteria.since?.toEpochMilli())
                    .queryParamIfPresent("until", criteria.until?.toEpochMilli())
                    .queryParamIfPresent("max", criteria.max)
                    .queryParamIfPresent("rated", criteria.rated)
                    .queryParamIfPresent("perfType", criteria.timeCategory?.toLichessPerfType())
                    .queryParamIfPresent("color", criteria.color?.name?.lowercase())
                    .queryParamIfPresent("vs", criteria.vs)
                    // 응답 형식: Adapter 내부 고정값
                    .queryParam("moves", true)
                    .queryParam("clocks", true)
                    .queryParam("opening", true)
                    .queryParam("pgnInJson", true)
                    .build(criteria.username)
            }
            .accept(MediaType.parseMediaType("application/x-ndjson"))
            .retrieve()
            .onStatus({ it == HttpStatus.TOO_MANY_REQUESTS }) { response ->
                response.createException().map { cause ->
                    val retryAfter = response.headers().header("Retry-After").firstOrNull()?.toLongOrNull()
                    ExternalApiRateLimitException("lichess", retryAfter) as Throwable
                }
            }
            .onStatus({ it == HttpStatus.NOT_FOUND }) {
                Mono.just(ExternalApiUserNotFoundException("lichess", criteria.username) as Throwable)
            }
            .onStatus({ it.is4xxClientError || it.is5xxServerError }) { response ->
                response.createException().map { cause ->
                    ExternalApiException("lichess API error: ${response.statusCode()}", cause) as Throwable
                }
            }
            .bodyToFlux<String>()
            .filter { it.isNotBlank() }
            .map { line -> parseGame(line) }
            .asFlow()
    }

    private fun parseGame(ndjsonLine: String): Game {
        val node = objectMapper.readTree(ndjsonLine)
        val players = node["players"]
        val clock = node["clock"]
        val opening = node["opening"]

        return Game(
            id = null,
            source = GameSource.LICHESS,
            sourceGameId = node["id"].textValue(),
            ownerUsername = "",
            players = Players(
                white = parsePlayer(players["white"]),
                black = parsePlayer(players["black"]),
            ),
            moves = parseMoves(node),
            result = parseResult(node["status"].textValue(), node["winner"]?.textValue()),
            timeControl = TimeControl(
                initialTime = (clock["initial"].longValue()).seconds,
                increment = (clock["increment"].longValue()).seconds,
                category = parseTimeCategory(node["speed"].textValue()),
            ),
            opening = opening?.let {
                Opening(
                    eco = it["eco"]?.textValue(),
                    name = it["name"]?.textValue() ?: "Unknown",
                )
            },
            pgn = node["pgn"]?.textValue() ?: "",
            playedAt = Instant.ofEpochMilli(node["createdAt"].longValue()),
            importedAt = Instant.now(),
        )
    }

    private fun parsePlayer(node: JsonNode): Player {
        val user = node["user"]
        return Player(
            name = user?.get("name")?.textValue() ?: "Anonymous",
            rating = node["rating"]?.intValue(),
        )
    }

    private fun parseMoves(gameNode: JsonNode): List<Move> {
        val movesStr = gameNode["moves"]?.textValue() ?: return emptyList()
        val sans = movesStr.split(" ").filter { it.isNotBlank() }
        val clocks: List<Long> = gameNode["clocks"]?.let { node ->
            buildList { node.forEach { add(it.longValue()) } }
        } ?: emptyList()

        // lichess clocks: [초기시간(centiseconds), 1수후 백 남은시간, 1수후 흑 남은시간, ...]
        val clockOffset = if (clocks.size > sans.size) 1 else 0

        return sans.mapIndexed { index, san ->
            val moveNumber = (index / 2) + 1
            val color = if (index % 2 == 0) Color.WHITE else Color.BLACK

            val timeSpent = if (clocks.size > index + clockOffset) {
                val currentClock = clocks[index + clockOffset]
                val previousClock = if (index >= 2) clocks[index + clockOffset - 2] else clocks.firstOrNull() ?: currentClock
                val spent = (previousClock - currentClock) / 100 // centiseconds → seconds
                if (spent >= 0) spent.seconds else null
            } else null

            Move(
                number = moveNumber,
                color = color,
                san = san,
                // TODO: 백엔드 체스 라이브러리 도입 후 실제 FEN 계산으로 교체
                fen = "",
                timeSpent = timeSpent,
                comment = null,
            )
        }
    }

    private fun parseResult(status: String, winner: String?): GameResult = when {
        winner == "white" -> GameResult.WHITE_WIN
        winner == "black" -> GameResult.BLACK_WIN
        status in listOf("draw", "stalemate") -> GameResult.DRAW
        status == "mate" -> if (winner == "white") GameResult.WHITE_WIN else GameResult.BLACK_WIN
        else -> GameResult.DRAW
    }

    private fun parseTimeCategory(speed: String): TimeCategory = when (speed) {
        "ultraBullet" -> TimeCategory.ULTRABULLET
        "bullet" -> TimeCategory.BULLET
        "blitz" -> TimeCategory.BLITZ
        "rapid" -> TimeCategory.RAPID
        "classical" -> TimeCategory.CLASSICAL
        "correspondence" -> TimeCategory.CORRESPONDENCE
        else -> TimeCategory.CLASSICAL
    }

    private fun TimeCategory.toLichessPerfType(): String = when (this) {
        TimeCategory.ULTRABULLET -> "ultraBullet"
        TimeCategory.BULLET -> "bullet"
        TimeCategory.BLITZ -> "blitz"
        TimeCategory.RAPID -> "rapid"
        TimeCategory.CLASSICAL -> "classical"
        TimeCategory.CORRESPONDENCE -> "correspondence"
    }

    private fun org.springframework.web.util.UriBuilder.queryParamIfPresent(
        name: String,
        value: Any?,
    ): org.springframework.web.util.UriBuilder {
        if (value != null) queryParam(name, value)
        return this
    }
}
