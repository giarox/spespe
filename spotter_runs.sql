CREATE TABLE IF NOT EXISTS spotter_runs (
  id BIGSERIAL PRIMARY KEY,
  store_key TEXT NOT NULL,
  flyer_url TEXT NOT NULL,
  run_status TEXT NOT NULL DEFAULT 'completed',
  page_count INTEGER,
  screenshot_count INTEGER,
  product_count INTEGER,
  first_screenshot_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spotter_runs_store_url ON spotter_runs(store_key, flyer_url);
CREATE INDEX IF NOT EXISTS idx_spotter_runs_created ON spotter_runs(created_at DESC);

ALTER TABLE spotter_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public read spotter runs" ON spotter_runs
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Service role write spotter runs" ON spotter_runs
  FOR ALL USING (true);
