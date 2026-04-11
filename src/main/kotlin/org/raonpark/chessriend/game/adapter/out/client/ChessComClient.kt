package org.raonpark.chessriend.game.adapter.out.client

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.raonpark.chessriend.game.domain.*
import org.raonpark.chessriend.game.port.out.ChessGameClient
import org.raonpark.chessriend.game.port.out.GameFetchCriteria
import org.raonpark.chessriend.shared.exception.ExternalApiException
import org.raonpark.chessriend.shared.exception.ExternalApiRateLimitException
import org.raonpark.chessriend.shared.exception.ExternalApiUserNotFoundException
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import reactor.core.publisher.Mono
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneOffset
import kotlin.time.Duration.Companion.seconds

@Component
@EnableConfigurationProperties(ChessComConfig::class)
class ChessComClient(
    private val chessComConfig: ChessComConfig,
    private val objectMapper: ObjectMapper,
) : ChessGameClient {

    override val source: GameSource = GameSource.CHESS_COM

    private val webClient: WebClient by lazy {
        WebClient.builder()
            .baseUrl(chessComConfig.baseUrl)
            .defaultHeader("User-Agent", chessComConfig.userAgent)
            .build()
    }

    override fun fetchGames(criteria: GameFetchCriteria): Flow<Game> = flow {
        val archiveUrls = fetchArchiveUrls(criteria.username)

        // 최신 월부터 조회하기 위해 역순 정렬
        val filtered = filterArchivesByDate(archiveUrls, criteria.since, criteria.until).reversed()

        var emitted = 0
        for (url in filtered) {
            if (criteria.max != null && emitted >= criteria.max) break

            val games = fetchMonthlyGames(url)
            for (gameNode in games) {
                if (criteria.max != null && emitted >= criteria.max) break
                if (!matchesCriteria(gameNode, criteria)) continue

                val game = parseGame(gameNode)
                emit(game)
                emitted++
            }
        }
    }

    private suspend fun fetchArchiveUrls(username: String): List<String> {
        val body = webClient.get()
            .uri("/pub/player/{username}/games/archives", username)
            .retrieve()
            .onStatus({ it == HttpStatus.TOO_MANY_REQUESTS }) {
                Mono.just(ExternalApiRateLimitException("chess.com") as Throwable)
            }
            .onStatus({ it == HttpStatus.NOT_FOUND }) {
                Mono.just(ExternalApiUserNotFoundException("chess.com", username) as Throwable)
            }
            .onStatus({ it.is4xxClientError || it.is5xxServerError }) { response ->
                response.createException().map { cause ->
                    ExternalApiException("chess.com API error: ${response.statusCode()}", cause) as Throwable
                }
            }
            .bodyToMono<String>()
            .awaitSingle()

        val node = objectMapper.readTree(body)
        return buildList {
            node["archives"]?.forEach { add(it.asText()) }
        }
    }

    private suspend fun fetchMonthlyGames(archiveUrl: String): List<JsonNode> {
        // archiveUrl은 전체 URL (https://api.chess.com/pub/player/.../games/2026/04)
        // baseUrl을 제거하고 상대 경로로 요청
        val path = archiveUrl.removePrefix(chessComConfig.baseUrl)

        val body = webClient.get()
            .uri(path)
            .retrieve()
            .onStatus({ it == HttpStatus.TOO_MANY_REQUESTS }) {
                Mono.just(ExternalApiRateLimitException("chess.com") as Throwable)
            }
            .onStatus({ it.is4xxClientError || it.is5xxServerError }) { response ->
                response.createException().map { cause ->
                    ExternalApiException("chess.com API error: ${response.statusCode()}", cause) as Throwable
                }
            }
            .bodyToMono<String>()
            .awaitSingleOrNull() ?: return emptyList()

        val node = objectMapper.readTree(body)
        return buildList {
            node["games"]?.forEach { add(it) }
        }
    }

    private fun filterArchivesByDate(
        urls: List<String>,
        since: Instant?,
        until: Instant?,
    ): List<String> {
        if (since == null && until == null) return urls

        return urls.filter { url ->
            // URL 형식: .../games/2026/04
            val parts = url.split("/")
            if (parts.size < 2) return@filter true
            val year = parts[parts.size - 2].toIntOrNull() ?: return@filter true
            val month = parts[parts.size - 1].toIntOrNull() ?: return@filter true
            val archiveMonth = YearMonth.of(year, month)

            val sinceMonth = since?.atZone(ZoneOffset.UTC)?.let { YearMonth.from(it) }
            val untilMonth = until?.atZone(ZoneOffset.UTC)?.let { YearMonth.from(it) }

            (sinceMonth == null || archiveMonth >= sinceMonth) &&
                (untilMonth == null || archiveMonth <= untilMonth)
        }
    }

    private fun matchesCriteria(gameNode: JsonNode, criteria: GameFetchCriteria): Boolean {
        // 체스 규칙만 (chess960 등 제외)
        val rules = gameNode["rules"]?.asText()
        if (rules != "chess") return false

        if (criteria.timeCategory != null) {
            val timeClass = gameNode["time_class"]?.asText()
            if (timeClass != criteria.timeCategory.toChessComTimeClass()) return false
        }

        if (criteria.rated != null) {
            val rated = gameNode["rated"]?.asBoolean() ?: false
            if (rated != criteria.rated) return false
        }

        if (criteria.color != null) {
            val username = criteria.username.lowercase()
            val whiteUsername = gameNode["white"]?.get("username")?.asText()?.lowercase()
            val blackUsername = gameNode["black"]?.get("username")?.asText()?.lowercase()
            val userColor = when (username) {
                whiteUsername -> Color.WHITE
                blackUsername -> Color.BLACK
                else -> return false
            }
            if (userColor != criteria.color) return false
        }

        if (criteria.vs != null) {
            val whiteUsername = gameNode["white"]?.get("username")?.asText()?.lowercase()
            val blackUsername = gameNode["black"]?.get("username")?.asText()?.lowercase()
            val vsLower = criteria.vs.lowercase()
            if (whiteUsername != vsLower && blackUsername != vsLower) return false
        }

        return true
    }

    private fun parseGame(node: JsonNode): Game {
        val white = node["white"]
        val black = node["black"]
        val pgn = node["pgn"]?.asText() ?: ""
        val timeControlStr = node["time_control"]?.asText() ?: "0"
        val timeClass = node["time_class"]?.asText() ?: "rapid"

        val (initialTime, increment) = parseTimeControl(timeControlStr)

        return Game(
            id = null,
            source = GameSource.CHESS_COM,
            sourceGameId = node["uuid"]?.asText() ?: node["url"]?.asText() ?: "",
            players = Players(
                white = Player(
                    name = white["username"]?.asText() ?: "Anonymous",
                    rating = white["rating"]?.asInt(),
                ),
                black = Player(
                    name = black["username"]?.asText() ?: "Anonymous",
                    rating = black["rating"]?.asInt(),
                ),
            ),
            moves = parseMoves(pgn),
            result = parseResult(white["result"]?.asText(), black["result"]?.asText()),
            timeControl = TimeControl(
                initialTime = initialTime.seconds,
                increment = increment.seconds,
                category = parseTimeCategory(timeClass),
            ),
            opening = parseOpening(node),
            pgn = pgn,
            playedAt = Instant.ofEpochSecond(node["end_time"]?.asLong() ?: 0),
            importedAt = Instant.now(),
        )
    }

    private fun parseTimeControl(timeControl: String): Pair<Long, Long> {
        // 형식: "180" 또는 "180+2" 또는 "1/259200" (daily)
        return when {
            timeControl.contains("+") -> {
                val parts = timeControl.split("+")
                Pair(parts[0].toLongOrNull() ?: 0, parts[1].toLongOrNull() ?: 0)
            }
            timeControl.contains("/") -> {
                val parts = timeControl.split("/")
                Pair(parts[1].toLongOrNull() ?: 0, 0L)
            }
            else -> Pair(timeControl.toLongOrNull() ?: 0, 0L)
        }
    }

    private fun parseMoves(pgn: String): List<Move> {
        if (pgn.isBlank()) return emptyList()

        // PGN에서 헤더([...]) 제거 후 수 부분만 추출
        val moveSection = pgn.lines()
            .dropWhile { it.startsWith("[") || it.isBlank() }
            .joinToString(" ")
            .trim()

        if (moveSection.isBlank()) return emptyList()

        // 토큰 분리: "1. e4 {[%clk 0:02:58.9]} e5 {[%clk 0:02:59.2]} 2. Nf3 ..."
        val tokens = moveSection.split("\\s+".toRegex())

        val moves = mutableListOf<Move>()
        var moveNumber = 1
        var expectWhite = true
        var i = 0

        while (i < tokens.size) {
            val token = tokens[i]

            // 결과 문자열이면 중단
            if (token in listOf("1-0", "0-1", "1/2-1/2", "*")) break

            // 수 번호 (예: "1.", "2.", "1...")
            if (token.matches("\\d+\\.+".toRegex())) {
                moveNumber = token.replace(".", "").toIntOrNull() ?: moveNumber
                expectWhite = !token.contains("...")
                i++
                continue
            }

            // clock annotation {[%clk ...]} 건너뛰기
            if (token.startsWith("{")) {
                // } 가 나올 때까지 건너뛰기
                while (i < tokens.size && !tokens[i].endsWith("}")) i++
                i++
                continue
            }

            // SAN move
            val color = if (expectWhite) Color.WHITE else Color.BLACK
            moves.add(
                Move(
                    number = moveNumber,
                    color = color,
                    san = token,
                    fen = "",
                    timeSpent = null,
                    comment = null,
                )
            )

            if (!expectWhite) moveNumber++
            expectWhite = !expectWhite
            i++
        }

        return moves
    }

    private fun parseResult(whiteResult: String?, blackResult: String?): GameResult = when {
        whiteResult == "win" -> GameResult.WHITE_WIN
        blackResult == "win" -> GameResult.BLACK_WIN
        whiteResult in listOf("stalemate", "agreed", "repetition", "insufficient", "timevsinsufficient", "50move") -> GameResult.DRAW
        blackResult in listOf("stalemate", "agreed", "repetition", "insufficient", "timevsinsufficient", "50move") -> GameResult.DRAW
        else -> GameResult.DRAW
    }

    private fun parseOpening(node: JsonNode): Opening? {
        val ecoUrl = node["eco"]?.asText() ?: return null
        // URL 형식: https://www.chess.com/openings/French-Defense-Winawer-...
        val name = ecoUrl.substringAfterLast("/").replace("-", " ")
        return Opening(eco = null, name = name)
    }

    private fun parseTimeCategory(timeClass: String): TimeCategory = when (timeClass) {
        "bullet" -> TimeCategory.BULLET
        "blitz" -> TimeCategory.BLITZ
        "rapid" -> TimeCategory.RAPID
        "daily" -> TimeCategory.CORRESPONDENCE
        else -> TimeCategory.CLASSICAL
    }

    private fun TimeCategory.toChessComTimeClass(): String = when (this) {
        TimeCategory.ULTRABULLET -> "bullet"
        TimeCategory.BULLET -> "bullet"
        TimeCategory.BLITZ -> "blitz"
        TimeCategory.RAPID -> "rapid"
        TimeCategory.CLASSICAL -> "rapid"
        TimeCategory.CORRESPONDENCE -> "daily"
    }
}
