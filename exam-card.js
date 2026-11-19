/* كرت عدّاد الامتحانات (تاسع + بكالوريا): يُرسم على canvas بدقة 1536×1024
   ونفس الرسم يُعرض في الصفحة ويُشارَك كصورة PNG. */
(() => {
  'use strict';
  const W = 1536, H = 1024;
  const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.nabdaltawafuq.app';
  const GREEN = '#0b6a3b', GREEN_DARK = '#07502c', GOLD = '#c9a24a', GOLD_LIGHT = '#ecd48c';
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const EXAMS = {
    bac: { tab: 'بكالوريا', name: 'البكالوريا', title: 'امتحانات البكالوريا', fallback: '2027-06-05T08:00:00' },
    nine: { tab: 'تاسع', name: 'التاسع', title: 'امتحانات التاسع', fallback: '2027-06-02T08:00:00' }
  };
  const FONT = '"Cairo","Readex Pro",system-ui,sans-serif';
  const $ = (s, r = document) => r.querySelector(s);
  const toast = msg => { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); };

  const canvas = $('#xcCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let active = 'bac';
  try { const saved = localStorage.getItem('nabd_exam_card_tab'); if (EXAMS[saved]) active = saved; } catch { /* تجاهل */ }

  const emblem = new Image();
  let emblemReady = false;
  emblem.onload = () => { emblemReady = true; draw(); };
  emblem.src = 'assets/exam-card/emblem.webp';

  function serverDates() { try { return JSON.parse(localStorage.getItem('nabd_exam_dates') || '{}') || {}; } catch { return {}; } }
  function examInfo(key) {
    const set = Date.parse(serverDates()[key]);
    const official = Number.isFinite(set);
    const target = official ? set : new Date(EXAMS[key].fallback).getTime();
    return { ...EXAMS[key], target, official };
  }

  /* ---------- أدوات الرسم ---------- */
  const P = s => new Path2D(s);
  const CAP = { board: P('M50 6 L99 27 L50 48 L1 27 Z'), body: P('M23 38 V58 C23 69 77 69 77 58 V38 L50 50 Z'), tassel: P('M91 29 V60 M87 60 H95 L97 74 H85 Z') };
  const BOOK = P('M50 14 C34 3 14 3 2 10 V58 C14 51 34 51 50 62 C66 51 86 51 98 58 V10 C86 3 66 3 50 14 Z M50 14 V62');

  function cap(x, y, w, color) {
    ctx.save(); ctx.translate(x, y); const k = w / 100; ctx.scale(k, k);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.fill(CAP.board); ctx.fill(CAP.body);
    ctx.stroke(P('M91 29 V60')); ctx.fill(P('M86 60 H96 L98 76 H84 Z'));
    ctx.restore();
  }
  function book(x, y, w, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180); const k = w / 100; ctx.scale(k, k);
    ctx.strokeStyle = 'rgba(11,106,59,.13)'; ctx.lineWidth = 2.2 / k * 1.6; ctx.lineJoin = 'round';
    ctx.stroke(BOOK); ctx.translate(5, 5); ctx.stroke(BOOK);
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function text(str, x, y, size, color, weight = 800) {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  let bg = null;
  function paintBackground() {
    if (bg) return bg;
    bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const c = bg.getContext('2d'); const prev = ctx;
    // نرسم على لوحة جانبية بتبديل السياق مؤقتاً
    const draw0 = (fn) => fn(c);
    draw0(c => {
      const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#eef5f0');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // الزوايا الخضراء مع الخطوط الذهبية
      const ribbon = (fillPath, goldPaths) => {
        const gg = c.createLinearGradient(0, 0, W, H); gg.addColorStop(0, GREEN_DARK); gg.addColorStop(1, GREEN);
        c.fillStyle = gg; c.fill(P(fillPath));
        goldPaths.forEach(([d, w]) => { const g2 = c.createLinearGradient(0, 0, 700, 0); g2.addColorStop(0, GOLD); g2.addColorStop(.5, GOLD_LIGHT); g2.addColorStop(1, GOLD); c.strokeStyle = g2; c.lineWidth = w; c.lineCap = 'round'; c.stroke(P(d)); });
      };
      const tl = () => ribbon('M0 0 H560 C380 30 190 90 0 200 Z', [['M0 242 C90 172 260 96 440 52 C500 38 560 20 622 0', 6], ['M0 224 C80 158 250 82 430 38 C490 24 545 10 592 0', 2.5]]);
      tl();
      c.save(); c.translate(W, H); c.scale(-1.25, -1.25); tl(); c.restore();
      ribbon('M0 988 C190 1012 360 1024 520 1024 H0 Z', [['M0 962 C170 990 330 1010 480 1018', 5]]);
    });
    return bg;
  }

  /* ---------- رسم الكرت ---------- */
  function draw(now = Date.now()) {
    const info = examInfo(active);
    const diff = Math.max(0, info.target - now);
    const parts = { d: Math.floor(diff / 864e5), h: Math.floor(diff % 864e5 / 36e5), m: Math.floor(diff % 36e5 / 6e4), s: Math.floor(diff % 6e4 / 1e3) };

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(paintBackground(), 0, 0);
    // الكتب الباهتة والقبعات
    [[18, 262, 235, -8], [1300, 262, 236, 6], [-6, 560, 190, 4], [1385, 590, 160, 0], [-6, 800, 190, -6], [1340, 790, 200, 0]].forEach(([x, y, w, r]) => book(x, y, w, r));
    cap(176, 118, 165, GREEN); cap(1252, 52, 182, GREEN);

    // الشعار
    ctx.save(); ctx.shadowColor = 'rgba(8,60,34,.28)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.beginPath(); ctx.arc(775, 160, 140, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    if (emblemReady) ctx.drawImage(emblem, 635, 20, 280, 280);

    // العنوان
    text('العدد التنازلي لامتحانات', 768, 392, 88, GREEN);
    text(`${info.name} (دورة ${new Date(info.target).getFullYear()})`, 768, 486, 88, GREEN);
    const dt = new Date(info.target);
    text(`${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`, 768, 556, 54, GREEN);
    if (!info.official) text('(هذا وقت تقريبي، الموعد الرسمي لم يحدد بعد)', 768, 603, 31, '#1f6f49', 600);
    else text('(الموعد المعتمد من إدارة المنصة)', 768, 603, 31, '#1f6f49', 600);

    // الدوائر
    const cells = [[1193, parts.s, 'الثواني', 2], [909, parts.m, 'الدقائق', 2], [622, parts.h, 'الساعات', 2], [339, parts.d, 'الأيام', 3]];
    cells.forEach(([x, v, label, len]) => {
      ctx.beginPath(); ctx.arc(x, 722, 92, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
      ctx.lineWidth = 9; ctx.strokeStyle = GREEN; ctx.stroke();
      text(String(v).padStart(len > 2 && v > 99 ? 3 : 2, '0'), x, 750, 84, GREEN, 800);
      text(label, x, 862, 41, GREEN, 700);
    });

    // الشريط السفلي
    const g = ctx.createLinearGradient(0, 905, 0, 990); g.addColorStop(0, '#fffdf4'); g.addColorStop(1, '#f6ecc9');
    roundRect(455, 906, 626, 84, 42); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke();
    text('منصة نبض التفوق التعليمية', 840, 962, 38, '#14402b', 800);
    cap(497, 925, 78, '#14402b');
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(290, 948); ctx.lineTo(442, 948); ctx.moveTo(1094, 948); ctx.lineTo(1236, 948); ctx.stroke();

    canvas.setAttribute('aria-label', `العدد التنازلي لامتحانات ${info.name}: ${parts.d} يوم و${parts.h} ساعة و${parts.m} دقيقة و${parts.s} ثانية`);
  }

  /* ---------- التبويبات ---------- */
  function setTab(key) {
    if (!EXAMS[key]) return;
    active = key;
    try { localStorage.setItem('nabd_exam_card_tab', key); } catch { /* تجاهل */ }
    document.querySelectorAll('.xc-tab').forEach(b => { const on = b.dataset.exam === key; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    draw();
  }
  document.querySelectorAll('.xc-tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.exam)));

  /* ---------- المشاركة ---------- */
  function shareText(info) {
    return `أستعد لامتحانات ${info.name} (دورة ${new Date(info.target).getFullYear()}) مع تطبيق «نبض التفوق» 🎓\n\n` +
      'منصة تعليمية لطلاب التاسع والبكالوريا: عدّادات تنازلية للامتحانات، متابعة المهام الدراسية، أخبار تعليمية، ودردشة بين الطلاب في مكان واحد.\n\n' +
      `حمّل التطبيق من متجر Google Play:\n${PLAY_URL}`;
  }
  async function renderBlob() {
    try { await document.fonts.load(`800 40px ${FONT}`); await document.fonts.ready; } catch { /* تجاهل */ }
    draw();
    return await new Promise(res => canvas.toBlob(res, 'image/png'));
  }
  const cap_ = n => window.Capacitor?.Plugins?.[n] || null;
  const isNative = () => Boolean(window.Capacitor?.isNativePlatform?.()) || Boolean(window.NabdAndroid);
  const toDataUrl = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  function download(blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nabd-exam-countdown.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  async function share(saveOnly) {
    window.nabdPoints?.award('exam_share');
    const btn = saveOnly ? $('#xcSave') : $('#xcShare');
    const info = examInfo(active); const title = `عداد امتحانات ${info.name}`; const text = shareText(info);
    const label = btn.querySelector('span').textContent; btn.disabled = true; btn.querySelector('span').textContent = 'جارٍ تجهيز الصورة...';
    try {
      const blob = await renderBlob(); if (!blob) throw new Error('blob');
      const file = new File([blob], 'nabd-exam-countdown.png', { type: 'image/png' });
      if (saveOnly) { download(blob); toast('تم حفظ صورة الكرت.'); return; }
      const dataUrl = await toDataUrl(blob);
      const nativeShare = cap_('Share'), fs = cap_('Filesystem');
      if (window.NabdAndroid?.shareImage) { await window.NabdAndroid.shareImage(dataUrl, title, text); return; }
      if (isNative() && nativeShare?.share && fs?.writeFile) {
        const saved = await fs.writeFile({ path: `nabd-exam-${Date.now()}.png`, data: dataUrl.split(',')[1], directory: 'CACHE', recursive: true });
        if (saved?.uri) { await nativeShare.share({ title, text, files: [saved.uri], dialogTitle: 'مشاركة كرت العداد' }); return; }
      }
      if (navigator.canShare?.({ files: [file] }) && navigator.share) { await navigator.share({ title, text, files: [file] }); return; }
      download(blob);
      try { await navigator.clipboard?.writeText(text); toast('تم حفظ الصورة ونسخ النص ورابط التحميل للمشاركة.'); } catch { toast('تم حفظ الصورة.'); }
    } catch (error) {
      if (error?.name !== 'AbortError') toast('تعذر تجهيز الصورة الآن.');
    } finally { btn.disabled = false; btn.querySelector('span').textContent = label; }
  }
  $('#xcShare')?.addEventListener('click', () => { void share(false); });
  $('#xcSave')?.addEventListener('click', () => { void share(true); });

  /* ---------- تحديث المواعيد من الخادم ---------- */
  (async () => {
    try {
      const url = window.NABD_SUPABASE_URL, anon = window.NABD_SUPABASE_ANON_KEY; if (!url || !anon) return;
      const r = await fetch(`${url}/rest/v1/rpc/get_exam_dates`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) return; const rows = await r.json(); if (!Array.isArray(rows)) return;
      const map = {}; rows.forEach(row => { if (row?.key && row?.target) map[row.key] = row.target; });
      localStorage.setItem('nabd_exam_dates', JSON.stringify(map)); localStorage.setItem('nabd_exam_dates_at', String(Date.now())); draw();
    } catch { /* تجاهل */ }
  })();

  setTab(active);
  if (document.fonts?.load) document.fonts.load(`800 40px ${FONT}`).then(() => draw()).catch(() => {});
  let timer = setInterval(() => { if (!document.hidden) draw(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) draw(); });
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
})();
