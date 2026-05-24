-- 1. 테이블 생성
CREATE TABLE game_analyses (
    id           BIGINT       PRIMARY KEY,
    game_id      BIGINT       NOT NULL UNIQUE
                              REFERENCES games(id) ON DELETE CASCADE,
    depth        INT          NOT NULL,
    analyzed_at  TIMESTAMPTZ  NOT NULL,
    evaluations  JSONB        NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_analyses_analyzed_at ON game_analyses (analyzed_at DESC);

-- 2. 기존 annotations JSONB에 저장된 analysis 백필
--    games.id를 game_analyses.id로 그대로 사용 (Snowflake는 시간단조증가라 신규 발급 ID와 충돌 없음)
INSERT INTO game_analyses (id, game_id, depth, analyzed_at, evaluations, created_at, updated_at)
SELECT
    g.id,
    g.id,
    (g.annotations -> 'analysis' ->> 'depth')::int,
    COALESCE(
        (g.annotations -> 'analysis' ->> 'analyzedAt')::timestamptz,
        now()
    ),
    COALESCE(g.annotations -> 'analysis' -> 'evaluations', '[]'::jsonb),
    now(),
    now()
FROM games g
WHERE g.annotations ? 'analysis'
  AND jsonb_typeof(g.annotations -> 'analysis') = 'object';

-- 3. annotations JSONB에서 analysis 키 제거
UPDATE games
SET annotations = annotations - 'analysis'
WHERE annotations ? 'analysis';
