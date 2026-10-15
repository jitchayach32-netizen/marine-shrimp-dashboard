-- ระบบติดตามข้อมูลการเพาะเลี้ยงกุ้งทะเล
-- SQLite schema (เฟส 1 cache layer เหนือ Google Sheets)

CREATE TABLE IF NOT EXISTS provinces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_order INTEGER NOT NULL,
  name_th TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL
);

-- ตาราง fact หลัก แบบ long-format ครอบคลุมชีท 1,2,3,4,5
-- sheet_type: seed_distribution | seed_stocking | production_farm | production_incoming | production_capacity
-- species: whiteleg | black_tiger
CREATE TABLE IF NOT EXISTS monthly_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_type TEXT NOT NULL,
  province_id INTEGER NOT NULL REFERENCES provinces(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  species TEXT NOT NULL,
  value REAL,
  is_missing INTEGER NOT NULL DEFAULT 0,
  is_anomaly INTEGER NOT NULL DEFAULT 0,
  UNIQUE(sheet_type, province_id, year, month, species)
);
CREATE INDEX IF NOT EXISTS idx_monthly_facts_lookup
  ON monthly_facts(sheet_type, year, month, province_id);

-- ชีท 6,7 (เอกสารกำกับ) มี 4 มิติค่าต่อเดือน: ฉบับ/แห่ง x ขาว/กุลาดำ
-- sheet_type: document_seed | document_meat
CREATE TABLE IF NOT EXISTS document_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_type TEXT NOT NULL,
  province_id INTEGER NOT NULL REFERENCES provinces(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  species TEXT NOT NULL,
  doc_count REAL,
  facility_count REAL,
  UNIQUE(sheet_type, province_id, year, month, species)
);
CREATE INDEX IF NOT EXISTS idx_document_facts_lookup
  ON document_facts(sheet_type, year, month, province_id);

-- ชีท 8 ราคาตลาด ไม่มีมิติจังหวัด
CREATE TABLE IF NOT EXISTS shrimp_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  size_category TEXT NOT NULL,
  price_baht REAL,
  container_count INTEGER,
  UNIQUE(year, month, size_category)
);
CREATE INDEX IF NOT EXISTS idx_shrimp_prices_lookup
  ON shrimp_prices(year, month);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  status TEXT NOT NULL,
  rows_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
