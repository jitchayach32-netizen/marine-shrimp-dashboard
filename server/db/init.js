const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'app.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const PROVINCES_PATH = path.join(__dirname, 'provinces.json');

function initDb() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  seedProvinces(db);

  return db;
}

function seedProvinces(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM provinces').get().c;
  if (count > 0) return;

  const provinces = JSON.parse(fs.readFileSync(PROVINCES_PATH, 'utf-8'));
  const insert = db.prepare(
    'INSERT INTO provinces (sheet_order, name_th, region) VALUES (?, ?, ?)'
  );
  db.exec('BEGIN');
  try {
    for (const p of provinces) insert.run(p.sheet_order, p.name_th, p.region);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { initDb, DB_PATH };
