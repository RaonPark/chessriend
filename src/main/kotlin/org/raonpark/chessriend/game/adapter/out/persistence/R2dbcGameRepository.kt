package org.raonpark.chessriend.game.adapter.out.persistence

import org.springframework.data.repository.kotlin.CoroutineCrudRepository
import org.springframework.data.repository.kotlin.CoroutineSortingRepository

interface R2dbcGameRepository :
    CoroutineCrudRepository<GameEntity, Long>,
    CoroutineSortingRepository<GameEntity, Long> {

    suspend fun existsBySourceGameId(sourceGameId: String): Boolean
}
