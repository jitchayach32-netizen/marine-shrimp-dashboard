// Logic กลางสำหรับหน้าข้อมูลชีท 1-5 (monthly_facts) - แต่ละหน้า HTML เรียก initMonthlySheetPage(config)
const MONTH_LABELS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function formatNumber(n) {
  return n == null ? '-' : n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

async function initMonthlySheetPage(config) {
  const { sheetType, unitLabel, valueLabel } = config;
  let trendChartWhiteleg, trendChartBlackTiger, regionChart;
  let allProvinces = [];
  let allRegions = [];
  let allYears = [];

  document.getElementById('pageTitle').textContent = config.title;
  document.getElementById('pageSubtitle').textContent = `หน่วย: ${unitLabel}`;

  async function loadFilterOptions() {
    [allProvinces, allRegions] = await Promise.all([
      Api.get('/api/data/provinces'),
      Api.get('/api/data/regions')
    ]);

    const provinceSelect = document.getElementById('provinceFilter');
    for (const p of allProvinces) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name_th;
      provinceSelect.appendChild(opt);
    }

    const regionSelect = document.getElementById('regionFilter');
    for (const r of allRegions) {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      regionSelect.appendChild(opt);
    }

    const currentBE = new Date().getFullYear() + 543;
    allYears = [];
    for (let y = 2565; y <= currentBE; y++) allYears.push(y);

    const yearGroup = document.getElementById('yearFilter');
    yearGroup.innerHTML = allYears.map((y) => `
      <label class="checkbox-group__item">
        <input type="checkbox" class="year-checkbox" value="${y}" ${y >= currentBE - 1 ? 'checked' : ''} />
        พ.ศ. ${y}
      </label>
    `).join('');
  }

  function getSelectedValues(selectEl) {
    return Array.from(selectEl.selectedOptions).map((o) => o.value);
  }

  function getSelectedYears() {
    return Array.from(document.querySelectorAll('#yearFilter .year-checkbox:checked'))
      .map((cb) => parseInt(cb.value, 10))
      .sort((a, b) => a - b);
  }

  function currentFilters() {
    const years = getSelectedYears();
    return {
      provinceIds: getSelectedValues(document.getElementById('provinceFilter')),
      regions: getSelectedValues(document.getElementById('regionFilter')),
      // backend รองรับแค่ yearFrom/yearTo เป็นช่วงต่อเนื่อง ไม่รองรับ list ปีไม่ต่อเนื่อง
      // ยิง query ครอบคลุมทั้งช่วง (min-max ของปีที่ติ๊ก) แล้วกรองเหลือเฉพาะปีที่เลือกจริงตอนสร้างกราฟ
      yearFrom: years.length > 0 ? years[0] : undefined,
      yearTo: years.length > 0 ? years[years.length - 1] : undefined
    };
  }

  async function loadData() {
    const tableWrap = document.getElementById('tableWrap');
    tableWrap.innerHTML = '<div class="loading-state">กำลังโหลดข้อมูล...</div>';

    const selectedYears = getSelectedYears();
    if (selectedYears.length === 0) {
      tableWrap.innerHTML = '<div class="empty-state">กรุณาเลือกอย่างน้อย 1 ปี</div>';
      ShrimpCharts.destroy(trendChartWhiteleg);
      ShrimpCharts.destroy(trendChartBlackTiger);
      ShrimpCharts.destroy(regionChart);
      return;
    }

    const filters = currentFilters();
    const rows = await Api.get(`/api/data/monthly/${sheetType}` + Api.buildQuery(filters));
    const selectedYearSet = new Set(selectedYears);
    const rowsForSelectedYears = rows.filter((r) => selectedYearSet.has(r.year));

    renderTable(rowsForSelectedYears);
    renderTrendChart(rowsForSelectedYears, selectedYears);
    renderRegionChart(rowsForSelectedYears);
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
        <td class="num">${formatNumber(r.value)}</td>
        <td>
          ${r.is_anomaly ? '<span class="badge-anomaly" title="ค่าผิดปกติ: อาจเกิดจากเกษตรกรลงกุ้งเสริมในบ่อเดิมโดยไม่รายงานในระบบ">ผิดปกติ</span>' : ''}
          ${r.is_missing ? '<span class="badge-missing">ไม่มีข้อมูล</span>' : ''}
        </td>
      </tr>
    `).join('');

    tableWrap.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>จังหวัด</th><th>ภาค</th><th>ปี (พ.ศ.)</th><th>เดือน</th>
              <th>สายพันธุ์</th><th>${valueLabel}</th><th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      ${rows.length > 500 ? `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">แสดง 500 จาก ${rows.length} รายการ - ใช้ตัวกรองเพื่อจำกัดผลลัพธ์ หรือ export เพื่อดูข้อมูลครบ</p>` : ''}
    `;
  }

  // group ข้อมูลเป็น { year: { whiteleg: [12 เดือน], black_tiger: [12 เดือน] } }
  // เดือนที่ไม่มีข้อมูล (value เป็น null หรือ is_missing) ต้องเป็น null ใน array ไม่ใช่ 0
  function buildYearMonthSeries(rows, species, selectedYears) {
    const byYear = new Map(selectedYears.map((y) => [y, new Array(12).fill(null)]));
    const hasValue = new Map(selectedYears.map((y) => [y, new Array(12).fill(false)]));

    for (const r of rows) {
      if (r.species !== species) continue;
      if (!byYear.has(r.year)) continue;
      if (r.value == null) continue;
      const monthIdx = r.month - 1;
      const arr = byYear.get(r.year);
      arr[monthIdx] = (hasValue.get(r.year)[monthIdx] ? arr[monthIdx] : 0) + r.value;
      hasValue.get(r.year)[monthIdx] = true;
    }

    return selectedYears.map((year) => ({ year, data: byYear.get(year) }));
  }

  function renderTrendChart(rows, selectedYears) {
    ShrimpCharts.destroy(trendChartWhiteleg);
    ShrimpCharts.destroy(trendChartBlackTiger);

    const whitelegDatasets = buildYearMonthSeries(rows, 'whiteleg', selectedYears);
    const blackTigerDatasets = buildYearMonthSeries(rows, 'black_tiger', selectedYears);

    trendChartWhiteleg = ShrimpCharts.yearOverYearLine(document.getElementById('trendChartWhiteleg'), MONTH_LABELS_TH, whitelegDatasets);
    trendChartBlackTiger = ShrimpCharts.yearOverYearLine(document.getElementById('trendChartBlackTiger'), MONTH_LABELS_TH, blackTigerDatasets);
  }

  function renderRegionChart(rows) {
    const byRegion = new Map();
    for (const r of rows) {
      if (r.value == null) continue;
      byRegion.set(r.region, (byRegion.get(r.region) || 0) + r.value);
    }
    const labels = allRegions.filter((r) => byRegion.has(r));
    const data = labels.map((r) => byRegion.get(r));

    ShrimpCharts.destroy(regionChart);
    const c = ShrimpCharts.seriesColors();
    regionChart = new Chart(document.getElementById('regionChart'), {
      type: 'bar',
      data: { labels, datasets: [{ label: valueLabel, data, backgroundColor: c.whiteleg }] },
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
        const url = Api.downloadUrl(`/api/export/${path}/${sheetType}`, currentFilters());
        window.location.href = url;
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
    document.querySelectorAll('#yearFilter .year-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        loadData().catch((err) => alert(err.message));
      });
    });
    loadData().catch((err) => {
      document.getElementById('tableWrap').innerHTML = `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${err.message}</div>`;
    });
  });

  document.getElementById('applyFilter').addEventListener('click', () => {
    loadData().catch((err) => alert(err.message));
  });
}
