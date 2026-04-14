ALTER TABLE games ADD COLUMN annotations JSONB NOT NULL DEFAULT '{"moveComments":{},"variations":[]}';
