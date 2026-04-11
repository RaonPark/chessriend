CREATE TABLE games (
    id            BIGINT       PRIMARY KEY,
    source        VARCHAR(20)  NOT NULL,
    source_game_id VARCHAR(50) NOT NULL,
    white_name    VARCHAR(100) NOT NULL,
    white_rating  INT,
    black_name    VARCHAR(100) NOT NULL,
    black_rating  INT,
    result        VARCHAR(20)  NOT NULL,
    initial_time  BIGINT       NOT NULL,
    increment     BIGINT       NOT NULL,
    time_category VARCHAR(20)  NOT NULL,
    opening_eco   VARCHAR(10),
    opening_name  VARCHAR(200),
    moves         JSONB        NOT NULL DEFAULT '[]',
    pgn           TEXT         NOT NULL,
    played_at     TIMESTAMPTZ  NOT NULL,
    imported_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT uq_source_game_id UNIQUE (source, source_game_id)
);

CREATE INDEX idx_games_source_game_id ON games (source_game_id);
CREATE INDEX idx_games_white_name ON games (white_name);
CREATE INDEX idx_games_black_name ON games (black_name);
CREATE INDEX idx_games_played_at ON games (played_at DESC);
CREATE INDEX idx_games_time_category ON games (time_category);
