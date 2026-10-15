// แปลงข้อมูลดิบจาก Google Sheet (rows แบบ 2D array จาก sheetsClient) เป็น fact rows
// สำหรับเก็บลง SQLite ตาม schema.sql

const THAI_MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

// พ.ศ. 2 หลัก (65 = 2565) → ค.ศ. เต็ม (เก็บเป็น พ.ศ. เต็มในระบบ เพื่อให้ตรงกับที่ผู้ใช้คุ้นเคย)
// "Jan 65" -> { month: 1, yearBE: 2565 }
function parseMonthHeader(text) {
  const m = text.trim().match(/^([A-Za-z]{3})\s+(\d{2})$/);
  if (!m) return null;
  const month = THAI_MONTHS[m[1]];
  if (!month) return null;
  const yy = parseInt(m[2], 10);
  const yearBE = 2500 + yy;
  return { month, yearBE };
}

function parseNumber(raw) {
  if (raw == null) return { value: null, isMissing: true };
  const trimmed = String(raw).trim();
  if (trimmed === '' || trimmed === '-') return { value: null, isMissing: true };
  const cleaned = trimmed.replace(/,/g, '');
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return { value: null, isMissing: true };
  return { value: n, isMissing: false };
}

// ชีท "กำลังการผลิต" (production_capacity): ค่า >20 ตัน/ล้านตัว ถือว่าผิดปกติ
// ตามหมายเหตุต้นฉบับ - เกิดจากเกษตรกรลงกุ้งเสริมในบ่อเดิมโดยไม่รายงานในระบบ
// ต้องแสดงค่าจริง ไม่ตัดทิ้ง แต่ติด flag ให้ frontend ใส่ tooltip เตือน
const CAPACITY_ANOMALY_THRESHOLD = 20;
function isCapacityAnomaly(sheetType, value) {
  return sheetType === 'production_capacity' && value != null && value > CAPACITY_ANOMALY_THRESHOLD;
}

// บาง cell ในไฟล์ต้นฉบับมี encoding เสียหาย (U+FFFD แทรกกลางคำหรือท้ายคำ เช่น
// "นครศรีธรรมรา" + FFFD + FFFD หรือ "นน" + FFFD + "บุรี")
// ถ้า exact match ไม่เจอ ให้ตัดตัวอักษรเสียออกแล้วเทียบว่าส่วนที่เหลือ (แยกเป็นชิ้นๆ) ตรงกับ
// จังหวัดใดจังหวัดหนึ่งแบบไม่กำกวม โดยชิ้นก่อน/หลัง FFFD ต้องตรงกับต้น/ท้ายของชื่อจริงตามลำดับ
function resolveProvinceId(rawName, provinceIdByName) {
  const exact = provinceIdByName.get(rawName);
  if (exact) return exact;

  if (!rawName.includes('�')) return null;

  const parts = rawName.split('�').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const candidates = [];
  for (const [name, id] of provinceIdByName) {
    let cursor = 0;
    let matchesAll = true;
    for (const part of parts) {
      const idx = name.indexOf(part, cursor);
      if (idx === -1) {
        matchesAll = false;
        break;
      }
      cursor = idx + part.length;
    }
    if (matchesAll) candidates.push(id);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

// หาตำแหน่งคอลัมน์เริ่มต้นของแต่ละเดือนจาก header row โดยอ่านข้อความจริง ไม่เดา offset
// คืนค่า [{ colIndex, month, yearBE }]
function findMonthColumns(headerRow) {
  const months = [];
  for (let i = 0; i < headerRow.length; i++) {
    const parsed = parseMonthHeader(headerRow[i]);
    if (parsed) months.push({ colIndex: i, ...parsed });
  }
  return months;
}

// ชีท 1,2,3,4,5: จังหวัด × เดือน × 2 ค่า (ขาวแวนนาไม, กุลาดำ)
// province อยู่คอลัมน์ 1, เดือนเริ่มจากคอลัมน์ที่เจอใน header
function parseMonthlyFactsSheet(rows, sheetType, provinceIdByName) {
  const headerRow = rows[1];
  const monthCols = findMonthColumns(headerRow);
  const facts = [];
  const unmatchedProvinces = new Set();

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const rowIndex = (row[0] || '').trim();
    const provinceName = (row[1] || '').trim();
    // แถวข้อมูลจังหวัดจริงต้องมีเลขลำดับที่คอลัมน์ 0 เสมอ (1-36)
    // แถวว่าง/แถว total/แถวหมายเหตุท้ายตาราง จะไม่มีเลขลำดับ จึงข้ามไป
    if (!provinceName || !/^\d+$/.test(rowIndex)) continue;

    const provinceId = resolveProvinceId(provinceName, provinceIdByName);
    if (!provinceId) {
      unmatchedProvinces.add(provinceName);
      continue;
    }

    for (const { colIndex, month, yearBE } of monthCols) {
      const whiteleg = parseNumber(row[colIndex]);
      const blackTiger = parseNumber(row[colIndex + 1]);

      facts.push({
        sheet_type: sheetType,
        province_id: provinceId,
        year: yearBE,
        month,
        species: 'whiteleg',
        value: whiteleg.value,
        is_missing: whiteleg.isMissing ? 1 : 0,
        is_anomaly: isCapacityAnomaly(sheetType, whiteleg.value) ? 1 : 0
      });
      facts.push({
        sheet_type: sheetType,
        province_id: provinceId,
        year: yearBE,
        month,
        species: 'black_tiger',
        value: blackTiger.value,
        is_missing: blackTiger.isMissing ? 1 : 0,
        is_anomaly: isCapacityAnomaly(sheetType, blackTiger.value) ? 1 : 0
      });
    }
  }

  return { facts, unmatchedProvinces: [...unmatchedProvinces] };
}

// ชีท 6,7: จังหวัด × เดือน × 4 ค่า (ฉบับ-ขาว, แห่ง-ขาว, ฉบับ-กุลาดำ, แห่ง-กุลาดำ)
function parseDocumentFactsSheet(rows, sheetType, provinceIdByName) {
  const headerRow = rows[1];
  const monthCols = findMonthColumns(headerRow);
  const facts = [];
  const unmatchedProvinces = new Set();

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const rowIndex = (row[0] || '').trim();
    const provinceName = (row[1] || '').trim();
    if (!provinceName || !/^\d+$/.test(rowIndex)) continue;

    const provinceId = resolveProvinceId(provinceName, provinceIdByName);
    if (!provinceId) {
      unmatchedProvinces.add(provinceName);
      continue;
    }

    for (const { colIndex, month, yearBE } of monthCols) {
      const whitelegDocs = parseNumber(row[colIndex]);
      const whitelegFacilities = parseNumber(row[colIndex + 1]);
      const blackTigerDocs = parseNumber(row[colIndex + 2]);
      const blackTigerFacilities = parseNumber(row[colIndex + 3]);

      facts.push({
        sheet_type: sheetType,
        province_id: provinceId,
        year: yearBE,
        month,
        species: 'whiteleg',
        doc_count: whitelegDocs.value,
        facility_count: whitelegFacilities.value
      });
      facts.push({
        sheet_type: sheetType,
        province_id: provinceId,
        year: yearBE,
        month,
        species: 'black_tiger',
        doc_count: blackTigerDocs.value,
        facility_count: blackTigerFacilities.value
      });
    }
  }

  return { facts, unmatchedProvinces: [...unmatchedProvinces] };
}

