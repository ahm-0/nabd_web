/* عدّادات الرسائل غير المقروءة على زرّي الأخبار والدردشة (مثل واتساب) — حالة القراءة محفوظة في قاعدة البيانات لكل مستخدم وتتحدث لحظياً */
(() => {
  'use strict';
  const NK = 'nabd_news_seen', CK = 'nabd_chat_seen', UK = 'nabd_seen_uid';
  const get = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } };
  let counts = { news: 0, chat: 0, chatPublic: 0, chatPrivate: 0 }, busy = false, uid = null, chan = null, timer = null;
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
  const client = () => window.nabdSupabase;
  async function session() { const c = client(); if (!c) return null; const { data } = await c.auth.getSession(); return data?.session || null; }
  /* قراءة العدّادات من الخادم (المصدر الوحيد للحقيقة) */
  async function refresh() {
    if (busy || document.hidden) return; const c = client(); if (!c) return;
    busy = true;
    try {
      const s = await session(); if (!s) return;
      if (uid !== s.user.id) { uid = s.user.id; if (get(UK) !== uid) { set(UK, uid); try { localStorage.removeItem(NK); localStorage.removeItem(CK); } catch { /* تجاهل */ } } startRealtime(); }
      const { data, error } = await c.rpc('nabd_unread_counts_v2'); if (error) return;
      const r = Array.isArray(data) ? data[0] : data; if (!r) return;
      /* مرآة محلية لوقت آخر قراءة (يستعملها فاصل «رسائل غير مقروءة» دون انتظار الشبكة) */
      if (r.news_since && (!get(NK) || r.news_since > get(NK))) set(NK, r.news_since);
      if (r.chat_since && (!get(CK) || r.chat_since > get(CK))) set(CK, r.chat_since);
      counts.news = page() === 'news' ? 0 : Number(r.news) || 0;
      counts.chatPublic = Number(r.chat_public) || 0; counts.chatPrivate = Number(r.chat_private) || 0;
      counts.chat = counts.chatPublic + counts.chatPrivate;
      paint();
      if (page() !== 'news' && !sessionStorage.getItem('nabd_news_pre')) { sessionStorage.setItem('nabd_news_pre', '1'); const nr = await c.rpc('news_list_posts', { p_limit: 40 }); if (!nr.error && Array.isArray(nr.data)) { try { localStorage.setItem('nabd_news_raw', JSON.stringify(nr.data)); } catch { /* تجاهل */ } } }
    } catch { /* تجاهل */ } finally { busy = false; }
  }
  const soon = (ms = 350) => { clearTimeout(timer); timer = setTimeout(refresh, ms); };
  /* تحديث لحظي: يزيد العدّاد فوراً ثم يصحّحه من الخادم */
  function startRealtime() {
    const c = client(); if (!c || chan || !uid) return;
    try {
      chan = c.channel('nabd-badges-' + uid)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_posts' }, p => { if (p.new?.author_id !== uid && p.new?.is_published !== false && page() !== 'news') { counts.news += 1; paint(); } soon(); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'public_chat_messages' }, p => { if (p.new?.sender_id !== uid && page() !== 'chat') { counts.chatPublic += 1; counts.chat += 1; paint(); } soon(); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_chat_messages' }, p => { if (p.new?.sender_id !== uid && page() !== 'chat') { counts.chatPrivate += 1; counts.chat += 1; paint(); } soon(); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'private_chat_messages' }, () => soon(200))
        .subscribe(status => { if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { try { c.removeChannel(chan); } catch { /* تجاهل */ } chan = null; setTimeout(startRealtime, 4000); } });
    } catch { chan = null; }
  }
  const markRead = (scope, iso) => { const c = client(); if (!c) return; Promise.resolve(c.rpc('read_state_set', { p_scope: scope, p_at: iso })).then(() => soon(150)).catch(() => {}); };
  window.nabdBadges = {
    refresh,
    clear(key) { counts[key] = 0; paint(); },
    /* آخر خبر ظهر فعلاً على الشاشة: يبقى ما بعده غير مقروء */
    seenNews(iso) { iso = iso || new Date().toISOString(); if (!get(NK) || iso > get(NK)) set(NK, iso); markRead('news', iso); counts.news = 0; paint(); },
    seenChat(iso) { iso = iso || new Date().toISOString(); if (!get(CK) || iso > get(CK)) set(CK, iso); markRead('chat_public', iso); paint(); },
    counts: () => ({ ...counts })
  };
  const start = () => {
    const nav = document.getElementById('bottomNav');
    if (nav) new MutationObserver(paint).observe(nav, { childList: true });
    setTimeout(refresh, 900);
    setInterval(refresh, 30000); /* شبكة أمان إن انقطع الاتصال اللحظي */
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('online', refresh);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  const st = document.createElement('style');
  st.textContent = '#bottomNav a,#bottomNav .bottom-link{position:relative}.nb-badge{position:absolute;top:2px;inset-inline-start:calc(50% + 4px);min-width:18px;height:18px;padding:0 5px;border-radius:99px;font:800 10.5px/18px Cairo,system-ui,sans-serif;text-align:center;color:#fff;background:#25d366;box-shadow:0 0 0 2px var(--panel,#fff);pointer-events:none}';
  document.head.appendChild(st);
})();
