/* نبض التفوق — قسم الدروس: أقسام ← مواد ← دروس ← مشغّل بأسلوب يوتيوب */
(() => {
  'use strict';
  const sb = window.nabdSupabase;
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view'), backBtn = $('#back'), addBtn = $('#adminAdd'), topTitle = $('#topTitle'), topSub = $('#topSub');
  const STAGES = [
    { k: 'nine', name: 'التاسع', sub: 'شروحات مناهج الصف التاسع', icon: 'fa-book-open' },
    { k: 'bac_sci', name: 'بكلوريا علمي', sub: 'الفرع العلمي', icon: 'fa-flask' },
    { k: 'bac_lit', name: 'بكلوريا أدبي', sub: 'الفرع الأدبي', icon: 'fa-feather-pointed' }
  ];
  const stageOf = k => STAGES.find(s => s.k === k);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rpc = async (n, a) => { const { data, error } = await sb.rpc(n, a || {}); if (error) throw error; return data; };
  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); };
  const fmtN = n => { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' مليون'; if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + ' ألف'; return String(n); };
  const ago = iso => { const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'الآن'; const m = s / 60; if (m < 60) return `منذ ${Math.floor(m)} د`; const h = m / 60; if (h < 24) return `منذ ${Math.floor(h)} س`; const d = h / 24; if (d < 30) return `منذ ${Math.floor(d)} يوم`; const mo = d / 30; if (mo < 12) return `منذ ${Math.floor(mo)} شهر`; return `منذ ${Math.floor(mo / 12)} سنة`; };
  const hue = t => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const mmss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const cache = {};
  let isAdmin = false, route = { v: 'stages' }, cleanup = null, token = 0;

  /* ===== التوجيه عبر hash: #stage/subjectId/lessonId ===== */
  const parse = () => { const [stage, sub, les] = decodeURIComponent(location.hash.slice(1)).split('/'); if (!stageOf(stage)) return { v: 'stages' }; if (!sub) return { v: 'subjects', stage }; if (!les) return { v: 'lessons', stage, sub }; return { v: 'player', stage, sub, les }; };
  const go = h => { const d = (history.state?.d || 0) + 1; history.pushState({ d }, '', '#' + h); render(); };
  const parentHash = r => r.v === 'player' ? `${r.stage}/${r.sub}` : r.v === 'lessons' ? r.stage : '';
  const goBack = () => {
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (route.v === 'stages') { location.href = 'index.html'; return; }
    if ((history.state?.d || 0) > 0) history.back(); else { history.replaceState({ d: 0 }, '', '#' + parentHash(route)); render(); }
  };
  window.addEventListener('popstate', render);
  backBtn.addEventListener('click', goBack);

  const setTop = (t, s) => { topTitle.textContent = t; topSub.textContent = s || ''; };
  const loading = () => { view.innerHTML = '<div class="ls-grid">' + '<div class="ls-sk"></div>'.repeat(6) + '</div>'; };

  async function render() {
    const my = ++token;
    cleanup?.(); cleanup = null;
    route = parse();
    document.body.classList.toggle('player', route.v === 'player');
    $('#top').style.display = route.v === 'player' ? 'none' : '';
    addBtn.hidden = true;
    window.scrollTo(0, 0);
    try {
      if (route.v === 'stages') return stagesView();
      if (route.v === 'subjects') return await subjectsView(my);
      if (route.v === 'lessons') return await lessonsView(my);
      return await playerView(my);
    } catch (e) {
      if (my !== token) return;
      console.warn(e);
      view.innerHTML = '<div class="ls-empty"><i class="fa-solid fa-triangle-exclamation"></i>تعذر التحميل، تحقق من الاتصال وحاول مجدداً<br><br><button class="ls-more" id="retry">إعادة المحاولة</button></div>';
      $('#retry')?.addEventListener('click', render);
    }
  }

  /* ===== 1) الأقسام الثلاثة ===== */
  function stagesView() {
    setTop('الدروس', 'اختر القسم لبدء المشاهدة');
    view.innerHTML = '<div class="ls-stages">' + STAGES.map(s => `<button class="ls-stage" data-k="${s.k}"><i class="ic fa-solid ${s.icon}"></i><span><b>${s.name}</b><small>${s.sub}</small></span><i class="go fa-solid fa-chevron-left"></i></button>`).join('') + '</div>';
    view.querySelectorAll('.ls-stage').forEach(b => b.addEventListener('click', () => go(b.dataset.k)));
  }

  /* ===== 2) بطاقات المواد 2× ===== */
  async function subjectsView(my) {
    const st = stageOf(route.stage);
    setTop(st.name, 'اختر المادة');
    addBtn.hidden = !isAdmin; addBtn.onclick = () => subjectForm(null);
    const key = 's:' + route.stage;
    if (cache[key]) paint(cache[key]); else loading();
    const rows = await rpc('lessons_subjects', { p_stage: route.stage });
    if (my !== token) return;
    cache[key] = rows; paint(rows);
    function paint(rows) {
      if (!rows.length) { view.innerHTML = '<div class="ls-empty"><i class="fa-solid fa-folder-open"></i>لا توجد مواد في هذا القسم بعد</div>'; return; }
      view.innerHTML = '<div class="ls-grid">' + rows.map(r => `<div class="ls-subj" role="button" tabindex="0" data-id="${r.id}"><i class="ic fa-solid ${esc(r.icon)}"></i><b>${esc(r.name)}</b><small>${r.lesson_count} درس</small>${isAdmin ? `<button class="ed" data-ed="${r.id}" aria-label="تعديل"><i class="fa-solid fa-pen"></i></button>` : ''}</div>`).join('') + '</div>';
      view.querySelectorAll('.ls-subj').forEach(c => c.addEventListener('click', e => { const ed = e.target.closest('.ed'); if (ed) { e.stopPropagation(); subjectForm(rows.find(x => x.id === ed.dataset.ed)); return; } go(`${route.stage}/${c.dataset.id}`); }));
    }
  }

  /* ===== 3) قائمة دروس المادة بالترتيب ===== */
  async function lessonsView(my) {
    const st = stageOf(route.stage);
    const subj = (cache['s:' + route.stage] || []).find(x => x.id === route.sub);
    setTop(subj?.name || 'الدروس', st.name);
    addBtn.hidden = !isAdmin; addBtn.onclick = () => lessonForm(null);
    view.innerHTML = '<div class="ls-load"><span class="ls-spin"></span></div>';
    const rows = isAdmin ? await rpc('lessons_admin_list', { p_subject: route.sub }) : await rpc('lessons_list', { p_subject: route.sub });
    if (my !== token) return;
    if (!subj) { const s = await rpc('lessons_subjects', { p_stage: route.stage }); cache['s:' + route.stage] = s; const f = s.find(x => x.id === route.sub); if (f) setTop(f.name, st.name); }
    if (!rows.length) { view.innerHTML = '<div class="ls-empty"><i class="fa-solid fa-film"></i>لا توجد دروس في هذه المادة بعد</div>'; return; }
    topSub.textContent = `${st.name} · ${rows.length} درس`;
    view.innerHTML = '<div class="ls-list">' + rows.map((r, i) => `<div class="ls-item" role="button" tabindex="0" data-id="${r.id}"><span class="ls-num">${i + 1}</span><span class="t"><b>${esc(r.title)}</b><small>${isAdmin ? (r.is_published ? 'منشور' : 'مخفي') : `${fmtN(r.views)} مشاهدة`}</small></span>${isAdmin ? `<button class="ed" data-ed="${r.id}" style="padding:8px"><i class="fa-solid fa-pen"></i></button>` : '<i class="pl fa-solid fa-circle-play"></i>'}</div>`).join('') + '</div>';
    view.querySelectorAll('.ls-item').forEach(c => c.addEventListener('click', e => { const ed = e.target.closest('.ed'); if (ed) { e.stopPropagation(); lessonForm(rows.find(x => x.id === ed.dataset.ed)); return; } go(`${route.stage}/${route.sub}/${c.dataset.id}`); }));
  }

  /* ===== 4) المشغّل ===== */
  const ytId = u => { const m = String(u).match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/); return m ? m[1] : null; };
  let ytLoading = null;
  const loadYT = () => ytLoading || (ytLoading = new Promise(res => { if (window.YT?.Player) return res(); const p = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { p?.(); res(); }; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }));

  /* محوّل موحّد لمصدرَي الفيديو (ملف مباشر أو يوتيوب) */
  function makeEngine(host, url, cb) {
    const id = ytId(url);
    if (!id) {
      const v = document.createElement('video'); v.src = url; v.playsInline = true; v.preload = 'metadata'; v.setAttribute('controlsList', 'nodownload'); host.appendChild(v);
      v.addEventListener('play', () => cb.state('play')); v.addEventListener('pause', () => cb.state('pause')); v.addEventListener('ended', () => cb.state('end'));
      v.addEventListener('waiting', () => cb.buf(true)); v.addEventListener('playing', () => cb.buf(false)); v.addEventListener('canplay', () => cb.buf(false));
      v.addEventListener('timeupdate', cb.tick); v.addEventListener('progress', cb.tick); v.addEventListener('loadedmetadata', cb.tick); v.addEventListener('error', () => cb.error());
      return { get cur() { return v.currentTime; }, get dur() { return v.duration || 0; }, get buffered() { try { return v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0; } catch { return 0; } }, get paused() { return v.paused; }, play: () => v.play().catch(() => {}), pause: () => v.pause(), seek: t => { v.currentTime = Math.max(0, Math.min(t, v.duration || t)); }, rate: r => { v.playbackRate = r; }, destroy: () => { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } };
    }
    const box = document.createElement('div'); box.className = 'yt'; const inner = document.createElement('div'); box.appendChild(inner); host.appendChild(box);
    let p = null, ready = false, timer = null, dead = false;
    loadYT().then(() => {
      if (dead) return;
      p = new YT.Player(inner, { videoId: id, width: '100%', height: '100%', playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 0, origin: location.origin }, events: {
        onReady: () => { ready = true; cb.tick(); }, onError: () => cb.error(),
        onStateChange: e => { const S = YT.PlayerState; if (e.data === S.PLAYING) { cb.state('play'); cb.buf(false); } else if (e.data === S.PAUSED) cb.state('pause'); else if (e.data === S.ENDED) cb.state('end'); else if (e.data === S.BUFFERING) cb.buf(true); }
      } });
      timer = setInterval(() => ready && cb.tick(), 250);
    });
    return { get cur() { return ready ? p.getCurrentTime() : 0; }, get dur() { return ready ? p.getDuration() : 0; }, get buffered() { return ready ? p.getVideoLoadedFraction() * p.getDuration() : 0; }, get paused() { return !ready || p.getPlayerState() !== 1 && p.getPlayerState() !== 3; }, play: () => ready && p.playVideo(), pause: () => ready && p.pauseVideo(), seek: t => ready && p.seekTo(Math.max(0, Math.min(t, p.getDuration() || t)), true), rate: r => ready && p.setPlaybackRate(r), destroy: () => { dead = true; clearInterval(timer); try { p?.destroy(); } catch {} box.remove(); } };
  }

  async function playerView(my) {
    view.innerHTML = '<div class="ls-load"><span class="ls-spin"></span></div>';
    const rows = await rpc('lesson_get', { p_lesson: route.les });
    if (my !== token) return;
    const L = rows?.[0];
    if (!L) { $('#top').style.display = ''; setTop('الدروس', ''); view.innerHTML = '<div class="ls-empty"><i class="fa-solid fa-circle-exclamation"></i>هذا الدرس غير متاح</div>'; return; }
    document.title = `${L.title} | نبض التفوق`;
    view.innerHTML = `<div class="ls-player-page">
      <div class="vp show" id="vp"><div class="tap" id="tap"></div><div class="ripple l" id="rpl"></div><div class="ripple r" id="rpr"></div><div class="spin"><i></i></div>
        <div class="ctl" id="ctl">
          <div style="display:flex;justify-content:space-between;padding:calc(env(safe-area-inset-top,0px) + 8px) 10px 0"><button class="vb" id="vb" aria-label="رجوع" style="color:#fff;font-size:18px;width:40px;height:40px"><i class="fa-solid fa-chevron-left"></i></button></div>
          <div class="mid"><button class="sk" id="bk" aria-label="رجوع 10 ثوان"><i class="fa-solid fa-rotate-left"></i><b>10</b></button><button class="pp" id="pp" aria-label="تشغيل"><i class="fa-solid fa-play"></i></button><button class="sk" id="fw" aria-label="تقديم 10 ثوان"><i class="fa-solid fa-rotate-right"></i><b>10</b></button></div>
          <div class="bar"><div class="seek" id="seek"><div class="tr"></div><div class="bf" id="bf"></div><div class="pr" id="pr"></div><div class="kn" id="kn"></div></div>
            <div class="row"><span id="tm">0:00 / 0:00</span><span class="sp"></span><button id="spd">1x</button><button id="fs" aria-label="ملء الشاشة"><i class="fa-solid fa-expand"></i></button></div></div>
        </div>
        <div class="speedmenu" id="spm">${[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => `<button data-r="${r}" class="${r === 1 ? 'on' : ''}">${r}x</button>`).join('')}</div>
      </div>
      <div class="det">
        <h2>${esc(L.title)}</h2>
        <div class="meta"><span id="vw">${fmtN(L.views)} مشاهدة</span> · ${ago(L.created_at)} · ${esc(L.subject_name)}</div>
        <div class="ch"><img src="assets/nabd-logo.jpg" alt="" width="40" height="40"><div><b>نبض التفوق <i class="vf fa-solid fa-circle-check"></i></b><small>المنصة التعليمية</small></div></div>
        <div class="acts"><button class="pill ${L.liked ? 'on' : ''}" id="lk"><i class="fa-${L.liked ? 'solid' : 'regular'} fa-thumbs-up"></i><span id="lkn">${fmtN(L.likes)}</span></button><button class="pill" id="sh"><i class="fa-solid fa-share"></i>مشاركة</button></div>
        ${L.description ? `<div class="desc cl" id="ds">${esc(L.description)}<div class="more">…عرض المزيد</div></div>` : ''}
        <div class="cm-h">التعليقات <small id="cmn">${fmtN(L.comments)}</small></div>
        <div class="cm-form"><textarea id="cmt" rows="1" maxlength="600" placeholder="أضف تعليقاً…"></textarea><button id="cms" disabled>نشر</button></div>
        <div id="cml"></div><button class="ls-more" id="cmm" hidden>عرض المزيد</button>
      </div></div>`;
    setupPlayer(L, my);
    setupDetails(L, my);
  }

  function setupPlayer(L, my) {
    const vp = $('#vp'), ctl = $('#ctl');
    let hideT = null, dragging = false, viewed = false, curRate = 1;
    const showCtl = (keep) => { vp.classList.add('show'); clearTimeout(hideT); if (!keep && !eng.paused) hideT = setTimeout(() => { if (!dragging && !$('#spm').classList.contains('on')) vp.classList.remove('show'); }, 3000); };
    const ui = () => {
      const d = eng.dur, c = eng.cur;
      $('#tm').textContent = `${mmss(c)} / ${mmss(d)}`;
      if (d) { const pc = c / d * 100; $('#pr').style.width = pc + '%'; $('#kn').style.left = pc + '%'; $('#bf').style.width = Math.min(100, eng.buffered / d * 100) + '%'; }
    };
    const setPlayIcon = () => { $('#pp').innerHTML = `<i class="fa-solid fa-${eng.paused ? 'play' : 'pause'}"></i>`; };
    const eng = makeEngine(vp, L.video_url, {
      state: s => { setPlayIcon(); if (s === 'play') { showCtl(); if (!viewed) { viewed = true; rpc('lesson_mark_view', { p_lesson: L.id }).then(() => rpc('lesson_get', { p_lesson: L.id })).then(r => { if (r?.[0] && $('#vw')) $('#vw').textContent = `${fmtN(r[0].views)} مشاهدة`; }).catch(() => {}); } } else { showCtl(true); } },
      buf: b => vp.classList.toggle('buf', b), tick: ui,
      error: () => toast('تعذر تشغيل الفيديو، تحقق من الرابط أو الاتصال')
    });
    const seekBy = d => { eng.seek(eng.cur + d); ui(); };
    const toggle = () => { eng.paused ? eng.play() : eng.pause(); setTimeout(setPlayIcon, 60); };
    $('#pp').onclick = e => { e.stopPropagation(); toggle(); showCtl(); };
    $('#bk').onclick = e => { e.stopPropagation(); seekBy(-10); showCtl(); };
    $('#fw').onclick = e => { e.stopPropagation(); seekBy(10); showCtl(); };
    $('#vb').onclick = e => { e.stopPropagation(); goBack(); };
    /* لمسة واحدة: إظهار/إخفاء الأزرار — لمستان على الجانبين: ±10 ثوان */
    let lastTap = 0, lastX = 0, single = null;
    const ripple = side => { const el = $(side < 0 ? '#rpl' : '#rpr'); el.textContent = side < 0 ? '« 10 ث' : '10 ث »'; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 420); };
    $('#tap').addEventListener('click', e => {
      const r = vp.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, now = Date.now();
      if (now - lastTap < 320) {
        clearTimeout(single); lastTap = 0;
        if (x < 0.36) { seekBy(-10); ripple(-1); } else if (x > 0.64) { seekBy(10); ripple(1); } else toggle();
        showCtl(); return;
      }
      lastTap = now;
      single = setTimeout(() => { if (vp.classList.contains('show')) { $('#spm').classList.remove('on'); vp.classList.remove('show'); } else showCtl(); }, 320);
    });
    /* شريط التقدم */
    const seek = $('#seek');
    const posOf = e => { const r = seek.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
    seek.addEventListener('pointerdown', e => { e.stopPropagation(); dragging = true; vp.classList.add('dragging'); seek.setPointerCapture(e.pointerId); const p = posOf(e); $('#pr').style.width = p * 100 + '%'; $('#kn').style.left = p * 100 + '%'; });
    seek.addEventListener('pointermove', e => { if (!dragging) return; const p = posOf(e); $('#pr').style.width = p * 100 + '%'; $('#kn').style.left = p * 100 + '%'; $('#tm').textContent = `${mmss(p * eng.dur)} / ${mmss(eng.dur)}`; });
    const endDrag = e => { if (!dragging) return; dragging = false; vp.classList.remove('dragging'); eng.seek(posOf(e) * eng.dur); showCtl(); };
    seek.addEventListener('pointerup', endDrag); seek.addEventListener('pointercancel', () => { dragging = false; vp.classList.remove('dragging'); });
    /* السرعة */
    $('#spd').onclick = e => { e.stopPropagation(); $('#spm').classList.toggle('on'); showCtl(true); };
    $('#spm').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; curRate = Number(b.dataset.r); eng.rate(curRate); $('#spd').textContent = curRate + 'x'; $('#spm').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); $('#spm').classList.remove('on'); showCtl(); });
    /* ملء الشاشة + قفل الوضع الأفقي */
    const fsIcon = () => { const on = document.fullscreenElement === vp || vp.classList.contains('fs'); $('#fs').innerHTML = `<i class="fa-solid fa-${on ? 'compress' : 'expand'}"></i>`; };
    const onFs = () => { fsIcon(); if (!document.fullscreenElement) { try { screen.orientation?.unlock?.(); } catch {} } };
    document.addEventListener('fullscreenchange', onFs);
    $('#fs').onclick = async e => {
      e.stopPropagation();
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      if (vp.classList.contains('fs')) { vp.classList.remove('fs'); fsIcon(); try { screen.orientation?.unlock?.(); } catch {} return; }
      try { await (vp.requestFullscreen?.() || vp.webkitRequestFullscreen?.()); } catch { vp.classList.add('fs'); fsIcon(); }
      if (!document.fullscreenElement && !vp.classList.contains('fs')) vp.classList.add('fs');
      try { await screen.orientation?.lock?.('landscape'); } catch {}
      fsIcon();
    };
    /* لوحة المفاتيح */
    const key = e => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); } else if (e.key === 'ArrowLeft' || e.key === 'j') seekBy(-10); else if (e.key === 'ArrowRight' || e.key === 'l') seekBy(10); else if (e.key === 'f') $('#fs').click(); else return;
      showCtl();
    };
    document.addEventListener('keydown', key);
    cleanup = () => { document.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', onFs); clearTimeout(hideT); clearTimeout(single); if (document.fullscreenElement) document.exitFullscreen?.(); try { screen.orientation?.unlock?.(); } catch {} eng.destroy(); document.title = 'الدروس | نبض التفوق'; };
    setPlayIcon(); ui();
  }

  function setupDetails(L, my) {
    /* الإعجاب */
    let busy = false;
    $('#lk').onclick = async () => {
      if (busy) return; busy = true;
      const b = $('#lk'); const was = b.classList.contains('on');
      b.classList.toggle('on', !was); b.querySelector('i').className = `fa-${was ? 'regular' : 'solid'} fa-thumbs-up`;
      try { const r = (await rpc('lesson_toggle_like', { p_lesson: L.id }))[0]; b.classList.toggle('on', r.liked); b.querySelector('i').className = `fa-${r.liked ? 'solid' : 'regular'} fa-thumbs-up`; $('#lkn').textContent = fmtN(r.likes); }
      catch (er) { b.classList.toggle('on', was); b.querySelector('i').className = `fa-${was ? 'solid' : 'regular'} fa-thumbs-up`; toast('تعذر تسجيل الإعجاب'); }
      busy = false;
    };
    $('#sh').onclick = async () => { const url = location.href; try { if (navigator.share) await navigator.share({ title: L.title, text: `${L.title} — نبض التفوق`, url }); else { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); } } catch {} };
    /* الوصف */
    const ds = $('#ds'); if (ds) ds.onclick = () => { ds.classList.toggle('cl'); const m = ds.querySelector('.more'); if (m) m.textContent = ds.classList.contains('cl') ? '…عرض المزيد' : 'عرض أقل'; };
    /* التعليقات */
    const list = $('#cml'), more = $('#cmm'), ta = $('#cmt'), send = $('#cms'); let last = null, total = Number(L.comments) || 0;
    const item = c => `<div class="cm" data-id="${c.id}"><span class="av" style="background:hsl(${hue(c.name)} 55% 45%)">${esc(Array.from(c.name)[0] || '؟')}</span><div class="b"><div class="n">${esc(c.name)}${c.is_verified ? ' <i class="fa-solid fa-circle-check" style="color:var(--accent);font-size:11px"></i>' : ''}<small>${ago(c.created_at)}</small></div><p>${esc(c.body)}</p>${(c.mine || isAdmin) ? '<button class="x" data-del="1"><i class="fa-regular fa-trash-can"></i> حذف</button>' : ''}</div></div>`;
    const load = async (reset) => {
      const rows = await rpc('lesson_comments_list', { p_lesson: L.id, p_limit: 20, p_before: reset ? null : last });
      if (my !== token) return;
      if (reset) list.innerHTML = rows.length ? '' : '<div class="ls-empty" style="padding:20px">كن أول من يعلّق</div>';
      list.insertAdjacentHTML('beforeend', rows.map(item).join(''));
      if (rows.length) last = rows[rows.length - 1].created_at;
      more.hidden = rows.length < 20;
    };
    load(true).catch(() => { list.innerHTML = '<div class="ls-empty" style="padding:20px">تعذر تحميل التعليقات</div>'; });
    more.onclick = () => load(false).catch(() => toast('تعذر التحميل'));
    ta.addEventListener('input', () => { send.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    send.onclick = async () => {
      const body = ta.value.trim(); if (!body) return; send.disabled = true;
      try { await rpc('lesson_comment_add', { p_lesson: L.id, p_body: body }); ta.value = ''; ta.style.height = 'auto'; total += 1; $('#cmn').textContent = fmtN(total); await load(true); }
      catch (e) { toast(/slow down/.test(e.message || '') ? 'انتظر قليلاً قبل التعليق مجدداً' : 'تعذر نشر التعليق'); send.disabled = false; }
    };
    list.addEventListener('click', async e => {
      const b = e.target.closest('[data-del]'); if (!b) return; const row = b.closest('.cm');
      if (!confirm('حذف هذا التعليق؟')) return;
      try { await rpc('lesson_comment_delete', { p_id: row.dataset.id }); row.remove(); total = Math.max(0, total - 1); $('#cmn').textContent = fmtN(total); } catch { toast('تعذر الحذف'); }
    });
  }

  /* ===== نماذج الإدارة ===== */
  function sheet(title, html, onSave, onDelete) {
    const bg = document.createElement('div'); bg.className = 'ls-sheet-bg';
    bg.innerHTML = `<form class="ls-sheet"><h3>${title}</h3>${html}<div class="btns"><button type="button" class="cn">إلغاء</button>${onDelete ? '<button type="button" class="del">حذف</button>' : ''}<button type="submit" class="ok">حفظ</button></div></form>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    bg.querySelector('.cn').onclick = close;
    if (onDelete) bg.querySelector('.del').onclick = async () => { if (!confirm('تأكيد الحذف؟ لا يمكن التراجع.')) return; try { await onDelete(); close(); } catch { toast('تعذر الحذف'); } };
    bg.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await onSave(bg.querySelector('form')); close(); } catch (er) { toast(/https/.test(er.message || '') ? 'الرابط يجب أن يبدأ بـ https' : 'تعذر الحفظ'); } };
  }
  function subjectForm(s) {
    sheet(s ? 'تعديل مادة' : 'إضافة مادة', `<label>اسم المادة</label><input name="name" required maxlength="80" value="${esc(s?.name || '')}"><label>الأيقونة (Font Awesome)</label><input name="icon" value="${esc(s?.icon || 'fa-book')}" dir="ltr"><label>الترتيب</label><input name="sort" type="number" value="${s ? '' : ''}" placeholder="0">`,
      async f => { await rpc('lessons_admin_subject_save', { p_id: s?.id || null, p_stage: route.stage, p_name: f.name.value, p_icon: f.icon.value, p_sort: f.sort.value === '' ? null : Number(f.sort.value), p_active: true }); delete cache['s:' + route.stage]; render(); },
      s ? async () => { await rpc('lessons_admin_delete', { p_kind: 'subject', p_id: s.id }); delete cache['s:' + route.stage]; render(); } : null);
  }
  function lessonForm(l) {
    sheet(l ? 'تعديل درس' : 'إضافة درس', `<label>عنوان الدرس</label><input name="title" required maxlength="160" value="${esc(l?.title || '')}"><label>رابط الفيديو (يوتيوب أو ملف mp4 مباشر — https)</label><input name="url" required dir="ltr" value="${esc(l?.video_url || '')}" placeholder="https://"><label>وصف الدرس</label><textarea name="desc">${esc(l?.description || '')}</textarea><label>الترتيب</label><input name="sort" type="number" value="${l ? l.sort : ''}" placeholder="0"><label class="chk"><input type="checkbox" name="pub" ${l && !l.is_published ? '' : 'checked'}> منشور للطلاب</label>`,
      async f => { await rpc('lessons_admin_lesson_save', { p_id: l?.id || null, p_subject: route.sub, p_title: f.title.value, p_desc: f.desc.value, p_url: f.url.value, p_sort: f.sort.value === '' ? null : Number(f.sort.value), p_published: f.pub.checked }); delete cache['s:' + route.stage]; render(); },
      l ? async () => { await rpc('lessons_admin_delete', { p_kind: 'lesson', p_id: l.id }); render(); } : null);
  }

  /* ===== بدء ===== */
  history.replaceState({ d: 0 }, '', location.href);
  render();
  rpc('lessons_is_admin').then(v => { isAdmin = !!v; if (isAdmin) render(); }).catch(() => {});
})();