// ชีท 8: ราคา ไม่มีจังหวัด เดือนอยู่คอลัมน์ 0 รูปแบบ "ม.ค. 2565" (ชื่อเดือนไทยย่อ + พ.ศ. 4 หลัก)
// คอลัมน์คงที่: 0=เดือน, 1=40ตัว/กก, 2=50, 3=60, 4=70, 5=80, 6=90, 7=100, 8=จำนวนตู้
const PRICE_SIZE_CATEGORIES = ['40', '50', '60', '70', '80', '90', '100'];

const THAI_MONTH_NAMES_SHORT = {
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
  'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12
};

function parsePricesSheet(rows) {
  const facts = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const monthText = (row[0] || '').trim();
    const parsed = parseThaiMonthHeader(monthText);
    if (!parsed) continue;

    for (let i = 0; i < PRICE_SIZE_CATEGORIES.length; i++) {
      const price = parseNumber(row[1 + i]);
      facts.push({
        year: parsed.yearBE,
        month: parsed.month,
        size_category: PRICE_SIZE_CATEGORIES[i],
        price_baht: price.value,
        container_count: null
      });
    }
    const containerCount = parseNumber(row[8]);
    if (facts.length > 0) {
      facts[facts.length - 1].container_count = containerCount.value;
    }
  }
  return { facts };
}

// "ม.ค. 2565" -> { month: 1, yearBE: 2565 }
// บาง cell ในต้นฉบับพิมพ์จุดท้ายเดือนตกหล่น (เช่น "มี.ค 2569" แทน "มี.ค. 2569") - normalize ด้วยการเติมจุดท้ายให้ก่อน lookup
function parseThaiMonthHeader(text) {
  const m = text.trim().match(/^([ก-๏.]+)\s+(\d{4})$/);
  if (!m) return null;
  const monthKey = m[1].endsWith('.') ? m[1] : m[1] + '.';
  const month = THAI_MONTH_NAMES_SHORT[monthKey];
  if (!month) return null;
  const yearBE = parseInt(m[2], 10);
  return { month, yearBE };
}

module.exports = {
  parseMonthHeader,
  parseNumber,
  resolveProvinceId,
  findMonthColumns,
  parseMonthlyFactsSheet,
  parseDocumentFactsSheet,
  parsePricesSheet
};
