// สร้าง CSV จาก array ของ object แบบตรงไปตรงมา (ไม่ต้องพึ่ง library ภายนอก)
function toCsv(rows, columns) {
  const escapeCell = (value) => {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','));
  // BOM นำหน้าเพื่อให้ Excel เปิดภาษาไทยไม่เพี้ยน
  return '﻿' + [header, ...lines].join('\r\n');
}

module.exports = { toCsv };
