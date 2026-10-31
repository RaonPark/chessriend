-- 버그 수정: 메이트로 게임을 끝낸 수가 blunder로 저장되던 문제.
-- UCI는 메이트된 포지션을 부호 없는 "mate 0"으로 주는데, 분석기가 이를 "수를 둔 쪽이 메이트당함"으로 해석해
-- cpLoss 19999 + blunder로 저장했다. 수 직후 평가가 mate 0인 수는 메이트를 시킨 최선의 수이므로
-- cpLoss 0, 분류 없음으로 바로잡는다. (이후 분석은 MoveClassifier.evalAfterMoveToCp로 올바르게 계산)
UPDATE game_analyses
SET evaluations = (
        SELECT jsonb_agg(
                   CASE
                       WHEN (e -> 'evalAfter' ->> 'mate')::int = 0
                           THEN e || '{"cpLoss": 0, "classification": null}'::jsonb
                       ELSE e
                   END
                   ORDER BY ord
               )
        FROM jsonb_array_elements(evaluations) WITH ORDINALITY AS t(e, ord)
    ),
    updated_at = now()
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(evaluations) e
    WHERE (e -> 'evalAfter' ->> 'mate')::int = 0
);
