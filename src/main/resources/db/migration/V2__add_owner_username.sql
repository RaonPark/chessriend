ALTER TABLE games ADD COLUMN owner_username VARCHAR(100) NOT NULL DEFAULT '';

CREATE INDEX idx_games_owner_username ON games (owner_username);
