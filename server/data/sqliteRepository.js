const { Repository } = require('./repository');

function buildInClause(paramName, values) {
  const placeholders = values.map((_, i) => `@${paramName}${i}`).join(', ');
  const params = {};
  values.forEach((v, i) => (params[`${paramName}${i}`] = v));
  return { placeholders, params };
}

class SqliteRepository extends Repository {
  constructor(db) {
    super();
    this.db = db;
  }

  async getProvinces() {
    return this.db.prepare('SELECT id, sheet_order, name_th, region FROM provinces ORDER BY sheet_order').all();
  }

  async getRegions() {
    const rows = this.db
      .prepare('SELECT region, MIN(sheet_order) AS first_order FROM provinces GROUP BY region ORDER BY first_order')
      .all();
    return rows.map((r) => r.region);
  }

  async getMonthlyFacts(filters = {}) {
    const { sheetType, provinceIds, regions, yearFrom, yearTo, months, species } = filters;
    const conditions = ['mf.sheet_type = @sheetType'];
    const params = { sheetType };

    if (provinceIds && provinceIds.length > 0) {
      const { placeholders, params: p } = buildInClause('pid', provinceIds);
      conditions.push(`mf.province_id IN (${placeholders})`);
      Object.assign(params, p);
    }
    if (regions && regions.length > 0) {
      const { placeholders, params: p } = buildInClause('region', regions);
      conditions.push(`p.region IN (${placeholders})`);
      Object.assign(params, p);
    }
    if (yearFrom != null) {
      conditions.push('mf.year >= @yearFrom');
      params.yearFrom = yearFrom;
    }
    if (yearTo != null) {
      conditions.push('mf.year <= @yearTo');
      params.yearTo = yearTo;
    }
    if (months && months.length > 0) {
      const { placeholders, params: p } = buildInClause('month', months);
      conditions.push(`mf.month IN (${placeholders})`);
      Object.assign(params, p);
    }
    if (species && species.length > 0) {
      const { placeholders, params: p } = buildInClause('species', species);
      conditions.push(`mf.species IN (${placeholders})`);
      Object.assign(params, p);
    }

    const sql = `
      SELECT mf.id, mf.sheet_type, mf.province_id, p.name_th AS province_name, p.region,
             mf.year, mf.month, mf.species, mf.value, mf.is_missing, mf.is_anomaly
      FROM monthly_facts mf
      JOIN provinces p ON p.id = mf.province_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY mf.year, mf.month, p.sheet_order
    `;
    return this.db.prepare(sql).all(params);
  }

  async getDocumentFacts(filters = {}) {
    const { sheetType, provinceIds, regions, yearFrom, yearTo, months, species } = filters;
    const conditions = ['df.sheet_type = @sheetType'];
    const params = { sheetType };

    if (provinceIds && provinceIds.length > 0) {
      const { placeholders, params: p } = buildInClause('pid', provinceIds);
      conditions.push(`df.province_id IN (${placeholders})`);
      Object.assign(params, p);
    }
    if (regions && regions.length > 0) {
      const { placeholders, params: p } = buildInClause('region', regions);
      conditions.push(`p.region IN (${placeholders})`);
      Object.assign(params, p);
    }
    if (yearFrom != null) {
      conditions.push('df.year >= @yearFrom');
      params.yearFrom = yearFrom;
    }
    if (yearTo != null) {
      conditions.push('df.year <= @yearTo');
      params.yearTo = yearTo;
    }
    if (months && months.length > 0) {
      const { placeholders, params: p } = buildInClause('month', months);
      conditions.push(`df.month IN (${placeholders})`);
      Object.assign(params, p);
    }
    if (species && species.length > 0) {
      const { placeholders, params: p } = buildInClause('species', species);
      conditions.push(`df.species IN (${placeholders})`);
      Object.assign(params, p);
    }

    const sql = `
      SELECT df.id, df.sheet_type, df.province_id, p.name_th AS province_name, p.region,
             df.year, df.month, df.species, df.doc_count, df.facility_count
      FROM document_facts df
      JOIN provinces p ON p.id = df.province_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY df.year, df.month, p.sheet_order
    `;
    return this.db.prepare(sql).all(params);
  }

  async getPrices(filters = {}) {
    const { yearFrom, yearTo, sizeCategories } = filters;
    const conditions = ['1=1'];
    const params = {};

    if (yearFrom != null) {
      conditions.push('year >= @yearFrom');
      params.yearFrom = yearFrom;
    }
    if (yearTo != null) {
      conditions.push('year <= @yearTo');
      params.yearTo = yearTo;
    }
    if (sizeCategories && sizeCategories.length > 0) {
      const { placeholders, params: p } = buildInClause('size', sizeCategories);
      conditions.push(`size_category IN (${placeholders})`);
      Object.assign(params, p);
    }

    const sql = `
      SELECT id, year, month, size_category, price_baht, container_count
      FROM shrimp_prices
      WHERE ${conditions.join(' AND ')}
      ORDER BY year, month, size_category
    `;
    return this.db.prepare(sql).all(params);
  }

  async getSyncLogs(limit = 20) {
    return this.db
      .prepare('SELECT * FROM sync_log ORDER BY synced_at DESC, id DESC LIMIT @limit')
      .all({ limit });
  }

  async getUserByUsername(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = @username').get({ username }) || null;
  }

  async getAllUsers() {
    return this.db
      .prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY id')
      .all();
  }

  async createUser({ username, passwordHash, displayName, role }) {
    const result = this.db
      .prepare(
        'INSERT INTO users (username, password_hash, display_name, role) VALUES (@username, @passwordHash, @displayName, @role)'
      )
      .run({ username, passwordHash, displayName, role });
    return result.lastInsertRowid;
  }

  async deleteUser(userId) {
    this.db.prepare('DELETE FROM users WHERE id = @userId').run({ userId });
  }
}

module.exports = { SqliteRepository };
