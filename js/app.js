// ===== SUPABASE CONFIG =====
// Shared ASHDODMAP project — every ROVAZ table and function carries the rz_ prefix
const SUPABASE_URL = 'https://cbhexpybdggwzyakgagd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiaGV4cHliZGdnd3p5YWtnYWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDkzMjksImV4cCI6MjA5MTMyNTMyOX0.X1b7pLyig-bGfxM7XjmwH0TqiuhqoS_o-Czg5qdsN6o';
const T_REQUESTS = 'rz_requests';
const T_DOCS = 'rz_documents_content';
let supabaseClient = null;
let realtimeChannel = null;
function isSupabaseConfigured() { return SUPABASE_URL && SUPABASE_ANON_KEY; }
function initSupabase() {
  if (!isSupabaseConfigured()) return;
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    document.getElementById('dbStatusBadge').textContent = 'מסד נתונים מחובר';
    document.getElementById('dbStatusBadge').className = 'db-status cloud';
    subscribeRealtime();
  } catch(e) { console.warn('Supabase init failed:', e); }
}

function subscribeRealtime() {
  if (!supabaseClient) return;
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient
    .channel('rz-requests-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: T_REQUESTS }, () => {
      loadRequests();
    })
    .subscribe();
}

// ===== STATE =====
let currentRole = 'submitter';
let currentPage = 'submitterInstructions';
let requests = [];
let pageContent = JSON.parse(localStorage.getItem('pageContent')) || {};
let documentsContent = JSON.parse(localStorage.getItem('documentsContent')) || { links: [], files: [], notes: [] };
let tempUploads = { plan: null, visualization: null };
let map = null;
let markers = [];
let pendingLocationRequest = null;
let pendingLocationCandidates = [];
let requestSort = { key: 'createdAt', order: 'desc' };
let editMode = false;
let pendingEmailData = null;
let currentDetailId = null;
let editingFromId = null;
let showAllVersions = false;
let submitterIdentityPhone = sessionStorage.getItem('submitterPhone') || null;
let submitterIdentityName = sessionStorage.getItem('submitterName') || null;
const ashdodCenter = [31.8067, 34.6447];
let viewerState = { scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 };

// Legacy demo record that older clients kept in localStorage; never sync it to the database
const SEED_ID = 1716000000001;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {
  try { initSupabase(); } catch(e) { console.error('initSupabase:', e); }
  try { setupViewerEvents(); } catch(e) { console.error('setupViewerEvents:', e); }

  // If user already identified (session survived page reload), skip landing
  const savedName = sessionStorage.getItem('submitterName');
  const savedRole = sessionStorage.getItem('reviewerAuth');
  if (savedName || savedRole === '1') {
    closeLanding();
    if (savedName) {
      submitterIdentityName = savedName;
      submitterIdentityPhone = sessionStorage.getItem('submitterPhone') || '';
    }
    if (savedRole === '1') {
      currentRole = 'reviewer';
      const roleBar = document.getElementById('roleSwitchBar');
      if (roleBar) roleBar.style.display = '';
    }
  }
  applyRoleClass();

  try { populateLandingDatalist(); } catch(e) { console.error('populateLandingDatalist:', e); }
  try { renderNavTabs(); } catch(e) { console.error('renderNavTabs:', e); }
  try { loadPersistentPageContent(); } catch(e) { console.error('loadPersistentPageContent:', e); }
  try { initializeChecklist(); } catch(e) { console.error('initializeChecklist:', e); }
  try { initializeUploadZones(); } catch(e) { console.error('initializeUploadZones:', e); }
  try { loadRequests(); } catch(e) { console.error('loadRequests:', e); }
  try { loadDocumentsFromSupabase(); } catch(e) { console.error('loadDocumentsFromSupabase:', e); }
  try { renderDocumentsPage(); } catch(e) { console.error('renderDocumentsPage:', e); }
  try { updateSubmitterGreeting(); } catch(e) { console.error('updateSubmitterGreeting:', e); }
  if (isInApp()) routeFromHash();
  setTimeout(() => { if (document.getElementById('map') && !map) initializeMap(); }, 150);
});

function isInApp() {
  return document.getElementById('appShell').style.display !== 'none';
}

function applyRoleClass() {
  document.body.classList.toggle('role-reviewer', currentRole === 'reviewer' && sessionStorage.getItem('reviewerAuth') === '1');
}

