CREATE TABLE IF NOT EXISTS masters (
  id         SERIAL PRIMARY KEY,
  user_id    INT  NOT NULL REFERENCES users(id),
  about      TEXT,
  photo1_url TEXT,
  photo2_url TEXT,
  photo3_url TEXT,
  UNIQUE(user_id)
)