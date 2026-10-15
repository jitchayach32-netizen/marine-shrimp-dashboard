// Navbar กลาง - ใช้ร่วมกันทุกหน้า (ไม่มีระบบสิทธิ์ผู้ใช้ ทุกคนเข้าถึงได้เท่ากัน)
const NAV_ITEMS = [
  { href: '/dashboard.html', label: 'ภาพรวม' },
  { href: '/seed-distribution.html', label: 'จำหน่ายลูกพันธุ์' },
  { href: '/seed-stocking.html', label: 'ปล่อยลงเลี้ยง' },
  { href: '/production-farm.html', label: 'ผลผลิต (ฟาร์ม)' },
  { href: '/production-incoming.html', label: 'ผลผลิต (ขาเข้า)' },
  { href: '/production-capacity.html', label: 'กำลังการผลิต' },
  { href: '/documents-seed.html', label: 'เอกสารลูกพันธุ์' },
  { href: '/documents-meat.html', label: 'เอกสารกุ้งเนื้อ' },
  { href: '/prices.html', label: 'ราคาตลาด' },
  { href: '/compare.html', label: 'เปรียบเทียบ' },
  { href: '/admin.html', label: 'จัดการระบบ' }
];

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('shrimp_theme', theme);
}

function initThemeToggle(button) {
  const saved = localStorage.getItem('shrimp_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  button.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
    button.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀ โหมดสว่าง' : '🌙 โหมดมืด';
  });
  button.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀ โหมดสว่าง' : '🌙 โหมดมืด';
}

function renderNavbar() {
  const currentPath = window.location.pathname;

  const nav = document.createElement('nav');
  nav.className = 'navbar';

  const brand = document.createElement('a');
  brand.className = 'navbar__brand';
  brand.href = '/dashboard.html';
  brand.textContent = '🦐 ระบบข้อมูลกุ้งทะเล';
  nav.appendChild(brand);

  for (const item of NAV_ITEMS) {
    const a = document.createElement('a');
    a.className = 'navbar__link' + (currentPath === item.href ? ' active' : '');
    a.href = item.href;
    a.textContent = item.label;
    nav.appendChild(a);
  }

  const spacer = document.createElement('div');
  spacer.className = 'navbar__spacer';
  nav.appendChild(spacer);

  const themeBtn = document.createElement('button');
  themeBtn.className = 'navbar__theme-toggle';
  nav.appendChild(themeBtn);

  document.body.insertBefore(nav, document.body.firstChild);
  initThemeToggle(themeBtn);

  document.dispatchEvent(new CustomEvent('shrimp:ready'));
}

document.addEventListener('DOMContentLoaded', renderNavbar);
