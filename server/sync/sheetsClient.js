const https = require('https');

const SPREADSHEET_ID = '1ACT5En5oeWWJXkyb0i7PjduBAxMnRtmW';

const SHEETS = {
  seed_distribution: { gid: '1895875065', name: 'ปริมาณการจำหน่ายลูกพันธุ์กุ้ง รายจังหวัด', valueCols: 2 },
  seed_stocking: { gid: '1787083533', name: 'ปริมาณการปล่อยกุ้งทะเลลงเลี้ยง รายจังหวัด', valueCols: 2 },
  production_farm: { gid: '1217883433', name: 'ปริมาณผลผลิตกุ้งทะเล รายจังหวัด (ขายออกจากฟาร์ม)', valueCols: 2 },
  production_incoming: { gid: '1489090653', name: 'ปริมาณผลผลิตกุ้งทะเล รายจังหวัด (ขาเข้า)', valueCols: 2 },
  production_capacity: { gid: '1375532166', name: 'กำลังการผลิตกุ้งทะเล รายจังหวัด', valueCols: 2 },
  document_seed: { gid: '1101757867', name: 'ปริมาณการออกเอกสารกำกับการจำหน่ายลูกพันธุ์กุ้ง', valueCols: 4 },
  document_meat: { gid: '2022393267', name: 'ปริมาณการออกเอกสารกำกับการจำหน่ายกุ้งเนื้อ', valueCols: 4 },
  prices: { gid: '120758004', name: 'ราคากุ้งขาวแวนนาไมเฉลี่ยรายเดือน ตลาดทะเลไทย', valueCols: 1 }
};

function fetchCsv(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching gid=${gid}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// RFC4180-ish CSV line parser (handles quoted fields with embedded commas/quotes)
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.length > 0)
    .map(parseCsvLine);
}

async function fetchSheetRows(sheetKey) {
  const sheet = SHEETS[sheetKey];
  if (!sheet) throw new Error(`Unknown sheet key: ${sheetKey}`);
  const csvText = await fetchCsv(sheet.gid);
  return parseCsv(csvText);
}

module.exports = { SHEETS, fetchCsv, parseCsv, fetchSheetRows };
