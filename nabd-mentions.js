/* الإشارة بـ @ : أشخاص وأقسام التطبيق (الدردشة والأخبار) */
(() => {
  'use strict';
  const SECTIONS = [
    ['news', 'الأخبار', 'news.html', 'fa-newspaper', 'اخبار'], ['chat', 'الدردشة', 'chat.html', 'fa-comments', 'دردشه محادثة'],
    ['support', 'الدعم', 'support-chat.html', 'fa-headset', 'دعم'], ['home', 'الرئيسية', 'index.html', 'fa-house', 'رئيسيه'],
    ['tests', 'الاختبارات', 'tests.html', 'fa-clipboard-check', 'اختبار'], ['predictions', 'التوقعات', 'predictions.html', 'fa-bullseye', 'توقعات'],
    ['exam', 'عداد الامتحان', 'exam-countdown.html', 'fa-hourglass-half', 'امتحان عداد'], ['points', 'المتصدرين', 'points.html', 'fa-trophy', 'نقاط لوحة'],
    ['profile', 'الملف الشخصي', 'profile.html', 'fa-user', 'ملف'], ['settings', 'الإعدادات', 'settings.html', 'fa-gear', 'اعدادات'],
    ['premium', 'بكالوريا المميز', 'premium.html', 'fa-crown', 'مميز'], ['calc', 'حاسبة المعدل', 'grade-calculator.html', 'fa-calculator', 'معدل'],
    ['time', 'تنظيم الوقت', 'time-organizer.html', 'fa-clock', 'وقت'], ['uni', 'الجامعات', 'universities.html', 'fa-building-columns', 'جامعة'],
    ['nine', 'قسم التاسع', 'nine.html', 'fa-book', 'تاسع'], ['saved', 'المحفوظات', 'saved-items.html', 'fa-bookmark', 'حفظ']
  ];
  const byKey = Object.fromEntries(SECTIONS.map(s => [s[0], s]));
  const TOKEN = /@\[([^\]\n]{1,60})\]\((u|s):([A-Za-z0-9-]{1,40})\)/g;
  const norm = t => String(t || '').toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const render = html => String(html || '').replace(TOKEN, (_, label, kind, id) => `<a class="mention ${kind === 's' ? 'mention-sec' : ''}" data-mention="${kind}:${id}" role="button" tabindex="0">@${label}</a>`);
  const strip = text => String(text || '').replace(TOKEN, '@$1');
  const hasToken = text => { TOKEN.lastIndex = 0; const r = TOKEN.test(String(text || '')); TOKEN.lastIndex = 0; return r; };

  const st = document.createElement('style');
  st.textContent = '.mention{display:inline;padding:0 2px;border-radius:6px;font-weight:700;color:#2f6fe0;background:rgba(47,111,224,.12);cursor:pointer;text-decoration:none}html[data-theme="dark"] .mention{color:#7fb6ff;background:rgba(127,182,255,.14)}.mention-sec{color:#0f9d58;background:rgba(15,157,88,.12)}.mn-pop{position:fixed;z-index:400;inset-inline:auto;min-width:230px;max-width:min(92vw,360px);max-height:260px;overflow:auto;padding:6px;border-radius:16px;background:var(--panel,#fff);color:var(--text,#0e1b33);box-shadow:0 8px 30px rgba(0,0,0,.28);font-family:inherit}.mn-pop button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:0;border-radius:11px;background:none;color:inherit;font:inherit;font-size:14px;text-align:start;cursor:pointer}.mn-pop button:hover,.mn-pop button.on{background:rgba(47,111,224,.13)}.mn-pop i{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;font-size:13px;background:rgba(15,157,88,.14);color:#0f9d58}.mn-pop i.p{background:rgba(47,111,224,.14);color:#2f6fe0;font-style:normal;font-weight:800}.mn-pop small{margin-inline-start:auto;font-size:10.5px;opacity:.6}';
  document.head.appendChild(st);

  let pop = null, active = null;
  const closePop = () => { pop?.remove(); pop = null; };
  const mentionsOf = el => (el._mn = el._mn || []);

  function attach(el, opts = {}) {
    if (!el || el._mnBound) return; el._mnBound = true;
    let timer = 0, token = 0;
    const find = () => { const caret = el.selectionStart ?? el.value.length; const m = /(^|\s)@([^\s@]{0,24})$/.exec(el.value.slice(0, caret)); return m ? { q: m[2], start: caret - m[2].length - 1, caret } : null; };
    const show = (items, ctx) => {
      closePop(); if (!items.length) return;
      pop = document.createElement('div'); pop.className = 'mn-pop'; pop.dir = 'rtl';
      pop.innerHTML = items.map((it, i) => it.kind === 's'
        ? `<button type="button" data-i="${i}"><i class="fa-solid ${it.icon}"></i><span>${esc(it.label)}</span><small>قسم</small></button>`
        : `<button type="button" data-i="${i}"><i class="p">${esc(Array.from(it.label)[0] || '؟')}</i><span>${esc(it.label)}</span></button>`).join('');
      document.body.appendChild(pop);
      const r = el.getBoundingClientRect(); pop.style.bottom = `${Math.max(8, innerHeight - r.top + 8)}px`; pop.style.right = `${Math.max(8, innerWidth - r.right)}px`;
      pop.addEventListener('mousedown', e => e.preventDefault());
      pop.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pick(items[Number(b.dataset.i)], ctx); });
    };
    const pick = (it, ctx) => {
      const label = it.label, tokenStr = it.kind === 's' ? `@[${label}](s:${it.key})` : `@[${label}](u:${it.id})`;
      el.value = `${el.value.slice(0, ctx.start)}@${label} ${el.value.slice(ctx.caret)}`;
      const pos = ctx.start + label.length + 2; el.setSelectionRange(pos, pos);
      const list = mentionsOf(el).filter(m => m.label !== label); list.push({ label, token: tokenStr }); el._mn = list;
      closePop(); el.dispatchEvent(new Event('input', { bubbles: true })); el.focus();
    };
    const update = () => {
      const ctx = find(); if (!ctx) { closePop(); return; }
      const q = norm(ctx.q);
      const secs = SECTIONS.filter(s => !q || norm(s[1]).includes(q) || norm(s[4]).includes(q)).slice(0, 5).map(s => ({ kind: 's', key: s[0], label: s[1], icon: s[3] }));
      const local = (opts.people ? opts.people() : []).filter(p => p.name && (!q || norm(p.name).includes(q))).slice(0, 5).map(p => ({ kind: 'u', id: p.id, label: p.name }));
      show([...secs, ...local].slice(0, 8), ctx);
      clearTimeout(timer); const my = ++token;
      if (ctx.q.length >= 2 && window.nabdSupabase) timer = setTimeout(async () => {
        try {
          const { data } = await window.nabdSupabase.rpc('chat_search_users', { p_q: ctx.q, p_limit: 6 }); if (my !== token || !Array.isArray(data)) return;
          const seen = new Set(local.map(l => l.id)); const remote = data.filter(u => !seen.has(u.user_id)).map(u => ({ kind: 'u', id: u.user_id, label: u.name }));
          show([...secs, ...local, ...remote].slice(0, 9), ctx);
        } catch { /* تجاهل */ }
      }, 250);
    };
    el.addEventListener('input', () => { if (!el.value) el._mn = []; update(); });
    el.addEventListener('keyup', e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) update(); });
    el.addEventListener('blur', () => setTimeout(closePop, 150));
    el.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  }
  const encode = (el, text) => { let out = String(text ?? ''); (el?._mn || []).forEach(m => { const i = out.indexOf(`@${m.label}`); if (i >= 0) out = out.slice(0, i) + m.token + out.slice(i + m.label.length + 1); }); return out; };
  const decode = (el, body) => { const list = []; const text = String(body || '').replace(TOKEN, (all, label) => { list.push({ label, token: all }); return `@${label}`; }); if (el) el._mn = list; return text; };

  document.addEventListener('click', e => {
    const a = e.target.closest?.('.mention'); if (!a) return; e.preventDefault(); e.stopPropagation();
    const [kind, id] = String(a.dataset.mention || '').split(/:(.+)/);
    if (kind === 's') { const s = byKey[id]; if (s) location.href = s[2]; return; }
    const ev = new CustomEvent('nabd-mention-user', { detail: id, cancelable: true }); if (window.dispatchEvent(ev) && !ev.defaultPrevented) location.href = `chat.html?dm=${encodeURIComponent(id)}`;
  }, true);
  window.nabdMentions = { attach, render, strip, encode, decode, hasToken, SECTIONS };
})();
