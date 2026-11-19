/* نقاط التفاعل + التحكم بسطوع التطبيق (يُحمَّل في كل الصفحات) */
(() => {
  'use strict';
  /* ---------- السطوع ---------- */
  const BKEY = 'nabd_brightness';
  const getB = () => { try { const v = parseInt(localStorage.getItem(BKEY), 10); return v >= 30 && v <= 100 ? v : 100; } catch { return 100; } };
  const applyB = v => {
    let d = document.getElementById('nabdDim');
    if (!d) { d = document.createElement('div'); d.id = 'nabdDim'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;background:#000;opacity:0'; (document.body || document.documentElement).appendChild(d); }
    d.style.opacity = ((100 - v) / 100).toFixed(2);
  };
  window.nabdBrightness = { get: getB, set(v) { v = Math.min(100, Math.max(30, Math.round(v))); try { localStorage.setItem(BKEY, String(v)); } catch {} applyB(v); } };
  applyB(getB());
  /* ---------- النقاط ---------- */
  const queue = new Set(); let busy = false;
  const award = async action => {
    const c = window.nabdSupabase; if (!c || !action) return 0;
    try {
      const { data: s } = await c.auth.getSession(); if (!s?.session) return -1;
      const { data } = await c.rpc('points_award', { p_action: action });
      const n = Number(data) || 0;
      return n;
    } catch { return 0; }
  };
  /* منح نقاط المشاركة فقط بعد إتمامها: يغادر المستخدم التطبيق إلى تطبيق المشاركة ثم يعود. الضغط على مشاركة ثم الرجوع دون اختيار تطبيق لا يمنح شيئًا. */
  function awardOnShareLeave(action) {
    let left = false, done = false; const t0 = Date.now();
    const onVis = () => {
      if (document.hidden) { left = true; return; }
      if (left && !done && Date.now() - t0 < 10 * 60 * 1000) { done = true; cleanup(); void award(action); }
    };
    const cleanup = () => { document.removeEventListener('visibilitychange', onVis); clearTimeout(timer); };
    const timer = setTimeout(cleanup, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', onVis);
    return { cancel: cleanup, complete() { if (!done) { done = true; cleanup(); void award(action); } } };
  }
  window.nabdPoints = { award, awardOnShareLeave };
  /* فتح التطبيق مرة يوميًا */
  const day = new Date().toISOString().slice(0, 10);
  const page = document.body?.dataset.page;
  if (page && page !== 'auth') {
    let last = ''; try { last = localStorage.getItem('nabd_pts_open') || ''; } catch {}
    if (last !== day) setTimeout(async () => { if (await award('app_open') >= 0) { try { localStorage.setItem('nabd_pts_open', day); } catch {} } }, 2500);
  }
  /* ربط تلقائي: تعليقات الأخبار والإعجاب */
  const MAP = { news_add_comment_with_reply: 'news_comment', news_add_comment: 'news_comment', news_toggle_like: 'news_like' };
  const hook = () => {
    const c = window.nabdSupabase; if (!c || c.__ptsHook) return; c.__ptsHook = true;
    const orig = c.rpc.bind(c);
    c.rpc = function (name, ...rest) {
      const p = orig(name, ...rest); const act = MAP[name]; if (!act) return p;
      const t = p.then.bind(p);
      p.then = (ok, bad) => t(r => { if (r && !r.error) award(act); return ok ? ok(r) : r; }, bad);
      return p;
    };
  };
  hook(); setTimeout(hook, 500);
})();
