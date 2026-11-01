/* Lightweight navigation accelerator for the static GitHub Pages app. */
(() => {
  'use strict';
  const prefetched = new Set();
  const isInternalPage = (href) => {
    try {
      const url = new URL(href, location.href);
      return url.origin === location.origin && url.pathname.endsWith('.html');
    } catch { return false; }
  };
  const prefetch = (href) => {
    if (!isInternalPage(href) || prefetched.has(href)) return;
    prefetched.add(href);
    const link = document.createElement('link');
    link.rel = 'prefetch'; link.as = 'document'; link.href = href;
    document.head.appendChild(link);
  };
  const warm = () => {
    document.querySelectorAll('a[href]').forEach((a) => {
      a.addEventListener('pointerenter', () => prefetch(a.href), { once: true, passive: true });
      a.addEventListener('touchstart', () => prefetch(a.href), { once: true, passive: true });
    });
    ['index.html','chat.html','news.html','profile.html','exam-countdown.html'].forEach((page) => {
      if (!location.pathname.endsWith(`/${page}`) && !location.pathname.endsWith(page)) prefetch(new URL(page, location.href).href);
    });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 1200 });
  else window.setTimeout(warm, 350);
})();
