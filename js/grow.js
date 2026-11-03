// "הבית שגדל": axonometric drawing of plan 603-0595660 rules.
// The permitted addition grows out of the rear facade; setback lines are planes with their numbers.
// Every rule (here, in the guidelines list and in the checklist) highlights the part it governs.
// Numbers come only from the plan instructions (sections 1.9, 4.1.2, 6/7 in the PDF).
(function () {
  'use strict';

  var PLAN = {
    maxArea: 160,        // מ"ר, שטח דירה מקסימלי (4.1.2 א 1)
    balcony: 12,         // מ"ר מרפסת
    sukkah: 5,           // מ"ר מרפסת סוכה
    roof: 60,            // מ"ר חדרים על הגג, כלולים ב-160 (4.1.2 א 2)
    balconyOver: 1.6,    // מ' חריגה למרפסות מקווי הבניין (4.1.2 ב 15)
    sideLow: 3,          // מ' עד 4 קומות מעל קומת עמודים (4.1.2 ב 13)
    sideHigh: 4,         // מ' מעל 4 קומות
    front: 0,            // מ' קו קדמי
    validFrom: new Date(2024, 10, 1),
    validTo: new Date(2034, 10, 1)
  };

  var RULES = [
    { part: 'eligible', label: 'זכאות', value: '4+ דירות', meaning: 'בניין רווי: ארבע דירות או יותר, שתי קומות לפחות, עם אישור אכלוס לפני אישור התוכנית.' },
    { part: 'area', label: 'שטח הדירה', value: 'עד 160 מ"ר', meaning: 'כל הדירה אחרי ההרחבה, ולא רק התוספת.' },
    { part: 'balcony', label: 'מרפסת וסוכה', value: '12 + 5 מ"ר', meaning: 'נוספים מעל 160 מ"ר. מרפסת יכולה לחרוג עד 1.6 מ\' מקו הבניין, בתנאים.' },
    { part: 'side', label: 'קו בניין לשכנים', value: '3 מ\' / 4 מ\'', meaning: '3 מ\' בבניין עד 4 קומות מעל קומת עמודים, 4 מ\' בבניין גבוה יותר.' },
    { part: 'front', label: 'קו בניין לרחוב', value: '0 מ\'', meaning: 'לכיוון הרחוב או שטח ציבורי אפשר לבנות עד גבול המגרש.' },
    { part: 'column', label: 'טור דירות', value: 'מלמטה למעלה', meaning: 'מרחיבים טור שלם בלי דילוגים. דירה שלא מורחבת מקבלת מעטפת עם גמר מלא.' },
    { part: 'roof', label: 'חדר על הגג', value: 'עד 60 מ"ר', meaning: 'רק לדירה בקומה העליונה, והשטח כלול ב-160 מ"ר.' },
    { part: 'validity', label: 'תוקף', value: '10 שנים', meaning: 'היתר צריך לצאת עד 11/2034. אחרי זה התוכנית פוקעת.' }
  ];

  // Existing guideline and checklist items, linked by their stable keys (their text is editable).
  var LINKS = {
    '[data-edit-key="instruction1"]': 'eligible',
    '[data-edit-key="instruction2"]': 'area balcony',
    '[data-edit-key="instruction3"]': 'side front',
    '[data-edit-key="criticalHint"]': 'side front',
    '[data-edit-key="req3"]': 'validity',
    '[data-check-id="check1"]': 'eligible',
    '[data-check-id="check2"]': 'eligible',
    '[data-check-id="check3"]': 'area balcony'
  };

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C = Math.cos(Math.PI / 6), S = 0.5;

  function P(x, y, z) { return [(x - y) * C, (x + y) * S - z]; }
  function pts(list) { return list.map(function (p) { var q = P(p[0], p[1], p[2]); return q[0].toFixed(2) + ',' + q[1].toFixed(2); }).join(' '); }
  function poly(list, cls, part) { return '<polygon class="' + cls + '"' + (part ? ' data-part="' + part + '"' : '') + ' points="' + pts(list) + '"/>'; }
  function line(a, b, cls, part) {
    var p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]);
    return '<line class="' + cls + '"' + (part ? ' data-part="' + part + '"' : '') + ' x1="' + p[0].toFixed(2) + '" y1="' + p[1].toFixed(2) + '" x2="' + q[0].toFixed(2) + '" y2="' + q[1].toFixed(2) + '"/>';
  }
  // A box shows three faces to a viewer standing at +x +y above.
  function box(x0, x1, y0, y1, z0, z1, mat, part) {
    if (x1 - x0 <= 0.01 || y1 - y0 <= 0.01 || z1 - z0 <= 0.01) return '';
    return '<g class="' + mat + '"' + (part ? ' data-part="' + part + '"' : '') + '>' +
      poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], 'fx') +
      poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], 'fy') +
      poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 'ft') + '</g>';
  }
  function label(x, y, z, html, part, cls) {
    var p = P(x, y, z);
    return '<text class="gl ' + (cls || '') + '"' + (part ? ' data-part="' + part + '"' : '') + ' x="' + p[0].toFixed(2) + '" y="' + p[1].toFixed(2) + '" text-anchor="middle" direction="rtl">' + html + '</text>';
  }

  // Scene in metres: x along the street, y away from it (street at y<0), z up.
  var PLOT = { x: 26, y: 24 };
  var B = { x0: 4, x1: 22, y0: 2, y1: 12 };      // existing building
  var COL = { x0: 13, x1: 22 };                  // the apartment column that grows
  var FH = 3;                                     // floor height (illustration)

  function scene(st, g) {
    var N = st.floors, s = st.floors > 4 ? PLAN.sideHigh : PLAN.sideLow;
    var top = FH * (N + 1);
    var rear = PLOT.y - s;                        // rear setback plane
    var dMax = rear - B.y1;                       // deepest addition that keeps the line
    var add = Math.max(0, PLAN.maxArea - st.today);
    var d = dMax * Math.min(1, add / (PLAN.maxArea - 40));
    var h = '';

    // ground, street, plot line, neighbour footprint
    h += poly([[-1, -4, 0], [PLOT.x + 1, -4, 0], [PLOT.x + 1, 0, 0], [-1, 0, 0]], 'street');
    h += label(8, -2, 0, 'רחוב', 'front', 'gl-quiet');
    h += poly([[0, 0, 0], [PLOT.x, 0, 0], [PLOT.x, PLOT.y, 0], [0, PLOT.y, 0]], 'plot');
    h += poly([[B.x0 + 2, 26.5, 0], [B.x1 - 2, 26.5, 0], [B.x1 - 2, 31, 0], [B.x0 + 2, 31, 0]], 'neigh', 'side');
    h += label((B.x0 + B.x1) / 2, 28.75, 0, 'בניין שכן', 'side', 'gl-quiet');

    // front line, 0 m: on the plot edge facing the street
    h += poly([[0, 0, 0], [PLOT.x, 0, 0], [PLOT.x, 0, top + 2], [0, 0, top + 2]], 'plane plane-front', 'front');
    h += label(2.5, 0, top + 2.6, 'קו קדמי <tspan class="gn">0 מ\'</tspan>', 'front');

    // pilotis floor and columns
    h += box(B.x0 + 0.8, B.x1 - 0.8, B.y0 + 0.8, B.y1 - 0.8, 0, FH, 'm-pil', 'eligible');
    [[B.x0, B.y0], [B.x1 - 0.5, B.y0], [B.x0, B.y1 - 0.5], [B.x1 - 0.5, B.y1 - 0.5], [COL.x0 - 0.25, B.y1 - 0.5]].forEach(function (c) {
      h += box(c[0], c[0] + 0.5, c[1], c[1] + 0.5, 0, FH, 'm-exist', 'eligible');
    });
    // existing floors
    h += box(B.x0, B.x1, B.y0, B.y1, FH, top, 'm-exist', 'eligible');
    for (var k = 2; k <= N; k++) {
      h += line([B.x1, B.y0, FH * k], [B.x1, B.y1, FH * k], 'floorline', 'eligible');
      h += line([B.x0, B.y1, FH * k], [B.x1, B.y1, FH * k], 'floorline', 'eligible');
    }
    for (k = 1; k <= N; k++) {
      for (var w = 0; w < 3; w++) {
        var wy = B.y0 + 1.6 + w * 3;
        h += poly([[B.x1, wy, FH * k + 1], [B.x1, wy + 1.6, FH * k + 1], [B.x1, wy + 1.6, FH * k + 2.3], [B.x1, wy, FH * k + 2.3]], 'win', 'eligible');
      }
      h += poly([[B.x0 + 2, B.y1, FH * k + 1], [B.x0 + 5, B.y1, FH * k + 1], [B.x0 + 5, B.y1, FH * k + 2.3], [B.x0 + 2, B.y1, FH * k + 2.3]], 'win', 'eligible');
    }
    h += label(B.x1, B.y0 + 5, FH + 0.4, '<tspan class="gn">' + N + '</tspan> קומות מעל קומת עמודים', 'eligible', 'gl-on-face');

    // side setback plane (to neighbours)
    var sx = PLOT.x - s;
    h += poly([[sx, 0, 0], [sx, PLOT.y, 0], [sx, PLOT.y, top + 2], [sx, 0, top + 2]], 'plane', 'side');

    // the addition: floor by floor, bottom up
    for (k = 1; k <= N; k++) {
      var gk = Math.max(0, Math.min(1, (g * (N + 3) - (k - 1)) / 3));
      var dk = d * gk;
      if (dk > 0.05) {
        // columns carrying the first floor of the addition over the pilotis
        if (k === 1) {
          h += box(COL.x0 + 0.2, COL.x0 + 0.7, B.y1 + dk - 0.5, B.y1 + dk, 0, FH, 'm-add', 'area column');
          h += box(COL.x1 - 0.7, COL.x1 - 0.2, B.y1 + dk - 0.5, B.y1 + dk, 0, FH, 'm-add', 'area column');
        }
        h += box(COL.x0, COL.x1, B.y1, B.y1 + dk, FH * k, FH * k + FH, 'm-add', 'area column');
        h += label((COL.x0 + COL.x1) / 2, B.y1 + dk, FH * k + 1.2, '<tspan class="gn">' + k + '</tspan>', 'column', 'gl-step');
        if (gk >= 1 && st.today < PLAN.maxArea) {
          var by = B.y1 + d;
          h += box(COL.x0 + 2, COL.x1 - 2, by, by + PLAN.balconyOver, FH * k, FH * k + 0.25, 'm-bal', 'balcony');
          h += poly([[COL.x0 + 2, by + PLAN.balconyOver, FH * k + 0.25], [COL.x1 - 2, by + PLAN.balconyOver, FH * k + 0.25], [COL.x1 - 2, by + PLAN.balconyOver, FH * k + 1.2], [COL.x0 + 2, by + PLAN.balconyOver, FH * k + 1.2]], 'rail', 'balcony');
        }
      }
    }
    // roof room on the top apartment, part of the 160
    if (g >= 1) h += box(COL.x0 + 1, COL.x1 - 1, B.y0 + 3, B.y1, top, top + FH, 'm-roof', 'roof area');

    // rear setback plane, in front of the addition
    h += poly([[0, rear, 0], [PLOT.x, rear, 0], [PLOT.x, rear, top + 2], [0, rear, top + 2]], 'plane', 'side');

    // dimensions on the ground
    h += line([PLOT.x + 1.2, rear, 0], [PLOT.x + 1.2, PLOT.y, 0], 'dim', 'side');
    h += line([PLOT.x + 0.6, rear, 0], [PLOT.x + 1.8, rear, 0], 'dim', 'side');
    h += line([PLOT.x + 0.6, PLOT.y, 0], [PLOT.x + 1.8, PLOT.y, 0], 'dim', 'side');
    h += line([sx, -1.2, 0], [PLOT.x, -1.2, 0], 'dim', 'side');

    // labels
    h += label(PLOT.x + 3.4, (rear + PLOT.y) / 2 + 2.4, 0, '<tspan class="gn">' + s + ' מ\'</tspan>', 'side', 'gl-dim');
    h += label((sx + PLOT.x) / 2 + 1.5, -3.2, 0, '<tspan class="gn">' + s + ' מ\'</tspan>', 'side', 'gl-dim');
    h += label(5, rear, top + 2.6, 'קו אחורי <tspan class="gn">' + s + ' מ\'</tspan>', 'side');
    h += label(sx, 3, top + 2.6, 'קו צידי <tspan class="gn">' + s + ' מ\'</tspan>', 'side');
    if (d > 0.05 && g >= 1) {
      h += label((COL.x0 + COL.x1) / 2 + 4, B.y1 + d + 4, FH * 0 + 0.6, 'תוספת עד <tspan class="gn">' + add + ' מ"ר</tspan>', 'area', 'gl-add');
      h += label(COL.x0 - 4, B.y1 + d + PLAN.balconyOver + 3, FH * N - 1, 'מרפסת <tspan class="gn">12</tspan> + סוכה <tspan class="gn">5</tspan>', 'balcony', 'gl-bal');
    }
    if (g >= 1) h += label((COL.x0 + COL.x1) / 2 - 1.5, B.y0 + 3, top + FH + 1.4, 'גג עד <tspan class="gn">60 מ"ר</tspan>', 'roof');
    return h;
  }

  // Fixed view box (tallest case), so switching the building height does not jump.
  function viewBox() {
    var xs = [], ys = [];
    [[-3, -6, 0], [PLOT.x + 4, -6, 0], [-3, 34, 0], [PLOT.x + 4, 34, 0], [0, 0, FH * 8 + 4], [PLOT.x, 0, FH * 8 + 4], [0, PLOT.y, FH * 8]].forEach(function (p) {
      var q = P(p[0], p[1], p[2]); xs.push(q[0]); ys.push(q[1]);
    });
    var x0 = Math.min.apply(null, xs) - 2, y0 = Math.min.apply(null, ys) - 2;
    return [x0, y0, Math.max.apply(null, xs) - x0 + 2, Math.max.apply(null, ys) - y0 + 2].map(function (v) { return v.toFixed(1); }).join(' ');
  }

  function fmtSpan(from, to) {
    var m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (m <= 0) return null;
    var y = Math.floor(m / 12), r = m % 12;
    var ys = y === 1 ? 'שנה' : y + ' שנים', rs = r === 1 ? 'חודש' : r + ' חודשים';
    return y && r ? ys + ' ו-' + rs : (y ? ys : rs);
  }

  function rulesHtml() {
    return RULES.map(function (r) {
      return '<li><button type="button" class="grow-rule" data-governs="' + r.part + '" aria-pressed="false">' +
        '<span class="gr-label">' + r.label + '</span>' +
        '<strong class="gr-value">' + r.value + '</strong>' +
        '<span class="gr-meaning">' + r.meaning + '</span></button></li>';
    }).join('');
  }

  function validityHtml() {
    var now = new Date();
    var total = PLAN.validTo - PLAN.validFrom;
    var pct = Math.max(0, Math.min(100, (now - PLAN.validFrom) / total * 100));
    var left = fmtSpan(now, PLAN.validTo);
    return '<div class="grow-valid" data-part="validity">' +
      '<div class="gv-bar" role="img" aria-label="תוקף התוכנית מ-11/2024 עד 11/2034"><span class="gv-used" style="width:' + pct.toFixed(1) + '%"></span><span class="gv-now" style="inset-inline-start:' + pct.toFixed(1) + '%"></span></div>' +
      '<div class="gv-ends"><span class="gv-end">11/2024</span><span class="gv-end">11/2034</span></div>' +
      '<p class="gv-text">' + (left
        ? 'נשארו <strong>' + left + '</strong> להוצאת היתר.<br><span>אחרי 11/2034 התוכנית פוקעת, והמצב חוזר לתוכניות הקודמות.</span>'
        : '<strong>תוקף התוכנית הסתיים.</strong><br><span>זכויות ההרחבה לפיה כבר לא קיימות.</span>') + '</p></div>';
  }

  function build(host, compact) {
    var st = { floors: 4, today: 90 };
    host._grow = st;
    host.setAttribute('data-grow', '');
    host.innerHTML =
      '<div class="grow-stage">' +
        '<div class="grow-controls">' +
          '<div class="grow-seg" role="group" aria-label="גובה הבניין">' +
            '<span class="gc-label">גובה הבניין</span>' +
            '<button type="button" class="grow-chip" data-floors="4" aria-pressed="true">עד 4 קומות</button>' +
            '<button type="button" class="grow-chip" data-floors="6" aria-pressed="false">מעל 4 קומות</button>' +
          '</div>' +
          (compact ? '' :
          '<label class="grow-range"><span class="gc-label">שטח הדירה היום</span>' +
            '<input type="range" min="40" max="160" step="5" value="90" aria-describedby="growAddText">' +
            '<output class="gc-out">90 מ"ר</output></label>') +
        '</div>' +
        '<svg class="grow-svg" viewBox="' + viewBox() + '" role="img" aria-label="שרטוט אקסונומטרי: בניין קיים, התוספת המותרת וקווי הבניין"></svg>' +
        (compact ? '' : '<p class="grow-add" id="growAddText" aria-live="polite"></p>') +
        '<ul class="grow-legend" aria-label="מקרא">' +
          '<li><i class="lg lg-exist"></i>בניין קיים</li>' +
          '<li><i class="lg lg-add"></i>תוספת מותרת</li>' +
          '<li><i class="lg lg-bal"></i>מרפסת וסוכה</li>' +
          '<li><i class="lg lg-plane"></i>קו בניין, אסור לעבור</li>' +
        '</ul>' +
        (compact ? '' : validityHtml()) +
      '</div>' +
      (compact ? '' : '<ol class="grow-rules" aria-label="כללי התוכנית">' + rulesHtml() + '</ol>');

    var svg = host.querySelector('.grow-svg');
    function draw(g) { svg.innerHTML = scene(st, g); applyActive(host); }
    function addText() {
      var el = host.querySelector('.grow-add');
      if (!el) return;
      var add = PLAN.maxArea - st.today;
      el.innerHTML = add > 0
        ? 'אפשר להוסיף עד <strong>' + add + ' מ"ר</strong> לדירה.<br><span>כך היא מגיעה ל-160 מ"ר. מרפסת 12 מ"ר וסוכה 5 מ"ר נוספות מעל זה. עומק התוספת בשרטוט להמחשה.</span>'
        : '<strong>הדירה כבר בשטח המרבי.</strong><br><span>לפי התוכנית אין תוספת שטח מעבר ל-160 מ"ר.</span>';
      var out = host.querySelector('.gc-out');
      if (out) out.textContent = st.today + ' מ"ר';
    }
    function fit() {
      if (host._fitW === host.clientWidth) return;
      var keep = st.floors; st.floors = 6; draw(1);
      var bb = svg.getBBox(); st.floors = keep;
      if (!bb.width) return;
      host._fitW = host.clientWidth;
      svg.setAttribute('viewBox', [bb.x - 1, bb.y - 1, bb.width + 2, bb.height + 2].map(function (v) { return v.toFixed(1); }).join(' '));
    }
    window.addEventListener('resize', function () { if (host.clientWidth) { fit(); draw(1); } });
    function grow() {
      fit();
      if (reduce) { draw(1); return; }
      var t0 = performance.now(), dur = 1400;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        draw(1 - Math.pow(1 - k, 3));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }
    host._grow.grow = grow;

    host.querySelectorAll('.grow-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        st.floors = Number(b.getAttribute('data-floors'));
        host.querySelectorAll('.grow-chip').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        draw(1);
      });
    });
    var range = host.querySelector('input[type="range"]');
    if (range) range.addEventListener('input', function () { st.today = Number(range.value); addText(); draw(1); });
    addText();
    draw(0);
    return host;
  }

  // ===== highlight =====
  function hostFor(el) {
    var page = el.closest('.page') || document;
    return page.querySelector('[data-grow]');
  }
  function applyActive(host) {
    var parts = (host._hover || host._pin || '').split(' ').filter(Boolean);
    host.classList.toggle('has-active', parts.length > 0);
    host.querySelectorAll('[data-part]').forEach(function (n) {
      var mine = n.getAttribute('data-part').split(' ');
      n.classList.toggle('on', parts.some(function (p) { return mine.indexOf(p) !== -1; }));
    });
    host.setAttribute('data-active', parts.join(' '));
    var page = host.closest('.page') || document;
    page.querySelectorAll('[data-governs]').forEach(function (n) {
      var on = n.getAttribute('data-governs') === (host._pin || '');
      n.classList.toggle('governs-on', on);
      if (n.tagName === 'BUTTON') n.setAttribute('aria-pressed', String(on));
    });
  }

  function wire() {
    Object.keys(LINKS).forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.setAttribute('data-governs', LINKS[sel]);
        el.classList.add('governs');
        if (!el.title) el.title = 'מדגיש בשרטוט "הבית שגדל" את החלק שהכלל קובע';
      });
    });
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('[data-governs]');
      if (!t) return;
      var host = hostFor(t); if (!host) return;
      host._hover = t.getAttribute('data-governs'); applyActive(host);
    });
    document.addEventListener('mouseout', function (e) {
      var t = e.target.closest && e.target.closest('[data-governs]');
      if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
      var host = hostFor(t); if (!host) return;
      host._hover = ''; applyActive(host);
    });
    document.addEventListener('focusin', function (e) {
      var t = e.target.closest && e.target.closest('[data-governs]');
      if (!t) return;
      var host = hostFor(t); if (!host) return;
      host._hover = t.getAttribute('data-governs'); applyActive(host);
    });
    document.addEventListener('focusout', function (e) {
      var t = e.target.closest && e.target.closest('[data-governs]');
      if (!t) return;
      var host = hostFor(t); if (!host) return;
      host._hover = ''; applyActive(host);
    });
    // click selects (and keeps) the rule; touch screens have no hover
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-governs]');
      if (!t || document.body.classList.contains('editable-active')) return;
      if (t.tagName !== 'BUTTON' && e.target.closest('input,label,a')) return;
      var host = hostFor(t); if (!host) return;
      var g = t.getAttribute('data-governs');
      host._pin = host._pin === g ? '' : g;
      host._hover = '';
      applyActive(host);
    });
  }

  function init() {
    var main = document.getElementById('growHouse');
    var mini = document.getElementById('growHouseMini');
    if (main) build(main, false);
    if (mini) build(mini, true);
    wire();
    // grow when the page opens
    var seen = new WeakSet();
    function check() {
      [main, mini].forEach(function (h) {
        if (!h) return;
        var page = h.closest('.page');
        var visible = page && page.classList.contains('active');
        if (visible && !seen.has(h)) { seen.add(h); h._grow.grow(); }
        if (!visible) seen.delete(h);
      });
    }
    var pc = document.getElementById('pagesContainer');
    if (pc && window.MutationObserver) new MutationObserver(check).observe(pc, { attributes: true, subtree: true, attributeFilter: ['class'] });
    check();
  }

  window.growHouse = { PLAN: PLAN, RULES: RULES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