// Deep links: #/<pageId> or #/reviewerRequestDetail/<id>
function routeFromHash() {
  const parts = (location.hash || '').replace(/^#\/?/, '').split('/');
  const pageId = parts[0];
  const allowed = navTabsForRole().map(t => t.id);
  if (pageId === 'reviewerRequestDetail' && parts[1] && currentRole === 'reviewer') {
    const id = Number(parts[1]) || parts[1];
    pendingDetailId = id;
    if (requests.find(r => r.id === id)) { viewRequestDetails(id); return; }
    goToPage('reviewerDashboard');
    return;
  }
  goToPage(allowed.includes(pageId) ? pageId : 'home');
}
let pendingDetailId = null;

// ===== NAVIGATION =====
function switchRole(role) {
  if (role === 'reviewer') {
    if (sessionStorage.getItem('reviewerAuth') === '1') {
      closeLanding();
      _doSwitchRole('reviewer');
    } else {
      openReviewerPasswordModal();
    }
  } else {
    _doSwitchRole('submitter');
  }
}

function updateSubmitterGreeting() {
  const greeting = document.getElementById('submitterGreeting');
  const logoutBtn = document.getElementById('submitterLogoutBtn');
  const inApp = isInApp();
  if (inApp && currentRole === 'reviewer' && sessionStorage.getItem('reviewerAuth') === '1') {
    greeting.textContent = 'אדריכלית העיר';
    greeting.style.display = '';
    logoutBtn.classList.add('hidden');
  } else if (inApp && submitterIdentityName && currentRole === 'submitter') {
    greeting.textContent = `שלום, ${submitterIdentityName}`;
    greeting.style.display = '';
    logoutBtn.classList.remove('hidden');
  } else {
    greeting.style.display = 'none';
    logoutBtn.classList.add('hidden');
  }
}

function _doSwitchRole(role) {
  currentRole = role;
  applyRoleClass();
  const roleBar = document.getElementById('roleSwitchBar');
  if (roleBar) roleBar.style.display = sessionStorage.getItem('reviewerAuth') === '1' ? '' : 'none';
  const rSub = document.getElementById('roleSubmitter');
  const rRev = document.getElementById('roleReviewer');
  if (rSub) rSub.classList.toggle('active', role === 'submitter');
  if (rRev) rRev.classList.toggle('active', role === 'reviewer');
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', role !== 'reviewer');
  const subLogoutBtn = document.getElementById('submitterLogoutBtn');
  if (subLogoutBtn) subLogoutBtn.classList.toggle('hidden', role !== 'submitter');
  updateSubmitterGreeting();
  renderNavTabs();
  goToPage(role === 'submitter' ? 'submitterTracker' : 'reviewerDashboard');
}

function navTabsForRole() {
  return currentRole === 'submitter'
    ? [
        { id: 'home',                  label: 'בית' },
        { id: 'submitterTracker',      label: 'מעקב בקשות' },
        { id: 'submitterForm',         label: 'טופס בקשה' },
        { id: 'submitterChecklist',    label: "צ'ק ליסט" },
        { id: 'submitterDocuments',    label: 'מסמכי התוכנית' },
        { id: 'submitterInstructions', label: 'הנחיות' }
      ]
    : [
        { id: 'home',                  label: 'בית' },
        { id: 'reviewerDashboard',     label: 'רשימת בקשות' },
        { id: 'reviewerMap',           label: 'מפת בקשות' },
        { id: 'reviewerRequestDetail', label: 'פרטי בקשה' },
        { id: 'submitterDocuments',    label: 'מסמכי התוכנית' },
        { id: 'submitterInstructions', label: 'הנחיות' }
      ];
}

function renderNavTabs() {
  const tabs = navTabsForRole();
  const nav = document.getElementById('navTabs');
  nav.innerHTML = '<span class="nav-indicator" id="navIndicator"></span>' + tabs.map(t =>
    `<button type="button" data-tab="${t.id}" class="${currentPage === t.id ? 'active' : ''}" onclick="goToPage('${t.id}')">${t.label}</button>`
  ).join('');
  requestAnimationFrame(moveNavIndicator);

  const toolbar = document.getElementById('editorToolbar');
  if (currentRole === 'reviewer') toolbar.classList.remove('hidden');
  else toolbar.classList.add('hidden');
  document.getElementById('toggleEditBtn').textContent = editMode ? 'סגור עריכה' : 'הפעל עריכה';
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', currentRole !== 'reviewer');
}

function moveNavIndicator() {
  const nav = document.getElementById('navTabs');
  const ind = document.getElementById('navIndicator');
  const active = nav && nav.querySelector('button.active');
  if (!ind) return;
  if (!active) { ind.style.width = '0px'; return; }
  ind.style.width = active.offsetWidth + 'px';
  ind.style.transform = `translateX(${active.offsetLeft}px)`;
  ind.style.left = '0';
  if (active.scrollIntoView && nav.scrollWidth > nav.clientWidth) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}
window.addEventListener('resize', () => requestAnimationFrame(moveNavIndicator));

function goToPage(pageId) {
  const page = document.getElementById(pageId);
  if (!page) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  page.classList.add('active');
  const changed = currentPage !== pageId;
  currentPage = pageId;
  renderNavTabs();
  const hash = '#/' + pageId + (pageId === 'reviewerRequestDetail' && currentDetailId ? '/' + currentDetailId : '');
  if (location.hash !== hash) history.replaceState(null, '', hash);
  if (changed) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (pageId === 'home') renderHomePage();
  if (pageId === 'reviewerMap') {
    setTimeout(() => { if (!map) initializeMap(); else { map.invalidateSize(); updateMapMarkers(); } }, 300);
  }
  if (pageId === 'submitterDocuments') renderDocumentsPage();
  if (pageId === 'reviewerDashboard') renderReviewerKpis();
  if (pageId === 'submitterTracker') {
    if (!submitterIdentityName) {
      document.getElementById('phoneGate').classList.remove('hidden');
      document.getElementById('trackerContent').style.display = 'none';
    } else {
      document.getElementById('phoneGate').classList.add('hidden');
      document.getElementById('trackerContent').style.display = '';
      renderSubmitterTracker();
    }
  }
  if (pageId === 'submitterForm') {
    prefillFormFromIdentity();
  }
}

// ===== HOME =====
function renderHomePage() {
  const tiles = navTabsForRole().filter(t => t.id !== 'home');
  const desc = {
    submitterTracker: 'הבקשות שהגשת, הסטטוס שלהן והערות אדריכלית העיר.',
    submitterForm: 'הגשת בקשה חדשה עם תוכנית בינוי והדמיה.',
    submitterChecklist: 'בדיקת מסמכים ואישורים לפני ההגשה.',
    submitterDocuments: 'הוראות התוכנית, התשריט וקישורים רשמיים.',
    submitterInstructions: 'תנאי זכאות, קווי בניין ושלבי ההגשה.',
    reviewerDashboard: 'כל הבקשות, חיפוש, מיון וגרסאות.',
    reviewerMap: 'הבקשות על מפת רובע ז׳, לפי סטטוס.',
    reviewerRequestDetail: 'הבקשה האחרונה שנפתחה: צ׳ק ליסט, הערות והחלטה.'
  };
  const colors = ['var(--sea-500)', 'var(--nahal-500)', 'var(--dune-500)', 'var(--estuary-500)', 'var(--port-500)', 'var(--sea-500)'];
  document.getElementById('homeTiles').innerHTML = tiles.map((t, i) => `
    <button type="button" class="home-tile" style="--tile:${colors[i % colors.length]}" onclick="goToPage('${t.id}')">
      <span class="t-num">${String(i + 1).padStart(2, '0')}</span>
      <span><span class="t-title">${t.label}</span><br><span class="t-desc">${desc[t.id] || ''}</span></span>
      <span class="t-go">פתיחה</span>
    </button>`).join('');
  const kpiHost = document.getElementById('homeKpis');
  const list = currentRole === 'reviewer' ? requests.filter(r => !r.superseded) : myRequestsForCurrentUser().filter(r => !r.superseded);
  kpiHost.innerHTML = kpiHtml(list, currentRole === 'reviewer' ? 'בקשות פעילות' : 'הבקשות שלי');
  animateCounts(kpiHost);
}

function kpiHtml(list, totalLabel) {
  const c = s => list.filter(r => r.status === s).length;
  return `<div class="kpis stagger">
    <div class="kpi" style="--k:var(--sea-500)"><div class="v count" data-to="${list.length}">0</div><div class="l">${totalLabel}</div></div>
    <div class="kpi" style="--k:var(--dune-500)"><div class="v count" data-to="${c('pending')}">0</div><div class="l">ממתינות</div></div>
    <div class="kpi" style="--k:var(--nahal-500)"><div class="v count" data-to="${c('approved')}">0</div><div class="l">אושרו</div></div>
    <div class="kpi" style="--k:var(--port-500)"><div class="v count" data-to="${c('rejected')}">0</div><div class="l">נדחו</div></div>
  </div>`;
}

function renderReviewerKpis() {
  let host = document.getElementById('reviewerKpis');
  const card = document.querySelector('#reviewerDashboard .card');
  if (!card) return;
  if (!host) {
    host = document.createElement('div');
    host.id = 'reviewerKpis';
    card.insertBefore(host, card.children[1]);
  }
  host.innerHTML = kpiHtml(requests.filter(r => !r.superseded), 'בקשות פעילות');
  animateCounts(host);
}

function animateCounts(root) {
  (root || document).querySelectorAll('.count').forEach(el => {
    const to = Number(el.dataset.to) || 0;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || to === 0) { el.textContent = to; return; }
    const start = performance.now(), dur = 1100 + Math.min(900, to);
    const step = now => {
      const k = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ===== PAGE CONTENT EDIT =====
function loadPersistentPageContent() {
  if (!pageContent) return;
  Object.keys(pageContent).forEach(key => {
    const el = document.querySelector(`[data-edit-key="${key}"]`);
    if (el) el.innerHTML = pageContent[key];
  });
}

function toggleReviewerEdit() {
  if (!editMode) {
    editMode = true;
    document.body.classList.add('editable-active');
    document.getElementById('saveEditsBtn').classList.remove('hidden');
    document.getElementById('cancelEditsBtn').classList.remove('hidden');
    document.getElementById('toggleEditBtn').textContent = 'סגור עריכה';
    document.querySelectorAll('[data-editable]').forEach(el => el.setAttribute('contenteditable', 'true'));
    document.querySelectorAll('[data-edit-list]').forEach(renderEditableListControls);
  } else {
    cancelPageEdits();
  }
}

function savePageEdits() {
  document.querySelectorAll('[data-edit-key]').forEach(el => {
    pageContent[el.getAttribute('data-edit-key')] = el.innerHTML;
  });
  localStorage.setItem('pageContent', JSON.stringify(pageContent));
  saveDocumentsToSupabase({ pageContent: true });
  editMode = false;
  document.body.classList.remove('editable-active');
  document.getElementById('saveEditsBtn').classList.add('hidden');
  document.getElementById('cancelEditsBtn').classList.add('hidden');
  document.getElementById('toggleEditBtn').textContent = 'הפעל עריכה';
  document.querySelectorAll('.editable-list-controls').forEach(el => el.remove());
  document.querySelectorAll('[data-editable]').forEach(el => el.removeAttribute('contenteditable'));
}

function cancelPageEdits() {
  editMode = false;
  document.body.classList.remove('editable-active');
  document.getElementById('saveEditsBtn').classList.add('hidden');
  document.getElementById('cancelEditsBtn').classList.add('hidden');
  document.getElementById('toggleEditBtn').textContent = 'הפעל עריכה';
  loadPersistentPageContent();
  document.querySelectorAll('.editable-list-controls').forEach(el => el.remove());
  document.querySelectorAll('[data-editable]').forEach(el => el.removeAttribute('contenteditable'));
}

function renderEditableListControls(list) {
  if (list.querySelector('.editable-list-controls')) return;
  const controls = document.createElement('div');
  controls.className = 'editable-list-controls';
  controls.innerHTML = `<button type="button" title="הוסף שורה" onclick="addEditableListItem('${list.id}')">+</button><button type="button" title="מחק אחרון" onclick="removeEditableListItem('${list.id}')">−</button>`;
  list.parentNode.insertBefore(controls, list);
}

function addEditableListItem(listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const li = document.createElement('li');
  li.setAttribute('data-edit-key', `${listId}-item-${Date.now()}`);
  li.setAttribute('contenteditable', 'true');
  li.style.marginBottom = '5px';
  li.textContent = 'שורה חדשה';
  list.appendChild(li);
}

function removeEditableListItem(listId) {
  const list = document.getElementById(listId);
  if (list && list.lastElementChild) list.removeChild(list.lastElementChild);
}

// ===== DOCUMENTS PAGE =====
function renderDocumentsPage() {
  renderDocLinks();
  renderDocFiles();
  renderDocNotes();
}

function renderDocLinks() {
  const container = document.getElementById('docLinksList');
  if (!container) return;
  if (!documentsContent.links.length) {
    container.innerHTML = '<p class="doc-empty">אין קישורים שמורים עדיין.</p>';
    return;
  }
  container.innerHTML = documentsContent.links.map((link, i) => `
    <div class="doc-link-item">
      <span class="doc-tag">קישור</span>
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.title || link.url)}</a>
      <button class="btn btn-light btn-sm reviewer-only" onclick="removeDocLink(${i})">הסרה</button>
    </div>
  `).join('');
}

function renderDocFiles() {
  const container = document.getElementById('docFilesList');
  if (!container) return;
  if (!documentsContent.files.length) {
    container.innerHTML = '<p class="doc-empty">אין קבצים מצורפים עדיין.</p>';
    return;
  }
  container.innerHTML = documentsContent.files.map((file, i) => {
    const isImage = file.type && file.type.startsWith('image/');
    const src = file.data || file.url || '';
    const preview = isImage
      ? `<img src="${escapeHtml(src)}" style="width:60px;height:44px;object-fit:cover;cursor:pointer;border:1px solid var(--border);" onclick="openImageFullscreen(documentsContent.files[${i}].data || documentsContent.files[${i}].url)">`
      : `<span class="doc-tag">${escapeHtml((file.name.split('.').pop()||'קובץ').toUpperCase())}</span>`;
    const openBtn = isImage
      ? ` <button class="btn btn-light btn-sm" onclick="openImageFullscreen(documentsContent.files[${i}].data || documentsContent.files[${i}].url)">צפייה</button>`
      : ` <a class="btn btn-light btn-sm" href="${escapeHtml(src)}" target="_blank" rel="noopener" download="${escapeHtml(file.name)}">פתיחה</a>`;
    return `
      <div class="doc-file-item">
        ${preview}
        <span style="flex:1;font-size:15px;color:var(--text-dark);">${escapeHtml(file.name)}</span>
        ${openBtn}
        <button class="btn btn-light btn-sm reviewer-only" onclick="removeDocFile(${i})">הסרה</button>
      </div>
    `;
  }).join('');
}

function renderDocNotes() {
  const container = document.getElementById('docNotesList');
  if (!container) return;
  if (!documentsContent.notes.length) {
    container.innerHTML = '<p class="doc-empty">אין הערות עדיין.</p>';
    return;
  }
  container.innerHTML = documentsContent.notes.map((note, i) => `
    <div class="doc-note-item">
      <div class="note-text">${escapeHtml(note.text)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:4px;">
        <span class="note-meta">${escapeHtml(note.date)}</span>
        <button class="btn btn-light btn-sm reviewer-only" onclick="removeDocNote(${i})">הסרה</button>
      </div>
    </div>
  `).join('');
}

function showAddLinkForm() {
  document.getElementById('addLinkForm').classList.remove('hidden');
  document.getElementById('newLinkTitle').focus();
}

function hideAddLinkForm() {
  document.getElementById('addLinkForm').classList.add('hidden');
  document.getElementById('newLinkTitle').value = '';
  document.getElementById('newLinkUrl').value = '';
}

function saveNewLink() {
  const title = document.getElementById('newLinkTitle').value.trim();
  const url = document.getElementById('newLinkUrl').value.trim();
  if (!url) { toast('אנא הכנס כתובת URL'); return; }
  documentsContent.links.push({ title: title || url, url, date: todayStr() });
  saveDocuments();
  hideAddLinkForm();
  renderDocLinks();
}

function removeDocLink(i) {
  documentsContent.links.splice(i, 1);
  saveDocuments();
  renderDocLinks();
}

function handleDocFileUpload(files) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      documentsContent.files.push({ name: file.name, type: file.type, data: e.target.result, date: todayStr() });
      saveDocuments();
      renderDocFiles();
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('docFileInput').value = '';
}

function removeDocFile(i) {
  documentsContent.files.splice(i, 1);
  saveDocuments();
  renderDocFiles();
}

function saveDocNote() {
  const text = document.getElementById('docNewNoteText').value.trim();
  if (!text) return;
  documentsContent.notes.push({ text, date: todayStr() });
  saveDocuments();
  document.getElementById('docNewNoteText').value = '';
  renderDocNotes();
}

function removeDocNote(i) {
  documentsContent.notes.splice(i, 1);
  saveDocuments();
  renderDocNotes();
}

function saveDocuments() {
  localStorage.setItem('documentsContent', JSON.stringify(documentsContent));
  saveDocumentsToSupabase({ docs: true });
}

// ===== UPLOAD ZONES =====
function triggerUpload(inputId, event) {
  if (event && event.target.closest('.zone-remove, .zone-content a, .zone-content button')) return;
  document.getElementById(inputId).click();
}

function initializeUploadZones() {
  [['planUpload', 'planInput', 'plan'], ['visualizationUpload', 'visualizationInput', 'visualization']].forEach(([zoneId, inputId, type]) => {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.background = '#f0f8ff'; });
    zone.addEventListener('dragleave', () => { zone.style.background = ''; });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.background = '';
      if (e.dataTransfer.files.length) handleAttachmentSelect(e.dataTransfer.files[0], type);
    });
  });
}

