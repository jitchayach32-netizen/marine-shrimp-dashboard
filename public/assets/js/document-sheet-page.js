// Logic กลางสำหรับหน้าข้อมูลชีท 6-7 (document_facts) - แต่ละหน้า HTML เรียก initDocumentSheetPage(config)
async function initDocumentSheetPage(config) {
  const { sheetType, title } = config;
  let trendChart, regionChart;
  let allRegions = [];

  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = 'หน่วย: ฉบับ / แห่ง';

  async function loadFilterOptions() {
    const [provinces, regions] = await Promise.all([
      Api.get('/api/data/provinces'),
      Api.get('/api/data/regions')
    ]);
    allRegions = regions;

    const provinceSelect = document.getElementById('provinceFilter');
    for (const p of provinces) {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name_th;
      provinceSelect.appendChild(opt);
    }
    const regionSelect = document.getElementById('regionFilter');
    for (const r of regions) {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      regionSelect.appendChild(opt);
    }

    const yearSelect = document.getElementById('yearFromFilter');
    const yearToSelect = document.getElementById('yearToFilter');
    const currentBE = new Date().getFullYear() + 543;
    for (let y = 2565; y <= currentBE; y++) {
      const opt1 = document.createElement('option');
      opt1.value = y; opt1.textContent = `พ.ศ. ${y}`;
      yearSelect.appendChild(opt1);
      const opt2 = document.createElement('option');
      opt2.value = y; opt2.textContent = `พ.ศ. ${y}`;
      if (y === currentBE) opt2.selected = true;
      yearToSelect.appendChild(opt2);
    }
    yearSelect.value = 2565;
  }

  function getSelectedValues(selectEl) {
    return Array.from(selectEl.selectedOptions).map((o) => o.value);
  }

  function currentFilters() {
    return {
      provinceIds: getSelectedValues(document.getElementById('provinceFilter')),
      regions: getSelectedValues(document.getElementById('regionFilter')),
      yearFrom: document.getElementById('yearFromFilter').value,
      yearTo: document.getElementById('yearToFilter').value
    };
  }

  async function loadData() {
    const tableWrap = document.getElementById('tableWrap');
    tableWrap.innerHTML = '<div class="loading-state">กำลังโหลดข้อมูล...</div>';

    const rows = await Api.get(`/api/data/documents/${sheetType}` + Api.buildQuery(currentFilters()));
    renderTable(rows);
    renderTrendChart(rows);
    renderRegionChart(rows);
  }

  function renderTable(rows) {
    const tableWrap = document.getElementById('tableWrap');
    if (rows.length === 0) {
      tableWrap.innerHTML = '<div class="empty-state">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>';
      return;
    }
    const speciesLabel = { whiteleg: 'กุ้งขาวแวนนาไม', black_tiger: 'กุ้งกุลาดำ' };
    const rowsHtml = rows.slice(0, 500).map((r) => `
      <tr>
        <td>${r.province_name}</td>
        <td>${r.region}</td>
        <td>${r.year}</td>
        <td>${MONTH_LABELS_TH[r.month - 1]}</td>
        <td>${speciesLabel[r.species] || r.species}</td>
        <td class="num">${formatNumber(r.doc_count)}</td>
        <td class="num">${formatNumber(r.facility_count)}</td>
      </tr>
    `).join('');

    tableWrap.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>จังหวัด</th><th>ภาค</th><th>ปี (พ.ศ.)</th><th>เดือน</th><th>สายพันธุ์</th><th>จำนวนฉบับ</th><th>จำนวนแห่ง</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${rows.length > 500 ? `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">แสดง 500 จาก ${rows.length} รายการ - ใช้ตัวกรองเพื่อจำกัดผลลัพธ์ หรือ export เพื่อดูข้อมูลครบ</p>` : ''}
      <p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">หมายเหตุ: จำนวนสถานประกอบกิจการอาจมีการนับซ้ำ เนื่องจากสถานประกอบกิจการบางแห่งอาจปล่อยทั้งลูกพันธุ์กุ้งขาวแวนนาไมและลูกพันธุ์กุ้งกุลาดำลงเลี้ยง</p>
    `;
  }

  function renderTrendChart(rows) {
    const byYearMonth = new Map();
    for (const r of rows) {
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
      if (!byYearMonth.has(key)) byYearMonth.set(key, { whiteleg: 0, black_tiger: 0 });
      byYearMonth.get(key)[r.species] += (r.doc_count || 0);
    }
    const keys = [...byYearMonth.keys()].sort();
    const labels = keys.map((k) => {
      const [y, m] = k.split('-');
      return `${MONTH_LABELS_TH[parseInt(m, 10) - 1]} ${y}`;
    });
    const whiteleg = keys.map((k) => byYearMonth.get(k).whiteleg);
    const blackTiger = keys.map((k) => byYearMonth.get(k).black_tiger);

    ShrimpCharts.destroy(trendChart);
    trendChart = ShrimpCharts.monthlyTrendLine(document.getElementById('trendChart'), labels, whiteleg, blackTiger);
  }

  function renderRegionChart(rows) {
    const byRegion = new Map();
    for (const r of rows) {
      byRegion.set(r.region, (byRegion.get(r.region) || 0) + (r.doc_count || 0));
    }
    const labels = allRegions.filter((r) => byRegion.has(r));
    const data = labels.map((r) => byRegion.get(r));

    ShrimpCharts.destroy(regionChart);
    const c = ShrimpCharts.seriesColors();
    regionChart = new Chart(document.getElementById('regionChart'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'จำนวนฉบับ', data, backgroundColor: c.whiteleg }] },
      options: { ...ShrimpCharts.baseOptions(), plugins: { legend: { display: false } } }
    });
  }

  function setupExportButtons() {
    const exportBar = document.getElementById('exportBar');
    exportBar.innerHTML = `
      <a class="btn btn-secondary" id="exportCsv">ดาวน์โหลด CSV</a>
      <a class="btn btn-secondary" id="exportExcel">ดาวน์โหลด Excel</a>
      <a class="btn btn-secondary" id="exportTablePdf">ดาวน์โหลด Table PDF</a>
      <a class="btn btn-secondary" id="exportFormPdf">ดาวน์โหลด Form PDF (รายงานสรุป)</a>
    `;

    const bindExport = (id, path) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', () => {
        window.location.href = Api.downloadUrl(`/api/export/${path}/${sheetType}`, currentFilters());
      });
    };
    bindExport('exportCsv', 'csv');
    bindExport('exportExcel', 'excel');
    bindExport('exportTablePdf', 'table-pdf');
    bindExport('exportFormPdf', 'form-pdf');
  }

  document.addEventListener('shrimp:ready', async () => {
    setupExportButtons();
    await loadFilterOptions();
    loadData().catch((err) => {
      document.getElementById('tableWrap').innerHTML = `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${err.message}</div>`;
    });
  });

  document.getElementById('applyFilter').addEventListener('click', () => {
    loadData().catch((err) => alert(err.message));
  });
}
