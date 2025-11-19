CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  short_code VARCHAR(8) UNIQUE NOT NULL,
  target_url TEXT NOT NULL,
  click_count INTEGER DEFAULT 0,
  last_clicked TIMESTAMP
);