function handleAttachmentSelect(file, type) {
  const zoneId = type === 'plan' ? 'planUpload' : 'visualizationUpload';
  const contentId = type === 'plan' ? 'planContent' : 'visualizationContent';
  const zone = document.getElementById(zoneId);
  const content = document.getElementById(contentId);
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target.result;
    tempUploads[type] = { name: file.name, type: file.type, data: src };
    zone.querySelector('.zone-prompt').style.display = 'none';
    content.style.display = 'block';
    const removeBtn = ` <button class="zone-remove" onclick="clearUploadZone('${type}')" title="הסר">הסרה</button>`;
    if (file.type.startsWith('image/')) {
      const escapedSrc = src.replace(/'/g, "\\'");
      content.innerHTML = removeBtn + `<img src="${src}" onclick="openImageFullscreen('${escapedSrc}')" style="cursor:pointer;">`;
    } else {
      content.innerHTML = removeBtn + ` <div class="file-display"><span class="file-icon">${escapeHtml(((file||attachment).name.split('.').pop()||'').toUpperCase())}</span><span class="file-name">${escapeHtml(file.name)}</span><a href="${src}" target="_blank" class="btn btn-light btn-sm" onclick="event.stopPropagation()">פתח</a></div>`;
    }
  };
  reader.onerror = () => toast('שגיאה בהעלאת הקובץ. נסה שוב.');
  reader.readAsDataURL(file);
}

function clearUploadZone(type) {
  tempUploads[type] = null;
  const zoneId = type === 'plan' ? 'planUpload' : 'visualizationUpload';
  const contentId = type === 'plan' ? 'planContent' : 'visualizationContent';
  const zone = document.getElementById(zoneId);
  const content = document.getElementById(contentId);
  zone.querySelector('.zone-prompt').style.display = '';
  content.style.display = 'none';
  content.innerHTML = '';
  zone.style.background = '';
}

// ===== CHECKLIST =====
function initializeChecklist() {
  document.querySelectorAll('.checklist input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', () => {
      const item = input.closest('.checklist-item');
      if (item) item.classList.toggle('checked', input.checked);
      updateChecklistProgress();
    });
  });
  updateChecklistProgress();
}

function updateChecklistProgress() {
  const allChecks = document.querySelectorAll('#basicChecklist input[type="checkbox"], #documentChecklist input[type="checkbox"], #approvalsChecklist input[type="checkbox"]');
  const checked = Array.from(allChecks).filter(c => c.checked).length;
  const total = allChecks.length;
  const pct = total ? (checked / total) * 100 : 0;
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = `${checked} / ${total} פריטים`;
}

function collectChecklistItems() {
  const items = [];
  document.querySelectorAll('#basicChecklist li[data-check-id], #documentChecklist li[data-check-id], #approvalsChecklist li[data-check-id]').forEach(li => {
    const id = li.getAttribute('data-check-id');
    const cb = li.querySelector('input[type="checkbox"]');
    const label = li.querySelector('label');
    const noteInput = li.querySelector('.checklist-note-input');
    items.push({
      id: id || null,
      checked: cb ? cb.checked : false,
      text: label ? label.innerText.trim() : '',
      note: noteInput ? noteInput.value.trim() : ''
    });
  });
  return items;
}

// ===== SUBMIT REQUEST =====
async function submitRequest() {
  const submitterName = document.getElementById('submitterName').value.trim();
  const applicantName = document.getElementById('applicantName').value.trim();
  const street = document.getElementById('propertyStreet').value.trim();
  const buildingNum = document.getElementById('propertyBuildingNumber').value.trim();

  if (!submitterName || !street || !buildingNum) {
    toast('אנא מלאו: שם עורך הבקשה, רחוב ומספר בניין.');
    return;
  }

  const address = street + ' ' + buildingNum;
  const oldReq = editingFromId ? requests.find(r => r.id === editingFromId) : null;
  const newVersion = oldReq ? (oldReq.version || 1) + 1 : 1;
  const request = {
    id: Date.now(),
    version: newVersion,
    parentId: editingFromId || null,
    originalId: oldReq ? (oldReq.originalId || oldReq.id) : null,
    superseded: false,
    submitterName,
    applicantName,
    submitterEmail: document.getElementById('submitterEmail').value.trim(),
    submitterPhone: document.getElementById('submitterPhone').value.trim(),
    street,
    buildingNumber: buildingNum,
    address,
    gushNumber: document.getElementById('gushNumber').value.trim(),
    helkaNumber: document.getElementById('helkaNumber').value.trim(),
    description: document.getElementById('expansionDescription').value.trim(),
    notes: document.getElementById('additionalNotes').value.trim(),
    planAttachment: tempUploads.plan,
    visualizationImage: tempUploads.visualization,
    requirementChecklist: collectChecklistItems(),
    status: 'pending',
    createdAt: todayStr(),
    comments: [],
    approval: null,
    summaryText: '',
    lat: oldReq ? oldReq.lat : null,
    lng: oldReq ? oldReq.lng : null
  };

  // Geocode without blocking
  try {
    const geoResult = await resolveRequestLocation(request);
    if (geoResult.status === 'ok') {
      request.lat = geoResult.lat;
      request.lng = geoResult.lng;
      finalizeRequest(request);
    } else if (geoResult.status === 'ambiguous') {
      openLocationModal(request, geoResult.candidates);
    } else {
      // not found — save without coords
      finalizeRequest(request);
    }
  } catch (e) {
    finalizeRequest(request);
  }
}

function finalizeRequest(request) {
  // Mark previous version as superseded
  if (editingFromId) {
    const old = requests.find(r => r.id === editingFromId);
    if (old) { old.superseded = true; persistRequestLocal(old); }
    editingFromId = null;
    const banner = document.getElementById('editingBanner');
    if (banner) banner.classList.add('hidden');
  }
  persistRequest(request);
  resetSubmissionForm();
  loadRequests();
  goToPage('submitterTracker');
  const banner = document.getElementById('submissionSuccess');
  if (banner) {
    banner.textContent = request.version > 1
      ? `גרסה ${request.version} הוגשה בהצלחה! (עדכון לבקשה #${request.originalId})`
      : 'הבקשה הוגשה בהצלחה! מספר בקשה: #' + request.id;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 7000);
  }
}

function persistRequestLocal(request) {
  const stored = JSON.parse(localStorage.getItem('requests')) || [];
  const idx = stored.findIndex(r => r.id === request.id);
  if (idx >= 0) stored[idx] = request; else stored.push(request);
  localStorage.setItem('requests', JSON.stringify(stored));
  requests = stored;
}

async function persistRequest(request) {
  persistRequestLocal(request);
  if (supabaseClient) {
    try {
      const row = requestToRow(request);
      const { error } = await supabaseClient.from(T_REQUESTS).upsert(row, { onConflict: 'id' });
      if (error) console.error('Supabase save failed:', error.message, error.details, row.id);
    } catch(e) { console.error('Supabase save exception:', e); }
  }
}

