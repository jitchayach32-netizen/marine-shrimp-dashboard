const path = require('path');
const express = require('express');

const { initDb } = require('./db/init');
const { createRepository } = require('./data');
const { runSync } = require('./sync/syncJob');

const { createDataRouter } = require('./routes/data');
const { createAdminRouter } = require('./routes/admin');
const { createExportRouter } = require('./routes/export');

const PORT = process.env.PORT || 3000;
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // ซิงค์ข้อมูลจาก Google Sheet อัตโนมัติทุก 15 นาที

const db = initDb();
const repo = createRepository(db);

const app = express();
app.use(express.json());

app.use('/api/data', createDataRouter(repo));
app.use('/api/admin', createAdminRouter(repo, db, runSync));
app.use('/api/export', createExportRouter(repo));

app.get('/', (req, res) => res.redirect('/dashboard.html'));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Marine Shrimp Dashboard กำลังทำงานที่ http://localhost:${PORT}`);

  runSync(db)
    .then((result) => console.log('เริ่มต้น sync ข้อมูลจาก Google Sheet สำเร็จ:', result.status, `(${result.rowsSynced} rows)`))
    .catch((err) => console.error('เริ่มต้น sync ข้อมูลล้มเหลว:', err.message));

  setInterval(() => {
    runSync(db)
      .then((result) => console.log('[auto-sync]', result.status, `(${result.rowsSynced} rows)`))
      .catch((err) => console.error('[auto-sync] ล้มเหลว:', err.message));
  }, SYNC_INTERVAL_MS);
});
