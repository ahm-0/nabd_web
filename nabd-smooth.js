/* Nabd Smooth — تنقل فوري بين الأقسام بدلاً من إعادة التحميل البطيئة.
   1) يجلب الصفحات المرجّحة مسبقاً (Speculation Rules) فيصبح الانتقال شبه لحظي.
   2) يعتمد على View Transitions في nabd-pro.css للانتقال البصري السلس.
   لا يمنع أي نقر ولا يؤخره. */
(() => {
  'use strict';

  const CORE_PAGES = ['index.html', 'chat.html', 'news.html', 'profile.html', 'exam-countdown.html'];
  const MAX_URLS = 14;
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
    const rest = collect().filter(u => !navSet.has(u));
    if (!nav.length && !rest.length) return;
    if (HTMLScriptElement.supports?.('speculationrules')) {
      // صفحات الشريط السفلي: تُحمَّل كاملة في الخلفية عند أول لمس، فيصبح الانتقال لحظياً
      const rules = {
        prerender: nav.length ? [{ source: 'list', urls: nav, eagerness: 'conservative' }] : [],
        prefetch: rest.length ? [{ source: 'list', urls: rest, eagerness: 'moderate' }] : []
      };
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

  const start = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(installSpeculation, { timeout: 1500 });
    else setTimeout(installSpeculation, 600);
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });

  // استعادة الصفحة فوراً عند الرجوع (bfcache) دون وميض
  window.addEventListener('pageshow', event => {
    if (event.persisted) document.body?.classList.remove('md-page-leaving');
  });
})();
