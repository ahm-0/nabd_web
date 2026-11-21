/* عدّادات الرسائل غير المقروءة على زرّي الأخبار والدردشة (مثل واتساب) */
(() => {
  'use strict';
  const NK = 'nabd_news_seen', CK = 'nabd_chat_seen';
  const get = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } };
  let counts = { news: 0, chat: 0 }, busy = false;
  const page = () => document.body?.dataset.page || '';
  const fmt = n => (n > 99 ? '99+' : String(n));
  function paint() {
    const targets = { news: 'a[href="news.html"]', chat: 'a[href="chat.html"]' };
    Object.keys(targets).forEach(key => {
      document.querySelectorAll(`#bottomNav ${targets[key]}`).forEach(link => {
        if (key === 'chat' && page() === 'chat') return; // صفحة الدردشة لها عدّادها الخاص
        let b = link.querySelector(':scope > .nb-badge');
        const n = counts[key];
        if (!n) { b?.remove(); return; }
        if (!b) { b = document.createElement('b'); b.className = 'nb-badge'; link.appendChild(b); }
        if (b.textContent !== fmt(n)) b.textContent = fmt(n);
      });
    });
  }
  async function refresh() {
    if (busy || document.hidden) return; const c = window.nabdSupabase; if (!c) return;
    busy = true;
    try {
      const { data: s } = await c.auth.getSession(); if (!s?.session) return;
      const now = new Date().toISOString();
      if (!get(NK)) set(NK, now);
      if (!get(CK)) set(CK, now);
      const { data, error } = await c.rpc('nabd_unread_counts', { p_news_since: get(NK), p_chat_since: get(CK) });
      if (error) return;
      const r = Array.isArray(data) ? data[0] : data; if (!r) return;
      counts = { news: page() === 'news' ? 0 : Number(r.news) || 0, chat: Number(r.chat_public || 0) + Number(r.chat_private || 0) };
      paint();
      if (page() !== 'news' && !sessionStorage.getItem('nabd_news_pre')) { sessionStorage.setItem('nabd_news_pre', '1'); const nr = await c.rpc('news_list_posts', { p_limit: 40 }); if (!nr.error && Array.isArray(nr.data)) { const raw = JSON.stringify(nr.data); if (raw.length < 350000) localStorage.setItem('nabd_news_raw', raw); } }
    } catch { /* تجاهل */ } finally { busy = false; }
  }
  window.nabdBadges = {
    refresh,
    clear(key) { counts[key] = 0; paint(); },
    seenNews(iso) { set(NK, iso || new Date().toISOString()); counts.news = 0; paint(); },
    seenChat(iso) { set(CK, iso || new Date().toISOString()); paint(); }
  };
  const start = () => {
    const nav = document.getElementById('bottomNav');
    if (nav) new MutationObserver(paint).observe(nav, { childList: true });
    setTimeout(refresh, 1800);
    setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  const st = document.createElement('style');
  st.textContent = '#bottomNav a,#bottomNav .bottom-link{position:relative}.nb-badge{position:absolute;top:2px;inset-inline-start:calc(50% + 4px);min-width:18px;height:18px;padding:0 5px;border-radius:99px;font:800 10.5px/18px Cairo,system-ui,sans-serif;text-align:center;color:#fff;background:#25d366;box-shadow:0 0 0 2px var(--panel,#fff);pointer-events:none}';
  document.head.appendChild(st);
})();
