-- Drop and recreate the links table to ensure new columns are added
DROP TABLE IF EXISTS links;

CREATE TABLE links (
  id SERIAL PRIMARY KEY,
  original_url TEXT NOT NULL,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  click_count INTEGER DEFAULT 0,
  last_clicked TIMESTAMPTZ

);




