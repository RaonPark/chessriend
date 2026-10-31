package org.raonpark.chessriend.game.domain

/** 게임 자체에 붙이는 애칭과 메모 (수별 메모 [GameAnnotation]과 별개) */
data class GameNote(
    val nickname: String?,
    val memo: String?,
) {
    init {
        nickname?.let { require(it.length <= MAX_NICKNAME_LENGTH) { "Nickname must be at most $MAX_NICKNAME_LENGTH characters" } }
        memo?.let { require(it.length <= MAX_MEMO_LENGTH) { "Memo must be at most $MAX_MEMO_LENGTH characters" } }
    }

    companion object {
        const val MAX_NICKNAME_LENGTH = 50
        const val MAX_MEMO_LENGTH = 2000
        val EMPTY = GameNote(null, null)

        /** 사용자 입력 정리: 앞뒤 공백 제거, 비어 있으면 null */
        fun of(nickname: String?, memo: String?): GameNote =
            GameNote(nickname = nickname?.trim()?.ifEmpty { null }, memo = memo?.trim()?.ifEmpty { null })
    }
}