function resetSubmissionForm() {
  ['submitterName','applicantName','submitterEmail','submitterPhone','propertyStreet','propertyBuildingNumber','gushNumber','helkaNumber','expansionDescription','additionalNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  clearUploadZone('plan');
  clearUploadZone('visualization');
  document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
    const item = cb.closest('.checklist-item');
    if (item) item.classList.remove('checked');
  });
  document.querySelectorAll('.checklist-note-input').forEach(inp => inp.value = '');
  updateChecklistProgress();
}

// ===== LOAD & DISPLAY REQUESTS =====
async function loadRequests() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from(T_REQUESTS).select('*').order('id', { ascending: false });
      if (!error && data) {
        requests = data.map(rowToRequest);
        localStorage.setItem('requests', JSON.stringify(requests));
        // One-time sync: push any local requests not yet in Supabase
        const local = JSON.parse(localStorage.getItem('requests_pre_sync')) || JSON.parse(localStorage.getItem('requests')) || [];
        const remoteIds = new Set(data.map(r => String(r.id)));
        const toSync = local.filter(r => r.id !== SEED_ID && !remoteIds.has(String(r.id)));
        if (toSync.length > 0) {
          console.log(`Syncing ${toSync.length} local requests to Supabase...`);
          for (const r of toSync) {
            const { error: e2 } = await supabaseClient.from(T_REQUESTS).upsert(requestToRow(r), { onConflict: 'id' });
            if (e2) console.error('Sync failed for', r.id, e2.message);
          }
          // Reload after sync
          const { data: data2 } = await supabaseClient.from(T_REQUESTS).select('*').order('id', { ascending: false });
          if (data2) { requests = data2.map(rowToRequest); localStorage.setItem('requests', JSON.stringify(requests)); }
        }
      } else {
        console.error('Supabase load error:', error?.message);
        requests = JSON.parse(localStorage.getItem('requests')) || [];
      }
    } catch(e) {
      console.error('Supabase load exception:', e);
      requests = JSON.parse(localStorage.getItem('requests')) || [];
    }
  } else {
    requests = JSON.parse(localStorage.getItem('requests')) || [];
  }
  await geocodeRequestsWithoutLocation();
  renderSubmitterTracker();
  filterRequests();
  updateSortHeaders();
  updateMapMarkers();
  if (currentPage === 'home' && isInApp()) renderHomePage();
  if (currentPage === 'reviewerDashboard') renderReviewerKpis();
  if (pendingDetailId && currentRole === 'reviewer' && requests.find(r => r.id === pendingDetailId)) viewRequestDetails(pendingDetailId);
}

function myRequestsForCurrentUser() {
  if (!submitterIdentityName) return [];
  const nameLower = submitterIdentityName.trim().toLowerCase();
  return requests.filter(r => (r.submitterName || '').trim().toLowerCase() === nameLower);
}

function renderSubmitterTracker() {
  const tracker = document.getElementById('trackerContent');
  if (!tracker) return;
  if (!submitterIdentityName) {
    tracker.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:20px 0;">יש להיכנס למערכת תחילה.</p>';
    return;
  }
  const myRequests = myRequestsForCurrentUser();
  const active = myRequests.filter(r => !r.superseded);

  const identityHeader = `<div class="identity-bar">
    <span>מחובר כ: <strong>${escapeHtml(submitterIdentityName)}</strong></span>
    <button class="btn btn-primary btn-sm" onclick="goToPage('submitterForm')">הגשת בקשה חדשה</button>
  </div>`;

  if (!active.length) {
    tracker.innerHTML = identityHeader + `
      <div class="empty-state">
        <p style="color:var(--text-light);margin-bottom:14px;">עדיין לא הגשת בקשות במערכת.</p>
        <button class="btn btn-primary" onclick="goToPage('submitterInstructions')">להתחלה: ההנחיות</button>
      </div>`;
    return;
  }

  // Build version chains
  const chains = {};
  myRequests.forEach(req => {
    const root = req.originalId || req.id;
    if (!chains[root]) chains[root] = [];
    chains[root].push(req);
  });
  Object.values(chains).forEach(chain => chain.sort((a,b) => (a.version||1) - (b.version||1)));
  const latestByRoot = {};
  Object.entries(chains).forEach(([root, chain]) => { latestByRoot[root] = chain[chain.length - 1]; });

  // Table view
  const tableRows = active.map(req => {
    const rootId = req.originalId || req.id;
    if (req.id !== (latestByRoot[rootId] || req).id) return '';
    const canEdit = req.status !== 'approved';
    const editBtn = canEdit
      ? ` <button class="btn btn-light btn-sm" onclick="editRequest(${req.id})">עריכה</button>`
      : `<span style="font-size:11px;color:var(--green);font-weight:600;">אושר — נעול</span>`;
    const vBadge = (req.version > 1) ? ('<span class="version-badge" style="margin-left:4px;">v' + req.version + '</span>') : '';
    const lastComment = req.comments && req.comments.length ? req.comments[req.comments.length-1].text : '—';
    return `<tr class="row-${req.status}" onclick="openSubmitterDetail(${req.id})" style="cursor:pointer;">
      <td>${vBadge}<strong>${escapeHtml(req.address)}</strong></td>
      <td>${escapeHtml(req.applicantName||'—')}</td>
      <td><span class="badge badge-${req.status}">${translateStatus(req.status)}</span></td>
      <td class="num">${escapeHtml(req.createdAt)}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--text-light);">${escapeHtml(lastComment)}</td>
      <td onclick="event.stopPropagation();">${editBtn}</td>
    </tr>`;
  }).join('');

  tracker.innerHTML = identityHeader + `
    <div class="table-wrapper" style="margin-bottom:20px;">
      <table>
        <thead><tr>
          <th>כתובת</th><th>מבקש</th><th>סטטוס</th><th>תאריך</th><th>הערת אדריכלית</th><th>עריכה</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div id="submitterDetailPanel"></div>`;

  // Map for submitter's own requests
  renderSubmitterMap(active.filter(r => r.lat && r.lng));
}

