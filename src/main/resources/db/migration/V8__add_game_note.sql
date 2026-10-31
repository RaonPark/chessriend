-- 게임 자체의 애칭·메모 (수별 메모 annotations와 별개)
ALTER TABLE games ADD COLUMN nickname VARCHAR(50);
ALTER TABLE games ADD COLUMN memo     TEXT;
