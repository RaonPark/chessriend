package org.raonpark.chessriend.game.adapter.out.engine

import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.springframework.beans.factory.DisposableBean
import org.springframework.stereotype.Component
import java.util.concurrent.CopyOnWriteArrayList

private val log = KotlinLogging.logger {}

/**
 * Stockfish 프로세스 풀. 프로세스를 미리 띄워 재사용한다(요청마다 spawn 금지).
 *
 * - 채널 용량 = poolSize → 한 프로세스는 동시에 한 코루틴에게만 대여(채널 자체가 상호 배제).
 * - **지연 초기화**: 첫 [borrow] 시점에 프로세스를 띄운다. 따라서 stockfish 미설치 환경(테스트/CI)에서
 *   앱 기동이 실패하지 않는다(분석을 실제로 호출할 때만 엔진이 필요).
 * - 대여 중 프로세스가 죽으면 반납 시 새 프로세스로 교체.
 */
@Component
class StockfishEnginePool(
    private val props: ChessEngineProperties,
) : DisposableBean {

    private val initMutex = Mutex()
    @Volatile private var channel: Channel<UciStockfishProcess>? = null
    private val live = CopyOnWriteArrayList<UciStockfishProcess>()

    private suspend fun pool(): Channel<UciStockfishProcess> {
        channel?.let { return it }
        return initMutex.withLock {
            channel ?: run {
                val ch = Channel<UciStockfishProcess>(props.poolSize)
                repeat(props.poolSize) {
                    val p = withContext(Dispatchers.IO) { UciStockfishProcess.start(props) }
                    live += p
                    ch.trySend(p)
                }
                log.info { "Stockfish pool initialized: size=${props.poolSize}" }
                channel = ch
                ch
            }
        }
    }

    suspend fun <T> borrow(block: suspend (UciStockfishProcess) -> T): T {
        val ch = pool()
        var proc = ch.receive()
        try {
            return block(proc)
        } finally {
            withContext(NonCancellable) {
                if (!proc.isAlive) {
                    log.warn { "engine process not alive on return; respawning" }
                    live.remove(proc)
                    proc = withContext(Dispatchers.IO) { UciStockfishProcess.start(props) }
                    live += proc
                }
                if (!ch.trySend(proc).isSuccess) {
                    live.remove(proc)
                    withContext(Dispatchers.IO) { proc.close() }
                }
            }
        }
    }

    override fun destroy() {
        channel?.close()
        live.forEach { runCatching { it.close() }.throwCancellation() }
        live.clear()
        log.info { "Stockfish pool destroyed" }
    }
}

private fun Result<*>.throwCancellation() {
    exceptionOrNull()?.let { if (it is CancellationException) throw it }
}
