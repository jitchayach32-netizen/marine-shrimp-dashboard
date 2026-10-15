const express = require('express');
const { toCsv } = require('../export/csvExport');
const { toExcelBuffer } = require('../export/excelExport');
const { buildTablePdf, buildFormPdf } = require('../export/pdfExport');
const { MONTHLY_SHEET_TYPES, DOCUMENT_SHEET_TYPES } = require('./data');

const SHEET_LABELS = {
  seed_distribution: 'ปริมาณการจำหน่ายลูกพันธุ์กุ้ง รายจังหวัด',
  seed_stocking: 'ปริมาณการปล่อยกุ้งทะเลลงเลี้ยง รายจังหวัด',
  production_farm: 'ปริมาณผลผลิตกุ้งทะเล รายจังหวัด (ขายออกจากฟาร์ม)',
  production_incoming: 'ปริมาณผลผลิตกุ้งทะเล รายจังหวัด (ขาเข้า)',
  production_capacity: 'กำลังการผลิตกุ้งทะเล รายจังหวัด',
  document_seed: 'ปริมาณการออกเอกสารกำกับการจำหน่ายลูกพันธุ์กุ้ง',
  document_meat: 'ปริมาณการออกเอกสารกำกับการจำหน่ายกุ้งเนื้อ',
  prices: 'ราคากุ้งขาวแวนนาไมเฉลี่ยรายเดือน ตลาดทะเลไทย'
};

const SPECIES_LABELS = { whiteleg: 'กุ้งขาวแวนนาไม', black_tiger: 'กุ้งกุลาดำ' };

const MONTHLY_COLUMNS = [
  { key: 'province_name', label: 'จังหวัด' },
  { key: 'region', label: 'ภาค' },
  { key: 'year', label: 'ปี (พ.ศ.)' },
  { key: 'month', label: 'เดือน' },
  { key: 'species_label', label: 'สายพันธุ์' },
  { key: 'value', label: 'ค่า' },
  { key: 'anomaly_label', label: 'หมายเหตุ' }
];

const DOCUMENT_COLUMNS = [
  { key: 'province_name', label: 'จังหวัด' },
  { key: 'region', label: 'ภาค' },
  { key: 'year', label: 'ปี (พ.ศ.)' },
  { key: 'month', label: 'เดือน' },
  { key: 'species_label', label: 'สายพันธุ์' },
  { key: 'doc_count', label: 'จำนวนฉบับ' },
  { key: 'facility_count', label: 'จำนวนแห่ง' }
];

const PRICE_COLUMNS = [
  { key: 'year', label: 'ปี (ค.ศ.)' },
  { key: 'month', label: 'เดือน' },
  { key: 'size_category', label: 'ขนาด (ตัว/กก.)' },
  { key: 'price_baht', label: 'ราคา (บาท)' },
  { key: 'container_count', label: 'จำนวนตู้' }
];

function enrichMonthlyRows(rows) {
  return rows.map((r) => ({
    ...r,
    species_label: SPECIES_LABELS[r.species] || r.species,
    anomaly_label: r.is_anomaly ? 'ค่าผิดปกติ (ลงกุ้งเสริมโดยไม่รายงาน)' : r.is_missing ? 'ไม่มีข้อมูล' : ''
  }));
}

function enrichDocumentRows(rows) {
  return rows.map((r) => ({ ...r, species_label: SPECIES_LABELS[r.species] || r.species }));
}

function nowThaiString() {
  return new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });
}

function computeSummaryStats(rows, valueKey) {
  const values = rows.map((r) => r[valueKey]).filter((v) => v != null);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = values.length > 0 ? sum / values.length : 0;
  return [
    { label: 'จำนวนรายการทั้งหมด', value: String(rows.length) },
    { label: 'ผลรวม', value: sum.toLocaleString('th-TH', { maximumFractionDigits: 2 }) },
    { label: 'ค่าเฉลี่ย', value: avg.toLocaleString('th-TH', { maximumFractionDigits: 2 }) }
  ];
}

