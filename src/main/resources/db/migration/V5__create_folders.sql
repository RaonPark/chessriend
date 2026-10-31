-- 사용자 폴더: 게임을 직접 묶어 관리 (LNB "내 폴더")
CREATE TABLE folders (
    id         BIGINT       PRIMARY KEY,
    name       VARCHAR(30)  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_folders_name UNIQUE (name)
);

-- 게임 ↔ 폴더 (다대다: 게임 하나가 여러 폴더에 속할 수 있음)
-- 게임이나 폴더를 지우면 연결만 함께 삭제됨 (폴더를 지워도 게임은 남음)
CREATE TABLE game_folders (
    game_id   BIGINT      NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    folder_id BIGINT      NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (game_id, folder_id)
);

CREATE INDEX idx_game_folders_folder_id ON game_folders (folder_id);
