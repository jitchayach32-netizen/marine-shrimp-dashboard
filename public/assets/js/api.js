// Fetch wrapper กลาง - ใช้ร่วมกันทุกหน้า
const Api = {
  async request(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (res.status === 401) {
      window.location.href = '/index.html';
      throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `เกิดข้อผิดพลาด (${res.status})`);
    }

    return res.json();
  },

  get(path) {
    return this.request(path);
  },

  post(path, data) {
    return this.request(path, { method: 'POST', body: JSON.stringify(data) });
  },

  delete(path) {
    return this.request(path, { method: 'DELETE' });
  },

  buildQuery(params) {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
      usp.set(key, Array.isArray(value) ? value.join(',') : value);
    }
    const qs = usp.toString();
    return qs ? `?${qs}` : '';
  },

  downloadUrl(path, params = {}) {
    return path + this.buildQuery(params);
  }
};
