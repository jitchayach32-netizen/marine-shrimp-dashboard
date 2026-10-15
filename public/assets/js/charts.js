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

  destroy(chartInstance) {
    if (chartInstance) chartInstance.destroy();
  }
};