function openSubmitterDetail(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;
  const panel = document.getElementById('submitterDetailPanel');
  if (!panel) return;
  const canEdit = req.status !== 'approved';
  const approvedNote = !canEdit
    ? `<div class="alert alert-success">בקשה זו אושרה סופית ואינה ניתנת לעריכה.</div>`
    : '';
  const commentsHtml = req.comments && req.comments.length
    ? req.comments.map(c => `<div class="comment-item"><div class="comment-text">${escapeHtml(c.text)}</div><div class="comment-date">${escapeHtml(c.date)}</div></div>`).join('')
    : '<p style="color:var(--text-light);font-size:13px;">אין הערות עדיין.</p>';
  panel.innerHTML = `
    <div class="detail-section" style="margin-top:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;">${escapeHtml(req.address)}</h3>
        <span class="badge badge-${req.status}">${translateStatus(req.status)}</span>
      </div>
      ${approvedNote}
      <div class="form-row" style="margin-bottom:12px;">
        <div><strong>מבקש:</strong> ${escapeHtml(req.applicantName||'—')}</div>
        <div><strong>גוש/חלקה:</strong> ${req.gushNumber||'—'} / ${req.helkaNumber||'—'}</div>
        <div><strong>הוגשה:</strong> ${req.createdAt}</div>
      </div>
      <div style="margin-bottom:14px;">
        <strong>הערות אדריכלית העיר:</strong>
        <div style="margin-top:8px;">${commentsHtml}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${canEdit ? ` <button class="btn btn-primary btn-sm" onclick="editRequest(${req.id})">עריכה ושליחת גרסה מעודכנת</button>` : ''}
        <button class="btn btn-light btn-sm" onclick="document.getElementById('submitterDetailPanel').innerHTML=''">סגור</button>
      </div>
    </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

let submitterMap = null;
let submitterMarkers = [];
function renderSubmitterMap(reqs) {
  // inject map container if not present
  let mapDiv = document.getElementById('submitterMiniMap');
  if (!mapDiv) {
    const panel = document.getElementById('trackerContent');
    const container = document.createElement('div');
    container.innerHTML = '<div id="submitterMiniMap" style="height:300px;overflow:hidden;margin-top:20px;border:1px solid var(--border);"></div>';
    panel.appendChild(container.firstChild);
    mapDiv = document.getElementById('submitterMiniMap');
  }
  if (!submitterMap) {
    submitterMap = L.map('submitterMiniMap').setView(ashdodCenter, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(submitterMap);
  }
  submitterMarkers.forEach(m => submitterMap.removeLayer(m));
  submitterMarkers = [];
  const colorMap = { pending: '#F3B220', approved: '#80B839', rejected: '#E8552A' };
  reqs.forEach(req => {
    const m = L.circleMarker([req.lat, req.lng], {
      radius: 10, fillColor: colorMap[req.status]||'#888', color: '#fff', weight: 2, fillOpacity: 0.9
    }).addTo(submitterMap);
    m.bindPopup(`<div dir="rtl"><strong>${escapeHtml(req.address)}</strong><br><span style="font-weight:700;">${translateStatus(req.status)}</span></div>`);
    submitterMarkers.push(m);
  });
  if (reqs.length) {
    const group = L.featureGroup(submitterMarkers);
    submitterMap.fitBounds(group.getBounds().pad(0.3));
  }
  setTimeout(() => submitterMap && submitterMap.invalidateSize(), 200);
}

function filterRequests() {
  const search = (document.getElementById('searchInput') || {value:''}).value.toLowerCase();
  const filter = (document.getElementById('filterStatus') || {value:''}).value;
  const base = showAllVersions ? requests : requests.filter(r => !r.superseded);
  const filtered = base.filter(req => {
    const matchSearch = (req.address||'').toLowerCase().includes(search) || (req.submitterName||'').toLowerCase().includes(search) || (req.applicantName||'').toLowerCase().includes(search);
    const matchFilter = !filter || req.status === filter;
    return matchSearch && matchFilter;
  });
  const sorted = sortRequests(filtered);
  renderRequestTable(sorted);
  renderRequestEditors(requests.filter(r => !r.superseded));
}

function toggleVersionsView() {
  showAllVersions = !showAllVersions;
  const btn = document.getElementById('toggleVersionsBtn');
  if (btn) btn.textContent = showAllVersions ? 'הסתר גרסאות ישנות' : 'הצג גרסאות קודמות';
  filterRequests();
}

function renderRequestTable(list) {
  const tbody = document.getElementById('requestsBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:24px;">אין בקשות להצגה</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((req, idx) => {
    const vBadge = (req.version > 1) ? ('<span class="version-badge">v' + req.version + '</span>') : '';
    const supersededStyle = req.superseded ? 'opacity:0.55;' : '';
    const rowClass = 'row-' + req.status;
    const badgeClass = 'badge badge-' + req.status;
    const num = String(idx + 1).padStart(3,'0');
    const status = translateStatus(req.status);
    return '<tr class="' + rowClass + '" style="' + supersededStyle + '">' +
      '<td>' + num + '</td>' +
      '<td>' + vBadge + '<strong>' + escapeHtml(req.address) + '</strong></td>' +
      '<td>' + escapeHtml(req.submitterName) + '</td>' +
      '<td>' + (escapeHtml(req.applicantName) || '—') + '</td>' +
      '<td><span class="' + badgeClass + '">' + status + '</span></td>' +
      '<td class="num">' + escapeHtml(req.createdAt) + '</td>' +
      '<td><button class="btn btn-light btn-sm" onclick="viewRequestDetails(' + req.id + ')">פרטים</button></td>' +
      '</tr>';
  }).join('');
}

function sortRequests(list) {
  return [...list].sort((a, b) => {
    const key = requestSort.key;
    const ord = requestSort.order === 'asc' ? 1 : -1;
    if (key === 'number') return ord * (a.id - b.id);
    if (key === 'address') return ord * a.address.localeCompare(b.address, 'he');
    if (key === 'submitterName') return ord * a.submitterName.localeCompare(b.submitterName, 'he');
    if (key === 'applicantName') return ord * (a.applicantName||'').localeCompare(b.applicantName||'', 'he');
    if (key === 'status') return ord * a.status.localeCompare(b.status);
    if (key === 'createdAt') return ord * (new Date(b.createdAt) - new Date(a.createdAt));
    return 0;
  });
}

function setTableSort(key) {
  requestSort.order = requestSort.key === key ? (requestSort.order === 'asc' ? 'desc' : 'asc') : 'asc';
  requestSort.key = key;
  updateSortHeaders();
  filterRequests();
}

function updateSortHeaders() {
  document.querySelectorAll('#requestsTable th.sortable').forEach(th => {
    th.classList.remove('sorted-asc','sorted-desc');
    if (th.dataset.sortKey === requestSort.key) th.classList.add(requestSort.order === 'asc' ? 'sorted-asc' : 'sorted-desc');
  });
}

function renderRequestEditors(list) {
  const container = document.getElementById('requestEditorsList');
  if (!container) return;
  const seen = new Set();
  const unique = list.filter(r => { const k = r.submitterName + r.submitterEmail; if(seen.has(k)) return false; seen.add(k); return true; });
  if (!unique.length) { container.innerHTML = '<div style="color:var(--text-light);font-size:13px;">אין עורכים.</div>'; return; }
  container.innerHTML = unique.map(req => {
    const emailBtn = req.submitterEmail ? '<button class="btn btn-light editor-email-btn" onclick="openEmailPreview(' + req.id + ')">מייל</button>' : '';
    return '<div class="editor-item">' +
      '<span class="editor-name">' + escapeHtml(req.submitterName) + '</span>' +
      '<span class="editor-meta">' + (escapeHtml(req.submitterEmail) || 'אין דוא"ל') + '</span>' +
      emailBtn +
      '</div>';
  }).join('');
}

function translateStatus(s) {
  return { pending:'ממתינה', approved:'אושרה', rejected:'דחויה' }[s] || s;
}

// ===== EDIT REQUEST (versioning) =====
function editRequest(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;
  if (req.status === 'approved') {
    toast('בקשה זו אושרה סופית ואינה ניתנת לעריכה.');
    return;
  }
  editingFromId = id;
  // Pre-fill form
  const set = (elId, val) => { const el = document.getElementById(elId); if(el) el.value = val || ''; };
  set('submitterName', req.submitterName);
  set('applicantName', req.applicantName);
  set('submitterEmail', req.submitterEmail);
  set('submitterPhone', req.submitterPhone);
  set('propertyStreet', req.street);
  set('propertyBuildingNumber', req.buildingNumber);
  set('gushNumber', req.gushNumber);
  set('helkaNumber', req.helkaNumber);
  set('expansionDescription', req.description);
  set('additionalNotes', req.notes);
  // Restore attachments if available
  if (req.planAttachment) {
    tempUploads.plan = req.planAttachment;
    showFileInZone('planUpload', 'planContent', req.planAttachment);
  }
  if (req.visualizationImage) {
    tempUploads.visualization = req.visualizationImage;
    showFileInZone('visualizationUpload', 'visualizationContent', req.visualizationImage);
  }
  // Show editing banner
  const banner = document.getElementById('editingBanner');
  const bannerText = document.getElementById('editingBannerText');
  if (banner) banner.classList.remove('hidden');
  if (bannerText) bannerText.textContent = `עריכת בקשה — ${req.address} (גרסה ${req.version||1}) — הגשה תיצור גרסה ${(req.version||1)+1}`;
  goToPage('submitterForm');
}

function cancelEditing() {
  editingFromId = null;
  const banner = document.getElementById('editingBanner');
  if (banner) banner.classList.add('hidden');
}

function showFileInZone(zoneId, contentId, attachment) {
  const zone = document.getElementById(zoneId);
  const content = document.getElementById(contentId);
  if (!zone || !content || !attachment) return;
  zone.querySelector('.zone-prompt').style.display = 'none';
  content.style.display = 'block';
  const type = attachment.type || '';
  const removeBtn = ` <button class="zone-remove" onclick="clearUploadZone('${zoneId === 'planUpload' ? 'plan' : 'visualization'}')" title="הסר">הסרה</button>`;
  if (type.startsWith('image/')) {
    const s = attachment.data.replace(/'/g,"\\'");
    content.innerHTML = removeBtn + `<img src="${attachment.data}" onclick="openImageFullscreen('${s}')" style="cursor:pointer;">`;
  } else {
    content.innerHTML = removeBtn + ` <div class="file-display"><span class="file-icon">${escapeHtml(((file||attachment).name.split('.').pop()||'').toUpperCase())}</span><span class="file-name">${escapeHtml(attachment.name)}</span></div>`;
  }
}

// ===== SUPABASE HELPERS =====
function requestToRow(req) {
  return {
    id: String(req.id),
    version: req.version || 1,
    parent_id: req.parentId ? String(req.parentId) : null,
    original_id: req.originalId ? String(req.originalId) : null,
    superseded: req.superseded || false,
    submitter_name: req.submitterName || '',
    applicant_name: req.applicantName || '',
    submitter_email: req.submitterEmail || '',
    submitter_phone: req.submitterPhone || '',
    street: req.street || '',
    building_number: req.buildingNumber || '',
    address: req.address || '',
    gush_number: req.gushNumber || '',
    helka_number: req.helkaNumber || '',
    description: req.description || '',
    notes: req.notes || '',
    status: req.status || 'pending',
    created_at: req.createdAt || '',
    lat: req.lat || null,
    lng: req.lng || null,
    checklist: req.requirementChecklist || [],
    approval: req.approval || null,
    comments: req.comments || [],
    plan_attachment: req.planAttachment ? JSON.stringify(req.planAttachment) : null,
    visualization_image: req.visualizationImage ? JSON.stringify(req.visualizationImage) : null,
    summary_text: req.summaryText || ''
  };
}

function rowToRequest(row) {
  return {
    id: Number(row.id) || row.id,
    version: row.version || 1,
    parentId: row.parent_id ? Number(row.parent_id) : null,
    originalId: row.original_id ? Number(row.original_id) : null,
    superseded: row.superseded || false,
    submitterName: row.submitter_name || '',
    applicantName: row.applicant_name || '',
    submitterEmail: row.submitter_email || '',
    submitterPhone: row.submitter_phone || '',
    street: row.street || '',
    buildingNumber: row.building_number || '',
    address: row.address || '',
    gushNumber: row.gush_number || '',
    helkaNumber: row.helka_number || '',
    description: row.description || '',
    notes: row.notes || '',
    status: row.status || 'pending',
    createdAt: row.created_at || '',
    lat: row.lat || null,
    lng: row.lng || null,
    requirementChecklist: row.checklist || [],
    approval: row.approval || null,
    comments: row.comments || [],
    planAttachment: row.plan_attachment ? JSON.parse(row.plan_attachment) : null,
    visualizationImage: row.visualization_image ? JSON.parse(row.visualization_image) : null,
    summaryText: row.summary_text || ''
  };
}

// Writes go through rz_save_documents, which checks the reviewer password hash server-side
async function saveDocumentsToSupabase(what = { docs: true }) {
  if (!supabaseClient) return;
  const hash = sessionStorage.getItem('reviewerHash');
  if (!hash) { toast('השינויים נשמרו במכשיר בלבד. כניסה מחדש עם סיסמה תשמור אותם במאגר.', true); return; }
  try {
    const { data, error } = await supabaseClient.rpc('rz_save_documents', {
      p_hash: hash,
      p_links: what.docs ? documentsContent.links : null,
      p_files: what.docs ? documentsContent.files : null,
      p_notes: what.docs ? documentsContent.notes : null,
      p_page_content: what.pageContent ? pageContent : null
    });
    if (error || data !== true) { toast('השמירה במאגר נכשלה. נסי להתחבר מחדש.', true); return; }
    toast('נשמר');
  } catch(e) { console.warn('Supabase docs save failed:', e); toast('השמירה במאגר נכשלה', true); }
}

async function loadDocumentsFromSupabase() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient.from(T_DOCS).select('links,files,notes,page_content').eq('id', 1).maybeSingle();
    if (error || !data) return;
    documentsContent = { links: data.links || [], files: data.files || [], notes: data.notes || [] };
    localStorage.setItem('documentsContent', JSON.stringify(documentsContent));
    if (data.page_content && Object.keys(data.page_content).length && !editMode) {
      pageContent = data.page_content;
      localStorage.setItem('pageContent', JSON.stringify(pageContent));
      loadPersistentPageContent();
    }
    renderDocumentsPage();
  } catch(e) { console.warn('Supabase docs load failed:', e); }
}

// ===== DETAIL PAGE =====
function viewRequestDetails(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;
  currentDetailId = id;
  const page = document.getElementById('reviewerRequestDetail');
  const title = document.getElementById('detailPageTitle');
  if (title) title.textContent = 'פרטי בקשה — ' + req.address;
  pendingDetailId = null;

  const missing = (req.requirementChecklist || []).filter(i => !i.checked);
  const checkedItems = (req.requirementChecklist || []).filter(i => i.checked);
  const autoSummary = buildSummaryText(req);
  const currentSummary = req.summaryText || autoSummary;

  const filesHtml = buildFilesHtml(req);
  const checklistHtml = buildChecklistHtml(req);
  const commentsHtml = (req.comments || []).map(c => `
    <div class="comment-item">
      <div class="comment-text">${escapeHtml(c.text)}</div>
      <div class="comment-date">${c.date}</div>
    </div>
  `).join('') || '<p style="color:var(--text-light);font-size:13px;">אין הערות עדיין.</p>';

  document.getElementById('detailPageContent').innerHTML = `
    <div class="detail-section">
      <h4>נתוני הבקשה</h4>
      <div class="form-row">
        <div>
          <div class="detail-row"><strong>כתובת:</strong> ${escapeHtml(req.address)}</div>
          <div class="detail-row"><strong>גוש / חלקה:</strong> <span class="num">${escapeHtml(req.gushNumber)||'—'} / ${escapeHtml(req.helkaNumber)||'—'}</span></div>
          <div class="detail-row"><strong>מבקש:</strong> ${escapeHtml(req.applicantName)||'—'}</div>
          <div class="detail-row"><strong>עורך בקשה:</strong> ${escapeHtml(req.submitterName)}</div>
        </div>
        <div>
          <div class="detail-row"><strong>טלפון:</strong> <span class="num">${escapeHtml(req.submitterPhone)||'—'}</span></div>
          <div class="detail-row"><strong>דוא"ל:</strong> ${escapeHtml(req.submitterEmail)||'—'}</div>
          <div class="detail-row"><strong>הוגשה:</strong> <span class="num">${escapeHtml(req.createdAt)}</span></div>
          <div class="detail-row"><strong>סטטוס:</strong> <span class="badge badge-${req.status}">${translateStatus(req.status)}</span></div>
        </div>
      </div>
      ${req.description ? `<div style="margin-top:10px;font-size:13px;"><strong>תיאור:</strong> ${escapeHtml(req.description)}</div>` : ''}
      ${req.notes ? `<div style="margin-top:6px;font-size:13px;"><strong>הערות מגיש:</strong> ${escapeHtml(req.notes)}</div>` : ''}
    </div>

    ${filesHtml}
    ${checklistHtml}

    ${missing.length ? ` <div class="detail-section" style="border-inline-start:3px solid var(--dune-500);">
      <h4 style="color:var(--amber);">פריטים חסרים / לא מולאו (${missing.length})</h4>
      <ul style="margin-right:16px;">
        ${missing.map(i => `<li style="font-size:13px;margin-bottom:4px;">${escapeHtml(i.text)}${i.note ? ` — <em style="color:var(--text-light);">${escapeHtml(i.note)}</em>` : ''}</li>`).join('')}
      </ul>
    </div>` : ''}

    <div class="detail-section">
      <h4>הערות</h4>
      <div id="detailCommentsList">${commentsHtml}</div>
      <div style="margin-top:12px;">
        <textarea id="newCommentInput" style="width:100%;min-height:60px;padding:9px;border:1px solid var(--border);border-radius:4px;font-size:13px;font-family:inherit;direction:rtl;resize:vertical;" placeholder="הוסף הערה חדשה..."></textarea>
        <button class="btn btn-warning btn-sm" style="margin-top:6px;" onclick="addComment(${id})">הוסף הערה</button>
      </div>
    </div>

    <div class="detail-section">
      <h4>סיכום — ניתן לעריכה</h4>
      <p style="font-size:12px;color:var(--text-light);margin-bottom:8px;">הסיכום נוצר אוטומטית מנתוני הבקשה. ניתן לערוך ולשמור.</p>
      <textarea id="summaryTextarea" class="summary-textarea">${escapeHtml(currentSummary)}</textarea>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <button class="btn btn-light btn-sm" onclick="regenerateSummary(${id})">צור מחדש אוטומטית</button>
        <button class="btn btn-success btn-sm" onclick="saveSummary(${id}, this)">שמור סיכום</button>
      </div>
    </div>

    <div class="detail-section">
      <h4>החלטה</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-success btn-sm" onclick="makeDecision(${id},'approved')">אשר בקשה</button>
        <button class="btn btn-danger btn-sm" onclick="makeDecision(${id},'rejected')">דחה בקשה</button>
        <button class="btn btn-light btn-sm" onclick="makeDecision(${id},'pending')">החזר לממתין</button>
        <button class="btn btn-light btn-sm" onclick="openEmailPreview(${id})">שלח מייל לעורך</button>
      </div>
    </div>
  `;

  if (currentRole !== 'reviewer') switchRole('reviewer');
  goToPage('reviewerRequestDetail');
}

function buildFilesHtml(req) {
  const items = [];
  if (req.planAttachment) {
    const isImg = req.planAttachment.type && req.planAttachment.type.startsWith('image/');
    if (isImg) {
      const s = req.planAttachment.data.replace(/'/g,"\\'");
      items.push(`<div><strong style="font-size:12px;">תוכנית בינוי:</strong><br><img src="${req.planAttachment.data}" style="max-width:100%;max-height:180px;border-radius:4px;cursor:pointer;margin-top:6px;border:1px solid var(--border);" onclick="openImageFullscreen('${s}')"></div>`);
    } else {
      items.push(`<div><strong style="font-size:12px;">תוכנית בינוי:</strong> <a href="${req.planAttachment.data}" target="_blank" class="btn btn-light btn-sm" download="${req.planAttachment.name}">${escapeHtml(req.planAttachment.name)}</a></div>`);
    }
  }
  if (req.visualizationImage) {
    const isImg = req.visualizationImage.type && req.visualizationImage.type.startsWith('image/');
    if (isImg) {
      const s = req.visualizationImage.data.replace(/'/g,"\\'");
      items.push(`<div><strong style="font-size:12px;">הדמייה:</strong><br><img src="${req.visualizationImage.data}" style="max-width:100%;max-height:180px;border-radius:4px;cursor:pointer;margin-top:6px;border:1px solid var(--border);" onclick="openImageFullscreen('${s}')"></div>`);
    } else {
      items.push(`<div><strong style="font-size:12px;">הדמייה:</strong> <a href="${req.visualizationImage.data}" target="_blank" class="btn btn-light btn-sm" download="${req.visualizationImage.name}">${escapeHtml(req.visualizationImage.name)}</a></div>`);
    }
  }
  if (!items.length) return '';
  return ` <div class="detail-section"><h4>קבצים מצורפים</h4><div style="display:grid;gap:12px;">${items.join('')}</div></div>`;
}

function buildChecklistHtml(req) {
  if (!req.requirementChecklist || !req.requirementChecklist.length) return '';
  const checked = req.requirementChecklist.filter(i => i.checked).length;
  const total = req.requirementChecklist.length;
  const rows = req.requirementChecklist.map(item => {
    const icon = item.checked ? '<span class="check-yes">קיים</span>' : '<span class="check-no">חסר</span>';
    return `<tr>
      <td style="padding:6px 8px;">${icon}</td>
      <td style="padding:6px 8px;font-size:13px;">${escapeHtml(item.text)}</td>
      <td style="padding:6px 8px;font-size:12px;color:var(--text-light);">${item.note ? escapeHtml(item.note) : ''}</td>
    </tr>`;
  }).join('');
  return ` <div class="detail-section">
    <h4>צ׳ק ליסט (${checked}/${total})</h4>
    <table style="width:100%;border-collapse:collapse;">
      <thead style="background:var(--light-bg);">
        <tr><th style="padding:6px 8px;text-align:right;font-size:12px;width:56px;">מצב</th><th style="padding:6px 8px;text-align:right;font-size:12px;">פריט</th><th style="padding:6px 8px;text-align:right;font-size:12px;">הערה</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function buildSummaryText(req) {
  const missing = (req.requirementChecklist || []).filter(i => !i.checked);
  const approvalNotes = req.approval && req.approval.notes ? req.approval.notes : '';
  let txt = `סיכום בקשה\n`;
  txt += `==================\n`;
  txt += `כתובת: ${req.address}\n`;
  txt += `גוש: ${req.gushNumber||'—'} | חלקה: ${req.helkaNumber||'—'}\n`;
  txt += `מבקש: ${req.applicantName||'—'}\n`;
  txt += `עורך הבקשה: ${req.submitterName}\n`;
  txt += `תאריך הגשה: ${req.createdAt}\n\n`;
  if (req.description) txt += `תיאור: ${req.description}\n\n`;

  if (req.status === 'approved') {
    txt += `החלטה: הבקשה אושרה.\n`;
    if (approvalNotes) txt += `פרטים: ${approvalNotes}\n`;
  } else if (req.status === 'rejected') {
    txt += `החלטה: הבקשה נדחתה.\n`;
    if (missing.length) {
      txt += `סיבות:\n`;
      missing.forEach(i => { txt += `  - ${i.text}`; if(i.note) txt += ` (${i.note})`; txt += '\n'; });
    }
    if (approvalNotes) txt += `הערות נוספות: ${approvalNotes}\n`;
  } else {
    txt += `סטטוס: ממתינה לאישור.\n`;
    if (missing.length) {
      txt += `פריטים שטרם מולאו:\n`;
      missing.forEach(i => { txt += `  - ${i.text}`; if(i.note) txt += ` (${i.note})`; txt += '\n'; });
    }
  }

  if (req.notes) txt += `\nהערות מגיש: ${req.notes}\n`;

  const comments = req.comments || [];
  if (comments.length) {
    txt += `\nהיסטוריית הערות:\n`;
    comments.forEach(c => { txt += `[${c.date}] ${c.text}\n`; });
  }
  return txt;
}

function saveSummary(id, btn) {
  const req = requests.find(r => r.id === id);
  if (!req) return;
  req.summaryText = document.getElementById('summaryTextarea').value;
  persistRequest(req);
  if (btn) { btn.textContent = 'נשמר'; setTimeout(() => { btn.textContent = 'שמור סיכום'; }, 2000); }
}

function regenerateSummary(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;
  document.getElementById('summaryTextarea').value = buildSummaryText(req);
}

function addComment(id) {
  const req = requests.find(r => r.id === id);
  const input = document.getElementById('newCommentInput');
  if (!req || !input || !input.value.trim()) { toast('הכנס הערה'); return; }
  if (!req.comments) req.comments = [];
  req.comments.push({ text: input.value.trim(), date: todayStr() });
  persistRequest(req);
  input.value = '';
  viewRequestDetails(id);
}

function makeDecision(id, decision) {
  const req = requests.find(r => r.id === id);
  if (!req) return;
  const summaryEl = document.getElementById('summaryTextarea');
  req.status = decision;
  req.approval = { date: todayStr(), decision, notes: summaryEl ? summaryEl.value : '' };
  req.summaryText = summaryEl ? summaryEl.value : '';
  persistRequest(req);
  loadRequests();
  viewRequestDetails(id);
}

// ===== EMAIL =====
function openEmailPreview(id) {
  const req = requests.find(r => r.id === id);
  if (!req) return;
  const summaryEl = document.getElementById('summaryTextarea');
  const summaryText = summaryEl ? summaryEl.value : (req.summaryText || buildSummaryText(req));
  const missing = (req.requirementChecklist || []).filter(i => !i.checked).map(i => i.text);
  const missingTxt = missing.length ? `\nפריטים שטרם מולאו:\n- ${missing.join('\n- ')}\n` : '';
  const body = `שלום ${req.submitterName},\n\nהבקשה לכתובת ${req.address} נבדקה.\n${missingTxt}\nסיכום:\n${summaryText}\n\nבברכה,\nאדריכלית העיר`;
  const subject = `עדכון בקשת תוכנית — ${req.address}`;
  const to = req.submitterEmail || '';

  pendingEmailData = { to, subject, body, id };
  document.getElementById('previewEmailTo').textContent = to || '(אין כתובת דוא"ל)';
  document.getElementById('previewEmailSubject').textContent = subject;
  document.getElementById('previewEmailBody').value = body;
  document.getElementById('emailPreviewModal').classList.add('active');
}

function sendPreviewedEmail() {
  if (!pendingEmailData) return;
  const to = pendingEmailData.to;
  const subject = document.getElementById('previewEmailSubject').textContent;
  const body = document.getElementById('previewEmailBody').value;
  if (!to) { toast('אין כתובת דוא"ל לשליחה'); return; }
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  closeEmailPreview();
}

function closeEmailPreview() {
  document.getElementById('emailPreviewModal').classList.remove('active');
  pendingEmailData = null;
}

// ===== LOCATION MODAL =====
function openLocationModal(request, candidates) {
  pendingLocationRequest = request;
  pendingLocationCandidates = candidates || [];
  const body = document.getElementById('locationModalBody');
  if (!candidates || !candidates.length) {
    body.innerHTML = `<p style="margin-bottom:12px;">לא נמצאו תוצאות לכתובת: <strong>${request.address}</strong>.</p><div class="modal-actions"><button class="btn btn-primary" onclick="skipLocationAndSave()">שמור ללא מיקום במפה</button><button class="btn btn-light" onclick="closeLocationModal()">ביטול</button></div>`;
  } else {
    const opts = candidates.map((c, i) => `
      <div class="location-option">
        <label><input type="radio" name="locCand" value="${i}" ${i===0?'checked':''}> <div><strong>${c.display_name}</strong><br><small style="color:var(--text-light);">${c.type||''}${c.address.city||c.address.town ? ' · '+(c.address.city||c.address.town) : ''}</small></div></label>
      </div>`).join('');
    body.innerHTML = `<p style="margin-bottom:12px;">נמצאו מספר תוצאות עבור: <strong>${request.address}</strong>. בחרו מיקום:</p><div style="margin-bottom:14px;">${opts}</div><div class="modal-actions"><button class="btn btn-primary" onclick="confirmPendingLocation()">אשר מיקום</button><button class="btn btn-light" onclick="skipLocationAndSave()">שמור ללא מיקום</button><button class="btn btn-light" onclick="closeLocationModal()">ביטול</button></div>`;
  }
  document.getElementById('locationModal').classList.add('active');
}

function skipLocationAndSave() {
  if (!pendingLocationRequest) return;
  finalizeRequest(pendingLocationRequest);
  pendingLocationRequest = null;
  pendingLocationCandidates = [];
  closeLocationModal();
}

function closeLocationModal() {
  document.getElementById('locationModal').classList.remove('active');
}

async function confirmPendingLocation() {
  const sel = document.querySelector('input[name="locCand"]:checked');
  if (!sel) { toast('בחרו מיקום'); return; }
  const idx = parseInt(sel.value, 10);
  const chosen = pendingLocationCandidates[idx];
  if (!chosen) { toast('שגיאה. נסו שוב.'); return; }
  pendingLocationRequest.lat = parseFloat(chosen.lat);
  pendingLocationRequest.lng = parseFloat(chosen.lon);
  finalizeRequest(pendingLocationRequest);
  pendingLocationRequest = null;
  pendingLocationCandidates = [];
  closeLocationModal();
}

// ===== GEOCODING =====
async function geocodeFullAddress(address) {
  const enc = encodeURIComponent(address + ', אשדוד, ישראל');
  const url = `https://nominatim.openstreetmap.org/search?q=${enc}&format=json&addressdetails=1&limit=5&accept-language=he`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function normalizeAddress(t) {
  return t.toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9א-ת\-]/gi,'').trim();
}

