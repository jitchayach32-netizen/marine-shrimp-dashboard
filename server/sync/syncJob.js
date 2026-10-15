const { fetchSheetRows } = require('./sheetsClient');
const { parseMonthlyFactsSheet, parseDocumentFactsSheet, parsePricesSheet } = require('./parsers');

const MONTHLY_SHEETS = [
  'seed_distribution',
  'seed_stocking',
  'production_farm',
  'production_incoming',
  'production_capacity'
];
const DOCUMENT_SHEETS = ['document_seed', 'document_meat'];

let isSyncing = false;

function getProvinceMap(db) {
  const provinces = db.prepare('SELECT id, name_th FROM provinces').all();
  return new Map(provinces.map((p) => [p.name_th, p.id]));
}

function upsertMonthlyFacts(db, facts) {
  const stmt = db.prepare(`
    INSERT INTO monthly_facts (sheet_type, province_id, year, month, species, value, is_missing, is_anomaly)
    VALUES (@sheet_type, @province_id, @year, @month, @species, @value, @is_missing, @is_anomaly)
    ON CONFLICT(sheet_type, province_id, year, month, species)
    DO UPDATE SET value=excluded.value, is_missing=excluded.is_missing, is_anomaly=excluded.is_anomaly
  `);
  for (const f of facts) stmt.run(f);
}

function upsertDocumentFacts(db, facts) {
  const stmt = db.prepare(`
    INSERT INTO document_facts (sheet_type, province_id, year, month, species, doc_count, facility_count)
    VALUES (@sheet_type, @province_id, @year, @month, @species, @doc_count, @facility_count)
    ON CONFLICT(sheet_type, province_id, year, month, species)
    DO UPDATE SET doc_count=excluded.doc_count, facility_count=excluded.facility_count
  `);
  for (const f of facts) stmt.run(f);
}

function upsertPriceFacts(db, facts) {
  const stmt = db.prepare(`
    INSERT INTO shrimp_prices (year, month, size_category, price_baht, container_count)
    VALUES (@year, @month, @size_category, @price_baht, @container_count)
    ON CONFLICT(year, month, size_category)
    DO UPDATE SET price_baht=excluded.price_baht, container_count=excluded.container_count
  `);
  for (const f of facts) stmt.run(f);
}

async function runSync(db) {
  if (isSyncing) {
    return { status: 'skipped', reason: 'sync already in progress' };
  }
  isSyncing = true;

  const startedAt = Date.now();
  let rowsSynced = 0;
  const warnings = [];

  try {
    const provinceIdByName = getProvinceMap(db);

    for (const sheetKey of MONTHLY_SHEETS) {
      const rows = await fetchSheetRows(sheetKey);
      const { facts, unmatchedProvinces } = parseMonthlyFactsSheet(rows, sheetKey, provinceIdByName);
      db.exec('BEGIN');
      try {
        upsertMonthlyFacts(db, facts);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      rowsSynced += facts.length;
      if (unmatchedProvinces.length > 0) {
        warnings.push(`${sheetKey}: unmatched provinces - ${unmatchedProvinces.join(', ')}`);
      }
    }

    for (const sheetKey of DOCUMENT_SHEETS) {
      const rows = await fetchSheetRows(sheetKey);
      const { facts, unmatchedProvinces } = parseDocumentFactsSheet(rows, sheetKey, provinceIdByName);
      db.exec('BEGIN');
      try {
        upsertDocumentFacts(db, facts);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      rowsSynced += facts.length;
      if (unmatchedProvinces.length > 0) {
        warnings.push(`${sheetKey}: unmatched provinces - ${unmatchedProvinces.join(', ')}`);
      }
    }

    const priceRows = await fetchSheetRows('prices');
    const { facts: priceFacts } = parsePricesSheet(priceRows);
    db.exec('BEGIN');
    try {
      upsertPriceFacts(db, priceFacts);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    rowsSynced += priceFacts.length;

    const status = warnings.length > 0 ? 'ok_with_warnings' : 'ok';
    db.prepare(
      'INSERT INTO sync_log (status, rows_synced, error_message) VALUES (?, ?, ?)'
    ).run(status, rowsSynced, warnings.length > 0 ? warnings.join(' | ') : null);

    return {
      status,
      rowsSynced,
      warnings,
      durationMs: Date.now() - startedAt
    };
  } catch (err) {
    db.prepare(
      'INSERT INTO sync_log (status, rows_synced, error_message) VALUES (?, ?, ?)'
    ).run('error', rowsSynced, err.message);
    throw err;
  } finally {
    isSyncing = false;
  }
}

module.exports = { runSync };
