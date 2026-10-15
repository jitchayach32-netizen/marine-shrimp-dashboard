const express = require('express');

const MONTHLY_SHEET_TYPES = new Set([
  'seed_distribution',
  'seed_stocking',
  'production_farm',
  'production_incoming',
  'production_capacity'
]);
const DOCUMENT_SHEET_TYPES = new Set(['document_seed', 'document_meat']);

function parseListParam(value) {
  if (!value) return undefined;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntListParam(value) {
  const list = parseListParam(value);
  return list ? list.map((v) => parseInt(v, 10)).filter((n) => !Number.isNaN(n)) : undefined;
}

function createDataRouter(repo) {
  const router = express.Router();

  router.get('/provinces', async (req, res) => {
    const provinces = await repo.getProvinces();
    res.json(provinces);
  });

  router.get('/regions', async (req, res) => {
    const regions = await repo.getRegions();
    res.json(regions);
  });

  // ข้อมูลชีท 1-5: /api/data/monthly/:sheetType?provinceIds=1,2&regions=ภาคใต้ตอนบน&yearFrom=2565&yearTo=2569&months=1,2&species=whiteleg
  router.get('/monthly/:sheetType', async (req, res) => {
    const { sheetType } = req.params;
    if (!MONTHLY_SHEET_TYPES.has(sheetType)) {
      return res.status(400).json({ error: `ไม่รู้จักชีทข้อมูล: ${sheetType}` });
    }

    const facts = await repo.getMonthlyFacts({
      sheetType,
      provinceIds: parseIntListParam(req.query.provinceIds),
      regions: parseListParam(req.query.regions),
      yearFrom: req.query.yearFrom ? parseInt(req.query.yearFrom, 10) : undefined,
      yearTo: req.query.yearTo ? parseInt(req.query.yearTo, 10) : undefined,
      months: parseIntListParam(req.query.months),
      species: parseListParam(req.query.species)
    });
    res.json(facts);
  });

  // ข้อมูลชีท 6-7: /api/data/documents/:sheetType?...(same filters)
  router.get('/documents/:sheetType', async (req, res) => {
    const { sheetType } = req.params;
    if (!DOCUMENT_SHEET_TYPES.has(sheetType)) {
      return res.status(400).json({ error: `ไม่รู้จักชีทข้อมูล: ${sheetType}` });
    }

    const facts = await repo.getDocumentFacts({
      sheetType,
      provinceIds: parseIntListParam(req.query.provinceIds),
      regions: parseListParam(req.query.regions),
      yearFrom: req.query.yearFrom ? parseInt(req.query.yearFrom, 10) : undefined,
      yearTo: req.query.yearTo ? parseInt(req.query.yearTo, 10) : undefined,
      months: parseIntListParam(req.query.months),
      species: parseListParam(req.query.species)
    });
    res.json(facts);
  });

  // ข้อมูลชีท 8 (ราคา): /api/data/prices?yearFrom=2565&yearTo=2569&sizeCategories=60,70
  router.get('/prices', async (req, res) => {
    const prices = await repo.getPrices({
      yearFrom: req.query.yearFrom ? parseInt(req.query.yearFrom, 10) : undefined,
      yearTo: req.query.yearTo ? parseInt(req.query.yearTo, 10) : undefined,
      sizeCategories: parseListParam(req.query.sizeCategories)
    });
    res.json(prices);
  });

  return router;
}

module.exports = { createDataRouter, MONTHLY_SHEET_TYPES, DOCUMENT_SHEET_TYPES };
