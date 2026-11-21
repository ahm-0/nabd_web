/* منع لقطات الشاشة حسب القسم: السياسة تُحفظ في القاعدة ويحدّدها المطوّر/الأدمن من الإعدادات.
   - داخل تطبيق الأندرويد: يستدعي الجسر الأصلي (FLAG_SECURE) إن كان متاحاً.
   - على المتصفح: حجب المحتوى عند PrintScreen أو مغادرة الصفحة أو الطباعة (رادع وليس منعاً تاماً). */
(() => {
  'use strict';
  const KEY = 'nabd_screen_policy', AT = 'nabd_screen_policy_at';
  const SECTIONS = [
    ['home', 'الرئيسية', 'fa-house'], ['profile', 'الملف الشخصي', 'fa-user'], ['settings', 'الإعدادات', 'fa-gear'], ['chat', 'الدردشة', 'fa-comments'],
    ['news', 'الأخبار', 'fa-newspaper'], ['chat_once', 'منع الالتقاط عند فتح صورة لمرة واحدة', 'fa-eye-slash'], ['support', 'الدعم الفني', 'fa-headset'], ['premium', 'المحتوى المميز والمكتبة', 'fa-crown'], ['exam', 'عداد الامتحانات', 'fa-hourglass-half'], ['admin', 'بوابة المشرفين', 'fa-user-shield']
  ];
  const file = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/i, '');
  const SECTION_OF = { index: 'home', profile: 'profile', settings: 'settings', chat: 'chat', 'private-chat': 'chat', news: 'news', 'support-chat': 'support', premium: 'premium', library: 'premium', 'premium-admin': 'admin', 'exam-countdown': 'exam', 'admin-dashboard': 'admin', supervision: 'admin' };
  const section = SECTION_OF[file] || '';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const write = map => { try { localStorage.setItem(KEY, JSON.stringify(map)); localStorage.setItem(AT, String(Date.now())); } catch { /* تجاهل */ } };

  let wired = false, hideTimer = 0;
  const root = document.documentElement;
  function wire() {
    if (wired) return; wired = true;
    const st = document.createElement('style');
    st.textContent = 'html.np-shot-hide body{visibility:hidden!important}@media print{html[data-no-shot] body{display:none!important}}html[data-no-shot] img{-webkit-user-drag:none}';
    document.head.appendChild(st);
    const hide = ms => { root.classList.add('np-shot-hide'); clearTimeout(hideTimer); if (ms) hideTimer = setTimeout(() => root.classList.remove('np-shot-hide'), ms); };
    const show = () => { clearTimeout(hideTimer); root.classList.remove('np-shot-hide'); };
    document.addEventListener('keydown', e => { if (!root.hasAttribute('data-no-shot')) return; if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && /^[345s]$/i.test(e.key))) { hide(1800); try { navigator.clipboard?.writeText(''); } catch { /* تجاهل */ } } });
    document.addEventListener('visibilitychange', () => { if (!root.hasAttribute('data-no-shot')) return; document.hidden ? hide(0) : show(); });
    window.addEventListener('blur', () => { if (root.hasAttribute('data-no-shot')) hide(0); });
    window.addEventListener('focus', show);
  }
  function setNative(blocked) {
    try { window.NabdAndroid?.setSecureScreen?.(blocked); } catch { /* تجاهل */ }
    try { const p = window.Capacitor?.Plugins?.PrivacyScreen; if (p) (blocked ? p.enable?.() : p.disable?.()); } catch { /* تجاهل */ }
  }
  function apply() {
    const blocked = Boolean(section && read()[section]);
    root.toggleAttribute('data-no-shot', blocked);
    if (blocked) wire();
    setNative(blocked);
  }
  async function refresh(force) {
    const url = window.NABD_SUPABASE_URL, anon = window.NABD_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    if (!force && Date.now() - Number(localStorage.getItem(AT) || 0) < 10 * 60 * 1000) return;
    try {
      const r = await fetch(`${url}/rest/v1/rpc/get_screenshot_policy`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) return; const rows = await r.json(); if (!Array.isArray(rows)) return;
      const map = {}; rows.forEach(row => { if (row?.section) map[row.section] = Boolean(row.blocked); });
      write(map); apply();
    } catch { /* تجاهل */ }
  }
  async function set(client, key, blocked) {
    const { error } = await client.rpc('admin_set_screenshot_policy', { p_section: key, p_blocked: blocked });
    if (error) throw error;
    const map = read(); map[key] = blocked; write(map); apply();
  }

  window.NabdScreenGuard = { sections: SECTIONS, policy: read, refresh, set, apply };
  apply();
  const kick = () => { void refresh(false); };
  if (document.readyState === 'complete') setTimeout(kick, 600); else window.addEventListener('load', () => setTimeout(kick, 600), { once: true });
})();
