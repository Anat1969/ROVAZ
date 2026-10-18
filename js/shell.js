// ===== SHELL: top bar, theme, install, motion =====

function toast(msg, isError) {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast' + (isError === true ? ' err' : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
}

function goHome(e) {
  if (e) e.preventDefault();
  if (isInApp()) goToPage('home');
  else window.scrollTo({ top: 0, behavior: 'smooth' });
  return false;
}

function scrollToId(e, id) {
  if (e) e.preventDefault();
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
}

function scrollToLogin(e) {
  scrollToId(e, 'login');
}

async function copyCurrentLink() {
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    toast('הקישור הועתק');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('הקישור הועתק'); } catch { toast(url); }
    ta.remove();
  }
}

function toggleTopMenu(e) {
  if (e) e.stopPropagation();
  document.getElementById('topMenu').classList.toggle('hidden');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('topMenu');
  if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) menu.classList.add('hidden');
});

// Theme: follows the system unless the viewer picked one
function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyThemeLabel() {
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = currentTheme() === 'dark' ? 'מצב יום' : 'מצב לילה';
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('rz-theme', next); } catch {}
  applyThemeLabel();
}
try { const t = localStorage.getItem('rz-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
applyThemeLabel();

// Install from Chrome
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  ['installBtn', 'installBtnMenu'].forEach(id => document.getElementById(id).classList.remove('hidden'));
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  ['installBtn', 'installBtnMenu'].forEach(id => document.getElementById(id).classList.add('hidden'));
  toast('האפליקציה הותקנה');
});
async function installApp() {
  if (!deferredInstall) { toast('אפשר להתקין מתפריט Chrome: התקנת האפליקציה'); return; }
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Scroll progress line + shadow under the top bar
function onScroll() {
  const bar = document.getElementById('topbar');
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.setProperty('--scroll-progress', max > 0 ? (scrollY / max).toFixed(3) : 0);
  bar.classList.toggle('scrolled', scrollY > 8);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Scroll reveal on the landing page
(function setupReveal() {
  const els = document.querySelectorAll('.sr');
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in');
      if (el.id === 'figures') {
        el.querySelectorAll('.fig').forEach((f, i) => setTimeout(() => f.classList.add('in'), i * 140));
        animateCounts(el);
      }
      if (el.id === 'timeline') setTimeout(() => el.style.setProperty('--tl', '100%'), 200);
      io.unobserve(el);
    });
  }, { threshold: 0.15 });
  els.forEach(el => io.observe(el));
})();

// Subtle parallax on the hero sails
(function heroParallax() {
  const sails = document.querySelector('.hero-sails');
  if (!sails || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.addEventListener('scroll', () => {
    if (document.getElementById('landingScreen').style.display === 'none') return;
    sails.style.transform = `translateY(${Math.min(scrollY, 600) * 0.18}px)`;
  }, { passive: true });
})();

window.addEventListener('hashchange', () => { if (isInApp()) routeFromHash(); });
