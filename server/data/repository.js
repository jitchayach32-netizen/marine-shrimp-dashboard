/**
 * Repository interface กลาง — จุดเชื่อมสำหรับเฟส 2 (Firebase Firestore)
 *
 * เฟส 1: sqliteRepository.js implement interface นี้ทั้งหมด
 * เฟส 2: เพิ่ม firestoreRepository.js ที่ implement เมธอดเดียวกัน แล้วสลับที่จุดสร้าง instance
 *        (ดู server/data/index.js) — routes/frontend ไม่ต้องแก้เลย
 *
 * ทุกเมธอดรับ `filters` เป็น plain object และคืนค่าเป็น Promise เสมอ
 * (แม้ sqlite จะ sync ภายใน ก็ wrap เป็น Promise เพื่อให้ swap เป็น Firestore ได้โดยไม่เปลี่ยน signature)
 */
class Repository {
  /** @returns {Promise<Array<{id, sheet_order, name_th, region}>>} */
  async getProvinces() {
    throw new Error('not implemented');
  }

  /** @returns {Promise<Array<string>>} รายชื่อภาคทั้งหมด ไม่ซ้ำ */
  async getRegions() {
    throw new Error('not implemented');
  }

  /**
   * ดึงข้อมูล fact จากชีท 1-5 (monthly_facts)
   * @param {object} filters
   * @param {string} filters.sheetType - seed_distribution | seed_stocking | production_farm | production_incoming | production_capacity
   * @param {number[]} [filters.provinceIds]
   * @param {string[]} [filters.regions]
   * @param {number} [filters.yearFrom]
   * @param {number} [filters.yearTo]
   * @param {number[]} [filters.months] - 1-12
   * @param {string[]} [filters.species] - whiteleg | black_tiger
   * @returns {Promise<Array>}
   */
  async getMonthlyFacts(filters) {
    throw new Error('not implemented');
  }

  /**
   * ดึงข้อมูล fact จากชีท 6-7 (document_facts)
   * @param {object} filters
   * @param {string} filters.sheetType - document_seed | document_meat
   * @returns {Promise<Array>}
   */
  async getDocumentFacts(filters) {
    throw new Error('not implemented');
  }

  /**
   * ดึงข้อมูลราคา (ชีท 8)
   * @param {object} filters
   * @param {number} [filters.yearFrom]
   * @param {number} [filters.yearTo]
   * @param {string[]} [filters.sizeCategories]
   * @returns {Promise<Array>}
   */
  async getPrices(filters) {
    throw new Error('not implemented');
  }

  /** @returns {Promise<Array>} sync_log ล่าสุดก่อน (เรียงจาก synced_at DESC) */
  async getSyncLogs(limit) {
    throw new Error('not implemented');
  }

  /** @returns {Promise<object|null>} */
  async getUserByUsername(username) {
    throw new Error('not implemented');
  }

  /** @returns {Promise<Array>} */
  async getAllUsers() {
    throw new Error('not implemented');
  }

  async createUser(user) {
    throw new Error('not implemented');
  }

  async deleteUser(userId) {
    throw new Error('not implemented');
  }
}

module.exports = { Repository };