function addressLooksExact(address, result) {
  const norm = normalizeAddress(address);
  const disp = normalizeAddress(result.display_name || '');
  return norm.split(' ').every(p => p && disp.includes(p));
}

async function resolveRequestLocation(request) {
  const results = await geocodeFullAddress(request.address);
  if (!results.length) return { status: 'not_found' };
  if (results.length === 1 && addressLooksExact(request.address, results[0])) {
    return { status: 'ok', lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  }
  const exact = results.filter(r => addressLooksExact(request.address, r));
  if (exact.length === 1) return { status: 'ok', lat: parseFloat(exact[0].lat), lng: parseFloat(exact[0].lon) };
  return { status: 'ambiguous', candidates: results };
}

async function geocodeRequestsWithoutLocation() {
  let changed = false;
  for (const req of requests) {
    if (req.lat && req.lng) continue;
    try {
      const r = await resolveRequestLocation(req);
      if (r.status === 'ok') { req.lat = r.lat; req.lng = r.lng; changed = true; }
    } catch {}
  }
  if (changed) localStorage.setItem('requests', JSON.stringify(requests));
}

// ===== MAP =====
function initializeMap() {
  map = L.map('map').setView(ashdodCenter, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19
  }).addTo(map);
  updateMapMarkers();
}

function updateMapMarkers() {
  if (!map) return;
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  requests.forEach((req, idx) => {
    if (!req.lat || !req.lng) return;
    const colorMap = { pending: '#F3B220', approved: '#80B839', rejected: '#E8552A' };
    const m = L.circleMarker([parseFloat(req.lat), parseFloat(req.lng)], {
      radius: 9, fillColor: colorMap[req.status] || '#888', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.85
    }).addTo(map);
    const emailBtn = req.submitterEmail
      ? `<button onclick="openEmailPreview(${req.id})" style="width:100%;margin-top:6px;padding:5px;font-size:12px;background:#216B8C;color:white;border:none;border-radius:3px;cursor:pointer;">שלח מייל</button>`
      : '';
    m.bindPopup(`<div dir="rtl" style="min-width:160px;"><strong>${escapeHtml(req.address)}</strong><br><span style="font-size:12px;">${escapeHtml(req.submitterName)}</span><br><span style="font-size:11px;color:#666;">${escapeHtml(req.applicantName)}</span><br><span style="font-size:12px;font-weight:700;color:#13222C">${translateStatus(req.status)}</span><br><button onclick="viewRequestDetails(${req.id})" style="width:100%;margin-top:6px;padding:5px;font-size:12px;background:white;border:1px solid #ddd;border-radius:3px;cursor:pointer;">פרטים</button>${emailBtn}</div>`);
    markers.push(m);
  });
}

