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
  const CHILD = {
    home: [['nine', 'قسم التاسع', 'nine.html', 'fa-book', 'تاسع'], ['bacsci', 'بكالوريا علمي', 'baccalaureate-science.html', 'fa-flask', 'علمي'], ['baclit', 'بكالوريا أدبي', 'baccalaureate-literary.html', 'fa-feather', 'ادبي'],
      ['curriculum', 'المنهاج', 'curriculum.html', 'fa-book-open', 'كتب منهاج'], ['library', 'المكتبة', 'library.html', 'fa-book-bookmark', 'مكتبه'], ['gallery', 'الصور', 'gallery.html', 'fa-images', 'صور'],
      ['pomodoro', 'بومودورو', 'pomodoro.html', 'fa-stopwatch', 'تركيز'], ['completion', 'برنامج الختم', 'completion-program.html', 'fa-list-check', 'ختم'], ['intmath', 'مكثف الرياضيات', 'intensive-math.html', 'fa-square-root-variable', 'رياضيات'],
      ['intsci', 'مكثف العلوم', 'intensive-science.html', 'fa-atom', 'علوم'], ['intar', 'مكثف العربي', 'intensive-arabic.html', 'fa-language', 'عربي'], ['lessons', 'الدروس', 'lessons.html', 'fa-chalkboard', 'دروس'],
      ['edsites', 'مواقع تعليمية', 'educational-sites.html', 'fa-globe', 'مواقع'], ['assistant', 'المساعد', 'assistant.html', 'fa-robot', 'مساعد'], ['ads', 'إعلانات', 'advertising.html', 'fa-bullhorn', 'اعلان']],
    uni: [['unimajors', 'دليل التخصصات', 'university-majors.html', 'fa-graduation-cap', 'تخصص'], ['unidir', 'الجامعات والكليات', 'university-directory.html', 'fa-building-columns', 'كليات'], ['uniadm', 'مفاضلة 2026', 'university-admission-2026.html', 'fa-clipboard-list', 'مفاضله'], ['uniinfo', 'معلومات الجامعات', 'university-info.html', 'fa-circle-info', 'معلومات']],
    nine: [['successlim', 'حدود النجاح', 'success-limits.html', 'fa-chart-line', 'حدود نجاح'], ['channels', 'القنوات', 'free-channels.html', 'fa-tower-broadcast', 'قنوات'], ['screening', 'السبر الترشيحي', 'screening-exam.html', 'fa-file-pen', 'سبر']]
  };
  SECTIONS.forEach(s => { if (CHILD[s[0]]) s.children = CHILD[s[0]]; });
  const byKey = {}; SECTIONS.forEach(s => { byKey[s[0]] = s; (s.children || []).forEach(c => { byKey[c[0]] = c; }); });
  const TOKEN = /@\[([^\]\n]{1,60})\]\((u|s):([A-Za-z0-9-]{1,40})\)/g;
  const norm = t => String(t || '').toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const render = html => String(html || '').replace(TOKEN, (_, label, kind, id) => `<a class="mention ${kind === 's' ? 'mention-sec' : ''}" data-mention="${kind}:${id}" role="button" tabindex="0">@${label}</a>`);
  const strip = text => String(text || '').replace(TOKEN, '@$1');
  const hasToken = text => { TOKEN.lastIndex = 0; const r = TOKEN.test(String(text || '')); TOKEN.lastIndex = 0; return r; };

  const st = document.createElement('style');
  st.textContent = '.mention{display:inline;padding:0 2px;border-radius:6px;font-weight:700;color:#2f6fe0;background:rgba(47,111,224,.12);cursor:pointer;text-decoration:none}html[data-theme="dark"] .mention{color:#7fb6ff;background:rgba(127,182,255,.14)}.mention-sec{color:#0f9d58;background:rgba(15,157,88,.12)}.mn-pop{position:fixed;z-index:400;inset-inline:auto;min-width:230px;max-width:min(92vw,360px);max-height:260px;overflow:auto;padding:6px;border-radius:16px;background:var(--panel,#fff);color:var(--text,#0e1b33);box-shadow:0 8px 30px rgba(0,0,0,.28);font-family:inherit}.mn-pop button{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:0;border-radius:11px;background:none;color:inherit;font:inherit;font-size:14px;text-align:start;cursor:pointer}.mn-pop button:hover,.mn-pop button.on{background:rgba(47,111,224,.13)}.mn-pop i{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;font-size:13px;background:rgba(15,157,88,.14);color:#0f9d58}.mn-pop i.p{background:rgba(47,111,224,.14);color:#2f6fe0;font-style:normal;font-weight:800}.mn-row{display:flex;align-items:center}.mn-row>button{flex:1}.mn-row.child{padding-inline-start:18px}.mn-arrow{display:grid;place-items:center;width:34px;height:34px;flex:none;border-radius:10px;cursor:pointer;opacity:.7}.mn-arrow i{width:auto;height:auto;background:none;color:inherit;font-size:12px}.mn-arrow:hover{background:rgba(47,111,224,.13)}.mn-pop small{margin-inline-start:auto;font-size:10.5px;opacity:.6}';
  document.head.appendChild(st);

  let pop = null, active = null;
  const closePop = () => { pop?.remove(); pop = null; };
  const mentionsOf = el => (el._mn = el._mn || []);

  function attach(el, opts = {}) {
    if (!el || el._mnBound) return; el._mnBound = true;
    let timer = 0, token = 0;
    const find = () => { const caret = el.selectionStart ?? el.value.length; const m = /(^|\s)@([^\s@]{0,24})$/.exec(el.value.slice(0, caret)); return m ? { q: m[2], start: caret - m[2].length - 1, caret } : null; };
    const show = (items, ctx) => {
      closePop(); if (!items.length) return; ctx.items = items;
      pop = document.createElement('div'); pop.className = 'mn-pop'; pop.dir = 'rtl';
      pop.innerHTML = items.map((it, i) => it.kind === 's'
        ? `<div class="mn-row ${it.child ? 'child' : ''}"><button type="button" data-i="${i}"><i class="fa-solid ${it.icon}"></i><span>${esc(it.label)}</span><small>قسم</small></button>${it.kids ? `<b class="mn-arrow" data-x="${i}" role="button" aria-label="الأقسام الفرعية"><i class="fa-solid fa-chevron-${ctx.open === it.key ? 'up' : 'down'}"></i></b>` : ''}</div>`
        : `<button type="button" data-i="${i}"><i class="p">${esc(Array.from(it.label)[0] || '؟')}</i><span>${esc(it.label)}</span></button>`).join('');
      document.body.appendChild(pop);
      const r = el.getBoundingClientRect(); pop.style.bottom = `${Math.max(8, innerHeight - r.top + 8)}px`; pop.style.right = `${Math.max(8, innerWidth - r.right)}px`;
      pop.addEventListener('mousedown', e => e.preventDefault());
      pop.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) { const it = items[Number(x.dataset.x)]; ctx.open = ctx.open === it.key ? null : it.key; update(ctx.open); return; } const b = e.target.closest('[data-i]'); if (b) pick(items[Number(b.dataset.i)], ctx); });
    };
    const pick = (it, ctx) => {
      const label = it.label, tokenStr = it.kind === 's' ? `@[${label}](s:${it.key})` : `@[${label}](u:${it.id})`;
      el.value = `${el.value.slice(0, ctx.start)}@${label} ${el.value.slice(ctx.caret)}`;
      const pos = ctx.start + label.length + 2; el.setSelectionRange(pos, pos);
      const list = mentionsOf(el).filter(m => m.label !== label); list.push({ label, token: tokenStr }); el._mn = list;
      closePop(); el.dispatchEvent(new Event('input', { bubbles: true })); el.focus();
    };
    const update = (open) => {
      const ctx = find(); if (!ctx) { closePop(); return; } ctx.open = open === undefined ? (pop && pop._open) || null : open;
      const q = norm(ctx.q);
      const ex = new Set(opts.exclude || []);
      const secs = [];
      SECTIONS.forEach(s => {
        if (ex.has(s[0])) return;
        const hit = !q || norm(s[1]).includes(q) || norm(s[4]).includes(q);
        const kids = (s.children || []).filter(c => !ex.has(c[0]));
        const kidHit = q ? kids.filter(c => norm(c[1]).includes(q) || norm(c[4]).includes(q)) : [];
        if (hit) secs.push({ kind: 's', key: s[0], label: s[1], icon: s[3], kids: kids.length });
        if (ctx.open === s[0] && !q) kids.forEach(c => secs.push({ kind: 's', key: c[0], label: c[1], icon: c[3], child: true }));
        else if (q) kidHit.forEach(c => { if (!secs.some(x => x.key === c[0])) secs.push({ kind: 's', key: c[0], label: c[1], icon: c[3], child: true }); });
      });
      const local = (opts.people ? opts.people() : []).filter(p => p.name && (!q || norm(p.name).includes(q))).slice(0, 5).map(p => ({ kind: 'u', id: p.id, label: p.name }));
      show([...secs.slice(0, q ? 6 : 40), ...local].slice(0, q ? 10 : 50), ctx); if (pop) pop._open = ctx.open;
      clearTimeout(timer); const my = ++token;
      if (ctx.q.length >= 2 && window.nabdSupabase) timer = setTimeout(async () => {
        try {
          const { data } = await window.nabdSupabase.rpc('chat_search_users', { p_q: ctx.q, p_limit: 6 }); if (my !== token || !Array.isArray(data)) return;
          const seen = new Set(local.map(l => l.id)); const remote = data.filter(u => !seen.has(u.user_id)).map(u => ({ kind: 'u', id: u.user_id, label: u.name }));
          show([...secs.slice(0, q ? 6 : 40), ...local, ...remote].slice(0, 12), ctx); if (pop) pop._open = ctx.open;
        } catch { /* تجاهل */ }
      }, 250);
    };
    el.addEventListener('input', () => { if (!el.value) el._mn = []; update(null); });
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
