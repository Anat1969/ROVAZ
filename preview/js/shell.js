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

// A&I logo button (<ai-menu>): copy link, dev chat and install are built in;
// the app adds editing, theme and sign-out here.
function syncAIMenu() {
  const menu = document.querySelector('ai-menu');
  if (!menu) return;
  const items = [];
  const inApp = isInApp();
  if (inApp && currentRole === 'reviewer') {
    items.push({ label: editMode ? 'סגור עריכה' : 'הפעל עריכה', hint: 'עריכת תוכן', pressed: editMode, onSelect: toggleReviewerEdit });
    if (editMode) {
      items.push({ label: 'שמור שינויים', onSelect: savePageEdits });
      items.push({ label: 'ביטול שינויים', onSelect: cancelPageEdits });
    }
  }
  items.push({ label: currentTheme() === 'dark' ? 'מצב יום' : 'מצב לילה', onSelect: toggleTheme });
  if (inApp && currentRole === 'reviewer') items.push({ label: 'יציאה', hint: 'אדריכלית העיר', onSelect: logoutReviewer });
  else if (inApp && submitterIdentityName) items.push({ label: 'יציאה', onSelect: goBackToLanding });
  menu.items = items;
  menu.status = editMode && currentRole === 'reviewer' ? 'עריכה פעילה' : '';
}

// Theme: follows the system unless the viewer picked one
function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyThemeLabel() {
  syncAIMenu();
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('rz-theme', next); } catch {}
  applyThemeLabel();
}
try { const t = localStorage.getItem('rz-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
applyThemeLabel();

// Install from Chrome: handled by the A&I logo button (<ai-menu>).
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
