package org.raonpark.chessriend.game.application

import io.github.oshai.kotlinlogging.KotlinLogging
import org.raonpark.chessriend.game.domain.Game
import org.raonpark.chessriend.game.domain.GameAnnotation
import org.raonpark.chessriend.game.domain.GameResult
import org.raonpark.chessriend.game.domain.GameSource
import org.raonpark.chessriend.game.domain.Opening
import org.raonpark.chessriend.game.domain.ParsedPgn
import org.raonpark.chessriend.game.domain.Player
import org.raonpark.chessriend.game.domain.Players
import org.raonpark.chessriend.game.domain.TimeCategory
import org.raonpark.chessriend.game.domain.TimeControl
import org.raonpark.chessriend.game.port.`in`.CreateGameFromPgnCommand
import org.raonpark.chessriend.game.port.`in`.CreateGameFromPgnUseCase
import org.raonpark.chessriend.game.port.out.ChessRules
import org.raonpark.chessriend.game.port.out.GameRepository
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID
import kotlin.time.Duration.Companion.seconds

private val log = KotlinLogging.logger {}

@Service
class CreateGameFromPgnService(
    private val chessRules: ChessRules,
    private val gameRepository: GameRepository,
) : CreateGameFromPgnUseCase {

    override suspend fun createFromPgn(command: CreateGameFromPgnCommand): Game {
        if (command.pgn.isBlank()) {
            throw IllegalArgumentException("PGN이 비어 있습니다.")
        }
        if (countGames(command.pgn) > 1) {
            throw IllegalArgumentException("여러 게임이 포함된 PGN은 아직 지원하지 않습니다. 한 게임만 붙여넣어 주세요.")
        }

        val parsed = chessRules.parsePgn(command.pgn)  // 해석 불가 시 IllegalArgumentException → 400
        if (parsed.hasSetup) {
            throw IllegalArgumentException("표준 시작 포지션이 아닌 PGN([SetUp]/[FEN])은 아직 지원하지 않습니다.")
        }

        val timeControl = parseTimeControl(parsed.timeControl)
        val game = Game(
            id = null,
            source = GameSource.PGN,
            sourceGameId = "pgn-${UUID.randomUUID()}",
            ownerUsername = command.ownerUsername,
            players = Players(
                white = Player(name = parsed.whiteName ?: "White", rating = parsed.whiteRating),
                black = Player(name = parsed.blackName ?: "Black", rating = parsed.blackRating),
            ),
            moves = parsed.moves,
            result = parseResult(parsed.result),
            timeControl = timeControl,
            opening = parsed.openingName?.let { Opening(eco = parsed.eco, name = it) },
            pgn = command.pgn,
            playedAt = parseDate(parsed.date) ?: Instant.now(),
            importedAt = Instant.now(),
            annotations = GameAnnotation(
                moveComments = parsed.moveComments,
                variations = parsed.variations,
            ),
        )

        val saved = gameRepository.save(game)
        log.info { "PGN game created: id=${saved.id} moves=${saved.totalMoves} variations=${parsed.variations.size}" }
        return saved
    }

    /** 결과 토큰이 표준이 아니거나(`*`) 없으면 무승부로 둔다(포지션 검토용). */
    private fun parseResult(result: String): GameResult =
        when (result) {
            "1-0", "0-1", "1/2-1/2" -> GameResult.fromPgnResult(result)
            else -> GameResult.DRAW
        }

    /** "600+5" 형식만 해석. 그 외/없음이면 시간 정보 없는 통신 체스로 둔다. */
    private fun parseTimeControl(raw: String?): TimeControl {
        if (raw != null && raw.matches(Regex("""\d+\+\d+"""))) {
            val parts = raw.split("+")
            val initial = parts[0].toLong()
            val increment = parts[1].toLong()
            return TimeControl(initial.seconds, increment.seconds, inferCategory(initial, increment))
        }
        return TimeControl(0.seconds, 0.seconds, TimeCategory.CORRESPONDENCE)
    }

    /** lichess 식 추정: 예상 소요(base + 40*inc)로 카테고리 판정. */
    private fun inferCategory(initialSeconds: Long, incrementSeconds: Long): TimeCategory {
        val estimated = initialSeconds + 40 * incrementSeconds
        return when {
            estimated < 30 -> TimeCategory.ULTRABULLET
            estimated < 180 -> TimeCategory.BULLET
            estimated < 480 -> TimeCategory.BLITZ
            estimated < 1500 -> TimeCategory.RAPID
            else -> TimeCategory.CLASSICAL
        }
    }

    private fun parseDate(date: String?): Instant? {
        if (date == null) return null
        return runCatching {
            LocalDate.parse(date, DateTimeFormatter.ofPattern("yyyy.MM.dd"))
                .atStartOfDay(ZoneOffset.UTC).toInstant()
        }.getOrNull()
    }

    private fun countGames(pgn: String): Int =
        Regex("""(?m)^\s*\[Event\s""").findAll(pgn).count().coerceAtLeast(1)
}