// ===== IMAGE VIEWER =====
function openImageFullscreen(src) {
  const modal = document.getElementById('imageViewerModal');
  const img = document.getElementById('viewerImage');
  img.src = src;
  viewerState = { scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 };
  updateViewerTransform();
  modal.classList.add('active');
}

function closeImageViewer(event) {
  if (event) event.stopPropagation();
  document.getElementById('imageViewerModal').classList.remove('active');
}

function zoomViewer(f) {
  viewerState.scale = Math.min(4, Math.max(0.5, viewerState.scale * f));
  updateViewerTransform();
}

function resetViewer() {
  viewerState = { scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 };
  updateViewerTransform();
}

function updateViewerTransform() {
  document.getElementById('viewerImage').style.transform = `translate(${viewerState.x}px,${viewerState.y}px) scale(${viewerState.scale})`;
}

function setupViewerEvents() {
  const img = document.getElementById('viewerImage');
  img.addEventListener('pointerdown', e => {
    viewerState.dragging = true;
    viewerState.startX = e.clientX - viewerState.x;
    viewerState.startY = e.clientY - viewerState.y;
    img.setPointerCapture(e.pointerId);
  });
  img.addEventListener('pointermove', e => {
    if (!viewerState.dragging) return;
    viewerState.x = e.clientX - viewerState.startX;
    viewerState.y = e.clientY - viewerState.startY;
    updateViewerTransform();
  });
  img.addEventListener('pointerup', e => { viewerState.dragging = false; img.releasePointerCapture(e.pointerId); });
  img.addEventListener('wheel', e => { e.preventDefault(); zoomViewer(e.deltaY < 0 ? 1.15 : 0.87); });
}

