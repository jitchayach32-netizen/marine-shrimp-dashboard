// SVG choropleth renderer สำหรับแผนที่ประเทศไทยรายจังหวัด - ไม่พึ่ง library แผนที่ภายนอก
const ThailandMap = {
  _geoData: null,
  _svgEl: null,
  _tooltipEl: null,
  _geoMapping: null,
  _pathsByProvinceName: null,
  _onProvinceClick: null,

  async loadGeoData() {
    if (this._geoData) return this._geoData;
    const res = await fetch('/assets/data/thailand-provinces.geo.json');
    this._geoData = await res.json();
    return this._geoData;
  },

  async loadGeoMapping() {
    if (this._geoMapping) return this._geoMapping;
    const res = await fetch('/assets/data/provinceGeoMapping.json');
    this._geoMapping = await res.json();
    return this._geoMapping;
  },

  // Equirectangular projection อย่างง่าย: lon/lat -> screen x/y โดย fit bounding box ลงใน viewBox
  _buildProjection(geoData, width, height, padding) {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;

    const scanCoords = (coords, depth) => {
      if (depth === 0) {
        const [lon, lat] = coords;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      } else {
        coords.forEach((c) => scanCoords(c, depth - 1));
      }
    };

    for (const feature of geoData.features) {
      const depth = feature.geometry.type === 'Polygon' ? 2 : 3;
      scanCoords(feature.geometry.coordinates, depth);
    }

    // ละติจูดยิ่งสูง 1 องศายิ่งกว้างกว่าลองจิจูด 1 องศาบนจอ (cos correction คร่าวๆ ที่ละติจูดกลางประเทศไทย ~13N)
    const latCorrection = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const lonSpan = (maxLon - minLon) * latCorrection;
    const latSpan = maxLat - minLat;

    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const scale = Math.min(usableW / lonSpan, usableH / latSpan);

    const offsetX = padding + (usableW - lonSpan * scale) / 2;
    const offsetY = padding + (usableH - latSpan * scale) / 2;

    return (lon, lat) => {
      const x = offsetX + (lon - minLon) * latCorrection * scale;
      const y = offsetY + (maxLat - lat) * scale; // lat กลับด้าน (บนแผนที่ = เหนือ = lat สูง)
      return [x, y];
    };
  },

  _coordsToPath(coordinates, type, project) {
    const ringToPath = (ring) =>
      ring
        .map(([lon, lat], i) => {
          const [x, y] = project(lon, lat);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ') + 'Z';

    if (type === 'Polygon') {
      return coordinates.map(ringToPath).join(' ');
    }
    // MultiPolygon: array ของ Polygon
    return coordinates.map((polygon) => polygon.map(ringToPath).join(' ')).join(' ');
  },

  // Sequential blue ramp (ตาม dataviz palette: step 100 อ่อนสุด -> step 700 เข้มสุด)
  _sequentialRamp: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],

  _colorForRatio(ratio) {
    const ramp = this._sequentialRamp;
    const scaled = Math.max(0, Math.min(1, ratio)) * (ramp.length - 1);
    const idx = Math.floor(scaled);
    const frac = scaled - idx;
    if (idx >= ramp.length - 1) return ramp[ramp.length - 1];
    return this._lerpColor(ramp[idx], ramp[idx + 1], frac);
  },

  _lerpColor(hexA, hexB, t) {
    const a = this._hexToRgb(hexA);
    const b = this._hexToRgb(hexB);
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  },

  _hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  _ensureTooltip() {
    if (this._tooltipEl) return this._tooltipEl;
    const el = document.createElement('div');
    el.className = 'choropleth-tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);
    this._tooltipEl = el;
    return el;
  },

  /**
   * @param {HTMLElement} container
   * @param {Map<string,number>} valueByProvinceName - ค่ารวมต่อจังหวัด (ชื่อไทยตรงกับ provinces.json)
   * @param {Map<string,string>} regionByProvinceName - ภาคของแต่ละจังหวัด (สำหรับ highlight ทั้งภาค)
   * @param {{unitLabel: string, onProvinceClick?: (provinceName: string|null) => void}} options
   * @returns {{ min:number, max:number }} ช่วงค่าที่ใช้จริง (สำหรับวาด legend)
   */
  async render(container, valueByProvinceName, regionByProvinceName, options = {}) {
    const [geoData, geoMapping] = await Promise.all([this.loadGeoData(), this.loadGeoMapping()]);
    const isoToNameTh = new Map(geoMapping.map((m) => [m.shapeISO, m.name_th]));

    const values = [...valueByProvinceName.values()].filter((v) => v != null && v > 0);
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 1;

    const width = container.clientWidth || 480;
    const height = 520;
    const padding = 16;
    const project = this._buildProjection(geoData, width, height, padding);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', height);
    svg.classList.add('choropleth-svg');

    const style = getComputedStyle(document.documentElement);
    const noDataColor = style.getPropertyValue('--gridline').trim() || '#e1e0d9';
    const strokeColor = style.getPropertyValue('--surface-2').trim() || '#ffffff';

    const tooltip = this._ensureTooltip();
    this._pathsByProvinceName = new Map();
    this._onProvinceClick = options.onProvinceClick || null;

    for (const feature of geoData.features) {
      const nameTh = isoToNameTh.get(feature.properties.shapeISO);
      const value = nameTh ? valueByProvinceName.get(nameTh) : null;
      const hasData = nameTh && value != null && value > 0;
      const ratio = hasData ? (max === min ? 1 : (value - min) / (max - min)) : 0;
      const fill = hasData ? this._colorForRatio(ratio) : noDataColor;

      const d = this._coordsToPath(feature.geometry.coordinates, feature.geometry.type, project);
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', fill);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', '0.6');
      path.dataset.fillColor = fill;
      path.dataset.provinceName = nameTh || '';
      path.dataset.region = nameTh ? regionByProvinceName.get(nameTh) || '' : '';
      path.classList.add('choropleth-path');
      if (hasData) path.classList.add('choropleth-path--has-data');
      if (nameTh) path.style.cursor = 'pointer';

      const displayName = nameTh || feature.properties.shapeName;
      const valueText = hasData
        ? `${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${options.unitLabel || ''}`
        : 'ไม่มีข้อมูล';

      path.addEventListener('mousemove', (e) => {
        tooltip.style.display = 'block';
        tooltip.style.left = e.pageX + 12 + 'px';
        tooltip.style.top = e.pageY + 12 + 'px';
        tooltip.innerHTML = `<strong>${displayName}</strong><br>${valueText}`;
        path.classList.add('choropleth-path--hover');
      });
      path.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        path.classList.remove('choropleth-path--hover');
      });

      if (nameTh) {
        path.addEventListener('click', () => {
          if (this._onProvinceClick) this._onProvinceClick(nameTh);
        });
        this._pathsByProvinceName.set(nameTh, path);
      }

      svg.appendChild(path);
    }

    container.innerHTML = '';
    container.appendChild(svg);
    this._svgEl = svg;

    return { min, max };
  },

  // highlightSet: null = แสดงทุกจังหวัดตามสีปกติ (ไม่มี selection)
  // Set<string> ของชื่อจังหวัด = จังหวัดในเซตนี้แสดงสีปกติ ที่เหลือเป็นสีเทา
  applyHighlight(highlightSet) {
    if (!this._pathsByProvinceName) return;
    const noDataColor = getComputedStyle(document.documentElement).getPropertyValue('--gridline').trim() || '#e1e0d9';

    for (const [provinceName, path] of this._pathsByProvinceName) {
      if (highlightSet == null || highlightSet.has(provinceName)) {
        path.setAttribute('fill', path.dataset.fillColor);
        path.classList.remove('choropleth-path--dimmed');
      } else {
        path.setAttribute('fill', noDataColor);
        path.classList.add('choropleth-path--dimmed');
      }
    }
  },

  renderLegend(container, min, max, unitLabel) {
    const ramp = this._sequentialRamp;
    const steps = 6;
    const items = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const value = min + (max - min) * t;
      items.push({ color: this._colorForRatio(t), value });
    }

    container.innerHTML = `
      <div class="choropleth-legend__gradient">
        ${items.map((it) => `<span class="choropleth-legend__swatch" style="background:${it.color}"></span>`).join('')}
      </div>
      <div class="choropleth-legend__labels">
        <span>${min.toLocaleString('th-TH', { maximumFractionDigits: 1 })}</span>
        <span class="choropleth-legend__unit">${unitLabel || ''}</span>
        <span>${max.toLocaleString('th-TH', { maximumFractionDigits: 1 })}</span>
      </div>
      <div class="choropleth-legend__nodata"><span class="choropleth-legend__swatch choropleth-legend__swatch--nodata"></span> ไม่มีข้อมูล</div>
    `;
  }
};
