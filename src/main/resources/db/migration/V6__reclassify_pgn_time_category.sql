-- TimeCategory.OTHER(기타) 도입: 시간 정보가 없거나 해석 못 한 PGN 게임은 지금까지 CORRESPONDENCE(통신)로 저장돼 왔음.
-- 실제 일일(통신) 체스로 보이는 것(Event에 Daily/Correspondence, 또는 TimeControl "1/초" 형식)만 남기고 나머지는 OTHER로 옮긴다.
-- ※ 예전 파서는 "600+5" 형식만 해석했으므로, "180"처럼 다른 형식이라 CORRESPONDENCE로 들어간 게임도 OTHER가 된다
--   (재해석은 새로 가져오는 게임부터 적용 — TimeControl.fromPgnTag).
UPDATE games
SET time_category = 'OTHER'
WHERE source = 'PGN'
  AND time_category = 'CORRESPONDENCE'
  AND NOT (
        pgn ~* '\[Event\s+"[^"]*(daily|correspondence)'
     OR pgn ~  '\[TimeControl\s+"1/[0-9]+'
  );
