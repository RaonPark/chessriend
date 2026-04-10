package org.raonpark.chessriend.shared.id

/**
 * Snowflake ID Generator (단일 서버용 간소화 버전)
 *
 * 구조 (63 bits):
 * - 41 bits: timestamp (epoch 기준, ~69년)
 * - 10 bits: machine ID (단일 서버에서는 0 고정)
 * - 12 bits: sequence (밀리초당 최대 4096개)
 */
class SnowflakeIdGenerator(
    private val machineId: Long = 0L,
) {
    private val machineIdBits = 10
    private val sequenceBits = 12
    private val epochMillis = 1712652345678L // 2024-04-09 기준 커스텀 epoch

    private val maxMachineId = -1L xor (-1L shl machineIdBits)
    private val maxSequenceId = -1L xor (-1L shl sequenceBits)

    private val machineIdShift = sequenceBits
    private val timestampShift = sequenceBits + machineIdBits

    @Volatile private var lastTimestamp = -1L
    @Volatile private var sequenceId = 0L

    init {
        require(machineId in 0..maxMachineId) {
            "machineId must be between 0 and $maxMachineId"
        }
    }

    @Synchronized
    fun nextId(): Long {
        var timestamp = System.currentTimeMillis()

        if (timestamp < lastTimestamp) {
            timestamp = tilNextMillis(lastTimestamp)
        }

        if (timestamp == lastTimestamp) {
            sequenceId = (sequenceId + 1) and maxSequenceId
            if (sequenceId == 0L) {
                timestamp = tilNextMillis(lastTimestamp)
            }
        } else {
            sequenceId = 0L
        }

        lastTimestamp = timestamp
        return ((timestamp - epochMillis) shl timestampShift) or
                (machineId shl machineIdShift) or
                sequenceId
    }

    private fun tilNextMillis(lastTimestamp: Long): Long {
        var timestamp = System.currentTimeMillis()
        while (timestamp <= lastTimestamp) {
            timestamp = System.currentTimeMillis()
        }
        return timestamp
    }
}
