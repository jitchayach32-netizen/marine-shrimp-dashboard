const path = require('path');
const PdfPrinter = require('pdfmake/src/printer');

const fonts = {
  Tahoma: {
    normal: path.join(__dirname, 'fonts', 'Tahoma.ttf'),
    bold: path.join(__dirname, 'fonts', 'Tahoma-Bold.ttf'),
    italics: path.join(__dirname, 'fonts', 'Tahoma.ttf'),
    bolditalics: path.join(__dirname, 'fonts', 'Tahoma-Bold.ttf')
  }
};

const printer = new PdfPrinter(fonts);

function renderPdfBuffer(docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      const doc = printer.createPdfKitDocument({
        defaultStyle: { font: 'Tahoma', fontSize: 10 },
        pageMargins: [40, 60, 40, 60],
        ...docDefinition
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Table PDF: ตารางข้อมูลดิบ ตรงไปตรงมา สำหรับดูรายละเอียด
async function buildTablePdf({ title, columns, rows, generatedAt }) {
  const tableBody = [
    columns.map((c) => ({ text: c.label, bold: true, fillColor: '#e8f0fe' })),
    ...rows.map((row) => columns.map((c) => String(row[c.key] ?? '-')))
  ];

  return renderPdfBuffer({
    pageOrientation: 'landscape',
    content: [
      { text: title, fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      { text: `สร้างเมื่อ ${generatedAt}`, fontSize: 8, color: '#666666', margin: [0, 0, 0, 12] },
      {
        table: {
          headerRows: 1,
          widths: columns.map(() => 'auto'),
          body: tableBody
        },
        fontSize: 8
      }
    ]
  });
}

// Form PDF: รายงานสรุปสำหรับผู้บริหาร (หัวเรื่อง + ตัวเลขสำคัญ + ตารางสรุปย่อ)
async function buildFormPdf({ title, subtitle, summaryStats, columns, rows, generatedAt }) {
  const summaryContent = summaryStats.map((s) => ({
    columns: [
      { text: s.label, width: '*', color: '#444444' },
      { text: s.value, width: 'auto', bold: true }
    ],
    margin: [0, 2, 0, 2]
  }));

  const tableBody = [
    columns.map((c) => ({ text: c.label, bold: true, fillColor: '#e8f0fe' })),
    ...rows.map((row) => columns.map((c) => String(row[c.key] ?? '-')))
  ];

  return renderPdfBuffer({
    content: [
      { text: 'กรมประมง', fontSize: 10, color: '#666666' },
      { text: title, fontSize: 18, bold: true, margin: [0, 4, 0, 0] },
      { text: subtitle || '', fontSize: 11, color: '#444444', margin: [0, 2, 0, 12] },
      { text: 'สรุปตัวเลขสำคัญ', fontSize: 12, bold: true, margin: [0, 0, 0, 6] },
      ...summaryContent,
      { text: 'รายละเอียดข้อมูล', fontSize: 12, bold: true, margin: [0, 16, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: columns.map(() => 'auto'),
          body: tableBody
        },
        fontSize: 8
      },
      { text: `สร้างเมื่อ ${generatedAt}`, fontSize: 8, color: '#666666', margin: [0, 16, 0, 0] }
    ]
  });
}

module.exports = { buildTablePdf, buildFormPdf };
