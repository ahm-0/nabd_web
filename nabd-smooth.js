/* Nabd Smooth — تنقل فوري بين الأقسام بدلاً من إعادة التحميل البطيئة.
   1) يجلب الصفحات المرجّحة مسبقاً (Speculation Rules) فيصبح الانتقال شبه لحظي.
   2) يعتمد على View Transitions في nabd-pro.css للانتقال البصري السلس.
   لا يمنع أي نقر ولا يؤخره. */
(() => {
  'use strict';

  const CORE_PAGES = ['index.html', 'chat.html', 'news.html', 'profile.html', 'exam-countdown.html'];
  const MAX_URLS = 4;

  // مواعيد الامتحانات المحدّثة من لوحة الإشراف: تُجلب وتُخزَّن لتقرأها الصفحات عند فتحها
  try {
    const last = Number(localStorage.getItem('nabd_exam_dates_at') || 0);
    const url = window.NABD_SUPABASE_URL, anon = window.NABD_SUPABASE_ANON_KEY;
    if (url && anon && Date.now() - last > 30 * 60 * 1000) {
      localStorage.setItem('nabd_exam_dates_at', String(Date.now()));
      fetch(`${url}/rest/v1/rpc/get_exam_dates`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => (r.ok ? r.json() : []))
        .then(rows => { if (Array.isArray(rows)) { const map = {}; rows.forEach(row => { if (row?.key && row?.target) map[row.key] = row.target; }); localStorage.setItem('nabd_exam_dates', JSON.stringify(map)); } })
        .catch(() => {});
    }
  } catch { /* تجاهل */ }
  const connection = navigator.connection || {};
  const saveData = connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType || '');
  if (saveData) return; // لا نستهلك بيانات المستخدم على الشبكات الضعيفة

  const here = location.pathname.split('/').pop() || 'index.html';
  const toURL = href => {
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin || !/\.html$/i.test(url.pathname)) return null;
      url.hash = '';
      return url.href;
    } catch { return null; }
  };

  const collect = () => {
    const found = new Set();
    CORE_PAGES.forEach(page => { if (page !== here) { const u = toURL(page); if (u) found.add(u); } });
    document.querySelectorAll('a[href$=".html"]').forEach(a => {
      if (found.size >= MAX_URLS) return;
      const u = toURL(a.getAttribute('href'));
      if (u && u !== toURL(here)) found.add(u);
    });
    return [...found].slice(0, MAX_URLS);
  };

  const installSpeculation = () => {
    if (document.getElementById('nabd-speculation')) return;
    const nav = [...document.querySelectorAll('#bottomNav a[href$=".html"]')]
      .map(a => toURL(a.getAttribute('href'))).filter(u => u && u !== toURL(here));
    const navSet = new Set(nav);
    const rest = [];
    if (!nav.length && !rest.length) return;
    if (HTMLScriptElement.supports?.('speculationrules')) {
      // صفحات الشريط السفلي: تُحمَّل كاملة في الخلفية عند أول لمس، فيصبح الانتقال لحظياً
      // صفحة "حسابي" تُجهَّز فوراً (eager) لأنها الأثقل، والبقية عند اللمس.
      // لا prerender: تشغيل صفحات كاملة بالخلفية كان يثقل الجهاز ويسبب بطء الانتقال. نكتفي بجلب HTML مسبقاً لصفحات الشريط السفلي.
      const rules = { prefetch: nav.length ? [{ source: 'list', urls: nav, eagerness: 'moderate' }] : [] };
      const script = document.createElement('script');
      script.type = 'speculationrules';
      script.id = 'nabd-speculation';
      script.textContent = JSON.stringify(rules);
      document.head.appendChild(script);
    } else {
      [...nav, ...rest].slice(0, 5).forEach(href => {
        const link = document.createElement('link');
        link.rel = 'prefetch'; link.as = 'document'; link.href = href;
        document.head.appendChild(link);
      });
    }
  };

  // نبدأ عند جاهزية الـDOM (لا بعد تحميل كل الموارد) حتى تبدأ الجلب المسبق مبكراً.
  const start = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(installSpeculation, { timeout: 300 });
    else setTimeout(installSpeculation, 150);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  // استعادة الصفحة فوراً عند الرجوع (bfcache) دون وميض
  window.addEventListener('pageshow', event => {
    if (event.persisted) document.body?.classList.remove('md-page-leaving');
  });
})();
