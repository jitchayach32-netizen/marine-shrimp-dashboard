// Chart helper กลาง - config ตามมาตรฐาน dataviz (thin marks, legend เสมอ, single axis)
const ShrimpCharts = {
  seriesColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      whiteleg: style.getPropertyValue('--series-1').trim() || '#2a78d6',
      black_tiger: style.getPropertyValue('--series-2').trim() || '#eb6834',
      textSecondary: style.getPropertyValue('--text-secondary').trim() || '#52514e',
      gridline: style.getPropertyValue('--gridline').trim() || '#e1e0d9'
    };
  },

  baseOptions() {
    const c = this.seriesColors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: c.textSecondary, boxWidth: 12, font: { size: 11 } } },
        tooltip: { enabled: true, mode: 'index', intersect: false }
      },
      scales: {
        x: { grid: { color: c.gridline }, ticks: { color: c.textSecondary, font: { size: 10 } } },
        y: { grid: { color: c.gridline }, ticks: { color: c.textSecondary, font: { size: 10 } }, beginAtZero: true }
      }
    };
  },

  // เส้นแนวโน้มรายเดือน แยกตามสายพันธุ์ (whiteleg / black_tiger) - single axis เสมอ
  monthlyTrendLine(canvas, monthLabels, whitelegData, blackTigerData) {
    const c = this.seriesColors();
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: 'กุ้งขาวแวนนาไม',
            data: whitelegData,
            borderColor: c.whiteleg,
            backgroundColor: c.whiteleg + '22',
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
            tension: 0.15
          },
          {
            label: 'กุ้งกุลาดำ',
            data: blackTigerData,
            borderColor: c.black_tiger,
            backgroundColor: c.black_tiger + '22',
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
            tension: 0.15
          }
        ]
      },
      options: this.baseOptions()
    });
  },

  // แท่งเปรียบเทียบรายภาค/จังหวัด (thin bars)
  groupedBar(canvas, labels, datasets) {
    const opts = this.baseOptions();
    return new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: { ...opts, scales: { ...opts.scales, x: { ...opts.scales.x, stacked: false } } }
    });
  },

  // เส้นแนวโน้มรายเดือน เทียบหลายปีซ้อนกัน (แกน X คงที่ 12 เดือนเสมอ)
  // yearDatasets: [{ year, data }] เรียงปีจากน้อยไปมาก (ผู้เรียกต้อง sort มาก่อน)
  // แต่ละปีได้สีต่างกันตามลำดับ --series-1..8, แกน Y auto-scale อิสระเพราะเป็นคนละ Chart instance ต่อการเรียกครั้งหนึ่ง
  yearOverYearLine(canvas, monthLabels, yearDatasets) {
    const style = getComputedStyle(document.documentElement);
    const seriesVars = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];

    const datasets = yearDatasets.map(({ year, data }, i) => {
      const color = style.getPropertyValue(seriesVars[i % seriesVars.length]).trim();
      return {
        label: `พ.ศ. ${year}`,
        data,
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointRadius: 3,
        fill: false,
        tension: 0.15,
        spanGaps: false
      };
    });

    return new Chart(canvas, {
      type: 'line',
      data: { labels: monthLabels, datasets },
      options: this.baseOptions()
    });
  },

  // เส้นแนวโน้มรายเดือน แสดงทุกหมวดพร้อมกันในกราฟเดียว (ใช้กับหน้าราคา - ทุกขนาดในปีเดียว)
  // sizeDatasets: [{ label, data }] เรียงตามลำดับคงที่ (เช่น ขนาด 40,50,60,...) เพื่อให้สีเดียวกัน=หมวดเดียวกันทุกกราฟที่เรียกฟังก์ชันนี้
  facetedLineChart(canvas, monthLabels, sizeDatasets) {
    const style = getComputedStyle(document.documentElement);
    const seriesVars = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];

    const datasets = sizeDatasets.map(({ label, data }, i) => {
      const color = style.getPropertyValue(seriesVars[i % seriesVars.length]).trim();
      return {
        label,
        data,
        borderColor: color,
        backgroundColor: color + '22',
        borderWidth: 2,
        pointRadius: 2,
        fill: false,
        tension: 0.15,
        spanGaps: false
      };
    });

    return new Chart(canvas, {
      type: 'line',
      data: { labels: monthLabels, datasets },
      options: this.baseOptions()
    });
  },

  destroy(chartInstance) {
    if (chartInstance) chartInstance.destroy();
  }
};