async function loadRows(repo, kind, sheetType, query) {
  const filters = {
    sheetType,
    provinceIds: query.provinceIds ? query.provinceIds.split(',').map(Number) : undefined,
    regions: query.regions ? query.regions.split(',') : undefined,
    yearFrom: query.yearFrom ? parseInt(query.yearFrom, 10) : undefined,
    yearTo: query.yearTo ? parseInt(query.yearTo, 10) : undefined,
    months: query.months ? query.months.split(',').map(Number) : undefined,
    species: query.species ? query.species.split(',') : undefined
  };

  if (kind === 'monthly') return enrichMonthlyRows(await repo.getMonthlyFacts(filters));
  if (kind === 'documents') return enrichDocumentRows(await repo.getDocumentFacts(filters));
  if (kind === 'prices')
    return repo.getPrices({
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      sizeCategories: query.sizeCategories ? query.sizeCategories.split(',') : undefined
    });
  throw new Error(`unknown kind: ${kind}`);
}

function resolveKindAndColumns(sheetType) {
  if (sheetType === 'prices') return { kind: 'prices', columns: PRICE_COLUMNS };
  if (MONTHLY_SHEET_TYPES.has(sheetType)) return { kind: 'monthly', columns: MONTHLY_COLUMNS };
  if (DOCUMENT_SHEET_TYPES.has(sheetType)) return { kind: 'documents', columns: DOCUMENT_COLUMNS };
  return null;
}

function createExportRouter(repo) {
  const router = express.Router();

  router.get('/csv/:sheetType', async (req, res) => {
    const resolved = resolveKindAndColumns(req.params.sheetType);
    if (!resolved) return res.status(400).json({ error: 'ไม่รู้จักชีทข้อมูล' });

    const rows = await loadRows(repo, resolved.kind, req.params.sheetType, req.query);
    const csv = toCsv(rows, resolved.columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.sheetType}.csv"`);
    res.send(csv);
  });

  router.get('/excel/:sheetType', async (req, res) => {
    const resolved = resolveKindAndColumns(req.params.sheetType);
    if (!resolved) return res.status(400).json({ error: 'ไม่รู้จักชีทข้อมูล' });

    const rows = await loadRows(repo, resolved.kind, req.params.sheetType, req.query);
    const buffer = await toExcelBuffer(rows, resolved.columns, SHEET_LABELS[req.params.sheetType] || 'ข้อมูล');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.sheetType}.xlsx"`);
    res.send(buffer);
  });

  router.get('/table-pdf/:sheetType', async (req, res) => {
    const resolved = resolveKindAndColumns(req.params.sheetType);
    if (!resolved) return res.status(400).json({ error: 'ไม่รู้จักชีทข้อมูล' });

    const rows = await loadRows(repo, resolved.kind, req.params.sheetType, req.query);
    const buffer = await buildTablePdf({
      title: SHEET_LABELS[req.params.sheetType] || req.params.sheetType,
      columns: resolved.columns,
      rows,
      generatedAt: nowThaiString()
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.sheetType}-table.pdf"`);
    res.send(buffer);
  });

  router.get('/form-pdf/:sheetType', async (req, res) => {
    const resolved = resolveKindAndColumns(req.params.sheetType);
    if (!resolved) return res.status(400).json({ error: 'ไม่รู้จักชีทข้อมูล' });

    const rows = await loadRows(repo, resolved.kind, req.params.sheetType, req.query);
    const valueKey = resolved.kind === 'monthly' ? 'value' : resolved.kind === 'prices' ? 'price_baht' : 'doc_count';
    const buffer = await buildFormPdf({
      title: SHEET_LABELS[req.params.sheetType] || req.params.sheetType,
      subtitle: 'รายงานสรุปสำหรับผู้บริหาร',
      summaryStats: computeSummaryStats(rows, valueKey),
      columns: resolved.columns,
      rows,
      generatedAt: nowThaiString()
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.sheetType}-report.pdf"`);
    res.send(buffer);
  });

  return router;
}

module.exports = { createExportRouter };