// ===== REVIEWER AUTH =====
// The password hash never reaches the browser: rz_check_reviewer / rz_set_reviewer compare it server-side
async function hashPassword(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function reviewerPasswordIsSet() {
  if (!supabaseClient) return true;
  try {
    const { data, error } = await supabaseClient.rpc('rz_reviewer_password_set');
    return error ? true : data === true;
  } catch { return true; }
}

async function openReviewerPasswordModal() {
  const setupSection = document.getElementById('reviewerSetupSection');
  const loginSection = document.getElementById('reviewerLoginSection');
  const isSet = await reviewerPasswordIsSet();
  if (!isSet) {
    setupSection.style.display = '';
    loginSection.style.display = 'none';
    setTimeout(() => document.getElementById('reviewerNewPwd').focus(), 100);
  } else {
    setupSection.style.display = 'none';
    loginSection.style.display = '';
    document.getElementById('reviewerPasswordInput').value = '';
    document.getElementById('reviewerPasswordError').style.display = 'none';
    setTimeout(() => document.getElementById('reviewerPasswordInput').focus(), 100);
  }
  document.getElementById('reviewerPasswordModal').classList.add('active');
}

function closeReviewerPasswordModal() {
  document.getElementById('reviewerPasswordModal').classList.remove('active');
}

function enterAsReviewer(hash) {
  sessionStorage.setItem('reviewerAuth', '1');
  sessionStorage.setItem('reviewerHash', hash);
  closeReviewerPasswordModal();
  closeLanding();
  _doSwitchRole('reviewer');
}

async function setReviewerPassword() {
  const p1 = document.getElementById('reviewerNewPwd').value;
  const p2 = document.getElementById('reviewerNewPwd2').value;
  const errEl = document.getElementById('reviewerSetupError');
  if (!p1 || p1.length < 6) { errEl.textContent = 'הסיסמה קצרה מדי (לפחות 6 תווים)'; errEl.style.display = 'block'; return; }
  if (p1 !== p2) { errEl.textContent = 'הסיסמאות אינן תואמות'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  const hash = await hashPassword(p1);
  if (supabaseClient) {
    const { data, error } = await supabaseClient.rpc('rz_set_reviewer', { p_new_hash: hash, p_old_hash: null });
    if (error || data !== true) { errEl.textContent = 'לא ניתן להגדיר סיסמה. ייתכן שכבר הוגדרה.'; errEl.style.display = 'block'; return; }
  }
  enterAsReviewer(hash);
}

async function verifyReviewerPassword() {
  const pwd = document.getElementById('reviewerPasswordInput').value;
  const hash = await hashPassword(pwd);
  let ok = false;
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.rpc('rz_check_reviewer', { p_hash: hash });
      ok = !error && data === true;
    } catch { ok = false; }
  }
  if (ok) {
    enterAsReviewer(hash);
  } else {
    document.getElementById('reviewerPasswordError').style.display = 'block';
    document.getElementById('reviewerPasswordInput').value = '';
    document.getElementById('reviewerPasswordInput').focus();
  }
}

function logoutReviewer() {
  sessionStorage.removeItem('reviewerAuth');
  sessionStorage.removeItem('reviewerHash');
  goBackToLanding();
}

// ===== SUBMITTER IDENTITY =====
function prefillFormFromIdentity() {
  if (!submitterIdentityName && !submitterIdentityPhone) return;
  const nameEl = document.getElementById('submitterName');
  const phoneEl = document.getElementById('submitterPhone');
  if (nameEl && !nameEl.value && submitterIdentityName) nameEl.value = submitterIdentityName;
  if (phoneEl && !phoneEl.value && submitterIdentityPhone) phoneEl.value = submitterIdentityPhone;
}

function clearSubmitterIdentity() {
  goBackToLanding();
}

// ===== UTILITIES =====
function todayStr() {
  return new Date().toLocaleDateString('he-IL');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== SEARCH in dashboard =====
document.addEventListener('DOMContentLoaded', () => {
  const si = document.getElementById('searchInput');
  if (si) si.addEventListener('input', filterRequests);
});

// ===== LANDING PAGE =====
const REVIEWER_NAMES = ['אדריכלית העיר', 'אדריכלית עיר'];

function savedLoginNames() {
  return JSON.parse(localStorage.getItem('knownLoginNames') || '[]');
}

function saveLoginName(fullName) {
  const names = savedLoginNames();
  if (!names.includes(fullName)) {
    names.unshift(fullName);
    localStorage.setItem('knownLoginNames', JSON.stringify(names.slice(0, 50)));
  }
}

function populateLandingDatalist() {
  const names = savedLoginNames();
  // populate existing-user select
  const sel = document.getElementById('existingNameSelect');
  if (sel) {
    const prev = sel.value;
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    sel.innerHTML = '<option value="">בחרו שם</option>' +
      names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if (prev) sel.value = prev;
  }
  // show correct tab based on whether names exist
  if (names.length === 0) showLoginTab('new');
}

function showLoginTab(tab) {
  const isNew = tab === 'new';
  const elExisting = document.getElementById('loginExisting');
  const elNew = document.getElementById('loginNew');
  if (!elExisting || !elNew) return;
  elExisting.style.display = isNew ? 'none' : 'block';
  elNew.style.display = isNew ? 'block' : 'none';
  document.getElementById('loginSeg').classList.toggle('second', isNew);
  document.getElementById('tabExisting').classList.toggle('on', !isNew);
  document.getElementById('tabNew').classList.toggle('on', isNew);
  if (isNew && document.getElementById('landingScreen').style.display !== 'none') {
    setTimeout(() => { const f = document.getElementById('landingFirstName'); if (f) f.focus({ preventScroll: true }); }, 50);
  }
}

function landingEnterExisting() {
  const sel = document.getElementById('existingNameSelect');
  const fullName = sel ? sel.value.trim() : '';
  const errEl = document.getElementById('landingErrorExisting');
  if (!fullName) { errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  doLandingEnter(fullName);
}

function updateLastNameList() {
  // kept for compat — no longer used
}

function landingEnter() {
  const first = document.getElementById('landingFirstName').value.trim();
  const last  = document.getElementById('landingLastName').value.trim();
  const errEl = document.getElementById('landingError');
  if (!first || !last) { errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  doLandingEnter(first + ' ' + last);
}

function doLandingEnter(fullName) {
  // The city architect always needs her password; the name alone grants nothing
  if (REVIEWER_NAMES.includes(fullName)) {
    openReviewerPasswordModal();
    return;
  }
  // Regular submitter — save name and enter
  saveLoginName(fullName);
  submitterIdentityName = fullName;
  sessionStorage.setItem('submitterName', fullName);
  closeLanding();
  updateSubmitterGreeting();
  _doSwitchRole('submitter');
}

function closeLanding() {
  document.getElementById('landingScreen').style.display = 'none';
  document.getElementById('appShell').style.display = '';
  window.scrollTo(0, 0);
}

function goBackToLanding() {
  submitterIdentityName = null;
  submitterIdentityPhone = null;
  sessionStorage.removeItem('submitterName');
  sessionStorage.removeItem('submitterPhone');
  sessionStorage.removeItem('reviewerAuth');
  sessionStorage.removeItem('reviewerHash');
  currentRole = 'submitter';
  applyRoleClass();
  updateSubmitterGreeting();
  ['logoutBtn','submitterLogoutBtn'].forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById('editorToolbar').classList.add('hidden');
  history.replaceState(null, '', location.pathname);
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('landingScreen').style.display = '';
  window.scrollTo(0, 0);
  const fn = document.getElementById('landingFirstName');
  const ln = document.getElementById('landingLastName');
  if (fn) fn.value = '';
  if (ln) ln.value = '';
  populateLandingDatalist();
}
