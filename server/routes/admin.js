const express = require('express');

function createAdminRouter(repo, db, runSync) {
  const router = express.Router();

  router.get('/sync-log', async (req, res) => {
    const logs = await repo.getSyncLogs(50);
    res.json(logs);
  });

  router.post('/sync', async (req, res) => {
    try {
      const result = await runSync(db);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Sync ล้มเหลว', detail: err.message });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
