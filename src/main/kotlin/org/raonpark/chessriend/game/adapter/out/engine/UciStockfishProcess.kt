package org.raonpark.chessriend.game.adapter.out.engine

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.raonpark.chessriend.game.domain.EvalScore
import org.raonpark.chessriend.shared.exception.EngineTimeoutException
import org.raonpark.chessriend.shared.exception.EngineUnavailableException
import java.io.BufferedReader
import java.io.BufferedWriter

private val log = KotlinLogging.logger {}

/**
 * 단일 Stockfish UCI 프로세스 래퍼. 한 번에 한 탐색만 수행한다(상호 배제는 [StockfishEnginePool] 담당).
 *
 * 모든 blocking stdin/stdout I/O 는 호출부에서 [Dispatchers.IO] 위에서만 수행된다.
 */
class UciStockfishProcess private constructor(
    private val process: Process,
    private val writer: BufferedWriter,
    private val reader: BufferedReader,
) {
    val isAlive: Boolean get() = process.isAlive

    /**
     * 한 포지션을 [depth] 까지 분석. [timeoutMs] 초과 시 `stop` 으로 조기 종료하고 그때까지의 최선 평가를 반환.
     * 점수 라인을 한 번도 못 받으면 [EngineTimeoutException].
     * 프로세스가 죽으면 [EngineUnavailableException].
     */
    suspend fun evaluate(fen: String, depth: Int, timeoutMs: Long): EvalScore =
        withContext(Dispatchers.IO) {
            send("position fen $fen")
            send("go depth $depth")

            // 워치독: timeoutMs 후 stop 을 보내 bestmove 를 유도한다.
            val watchdog = launch {
                delay(timeoutMs)
                log.warn { "engine search exceeded ${timeoutMs}ms; sending stop" }
                runCatching { send("stop") }.throwCancellation()
            }
            val cancellationHandler = currentCoroutineContext().job.invokeOnCompletion { cause ->
                if (cause is CancellationException) {
                    process.destroy()
                }
            }

            try {
                readEval(fen)
            } finally {
                cancellationHandler.dispose()
                watchdog.cancel()
            }
        }

    private fun readEval(fen: String): EvalScore {
        val flip = UciParser.flipFor(fen)
        var last: EvalScore? = null
        while (true) {
            val line = reader.readLine() ?: run {
                throw EngineUnavailableException("Stockfish process terminated unexpectedly")
            }
            UciParser.parseScore(line, flip)?.let { last = it }
            if (line.startsWith("bestmove")) break
        }
        return last ?: throw EngineTimeoutException("No evaluation produced for position")
    }

    private fun send(command: String) {
        writer.write(command)
        writer.newLine()
        writer.flush()
    }

    private fun readUntil(token: String) {
        while (true) {
            val line = reader.readLine()
                ?: throw EngineUnavailableException("Stockfish died during handshake (expected '$token')")
            if (line.trim() == token) return
        }
    }

    fun close() {
        runCatching { send("quit") }.throwCancellation()
        runCatching { process.destroy() }.throwCancellation()
    }

    companion object {
        /** 프로세스를 띄우고 UCI 핸드셰이크 + 옵션 설정까지 마친 인스턴스를 반환. blocking — IO 디스패처에서 호출. */
        fun start(props: ChessEngineProperties): UciStockfishProcess {
            val process = try {
                ProcessBuilder(props.path).redirectErrorStream(false).start()
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                throw EngineUnavailableException("Failed to start Stockfish at '${props.path}'", e)
            }
            val instance = UciStockfishProcess(
                process = process,
                writer = process.outputStream.bufferedWriter(),
                reader = process.inputStream.bufferedReader(),
            )
            instance.send("uci")
            instance.readUntil("uciok")
            instance.send("setoption name Threads value ${props.threads}")
            instance.send("setoption name Hash value ${props.hashMb}")
            instance.send("isready")
            instance.readUntil("readyok")
            log.info { "Stockfish process started: ${props.path} (threads=${props.threads}, hash=${props.hashMb}MB)" }
            return instance
        }
    }
}

private fun Result<*>.throwCancellation() {
    exceptionOrNull()?.let { if (it is CancellationException) throw it }
}
