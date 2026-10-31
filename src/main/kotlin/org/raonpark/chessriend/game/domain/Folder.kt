package org.raonpark.chessriend.game.domain

/** 사용자가 만든 폴더 (게임을 직접 묶어 관리). 이름은 앞뒤 공백 없이 1~30자 */
data class Folder(
    val id: Long?,
    val name: String,
) {
    init {
        require(name == name.trim()) { "Folder name must be trimmed" }
        require(name.length in 1..MAX_NAME_LENGTH) { "Folder name must be 1..$MAX_NAME_LENGTH characters" }
    }

    companion object {
        const val MAX_NAME_LENGTH = 30

        /** 사용자 입력 이름을 정리(trim)해서 새 폴더 생성 */
        fun named(rawName: String): Folder = Folder(id = null, name = rawName.trim())
    }
}

/** 폴더 + 들어 있는 게임 수 (LNB 표시용) */
data class FolderSummary(
    val folder: Folder,
    val gameCount: Long,
)
