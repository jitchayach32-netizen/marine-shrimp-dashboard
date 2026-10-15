const { SqliteRepository } = require('./sqliteRepository');

// เฟส 2: เปลี่ยนบรรทัดนี้เป็น FirestoreRepository เมื่อพร้อม (พร้อม auto-fallback เป็น sqlite เมื่อ offline)
function createRepository(db) {
  return new SqliteRepository(db);
}

module.exports = { createRepository };
