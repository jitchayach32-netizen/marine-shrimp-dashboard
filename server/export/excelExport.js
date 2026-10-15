const ExcelJS = require('exceljs');

async function toExcelBuffer(rows, columns, sheetName = 'ข้อมูล') {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: 18 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

module.exports = { toExcelBuffer };
