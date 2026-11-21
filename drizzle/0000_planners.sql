CREATE TABLE planners (
  user_id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  payload TEXT NOT NULL
);
