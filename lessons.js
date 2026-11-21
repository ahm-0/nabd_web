/* نبض التفوق — قسم الدروس: أقسام ← مواد ← دروس ← مشغّل بأسلوب يوتيوب (الإدارة من بوابة المشرفين) */
(() => {
  'use strict';
  const sb = window.nabdSupabase;
  const $ = (s, r = document) => r.querySelector(s);
  const view = $('#view'), backBtn = $('#back'), topTitle = $('#topTitle'), topSub = $('#topSub');
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
  const ago = iso => { const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'الآن'; const m = s / 60; if (m < 60) return `قبل ${Math.floor(m)} د`; const h = m / 60; if (h < 24) return `قبل ${Math.floor(h)} ساعة`; const d = h / 24; if (d < 30) return `قبل ${Math.floor(d)} يوم`; const mo = d / 30; if (mo < 12) return `قبل ${Math.floor(mo)} شهر`; return `قبل ${Math.floor(mo / 12)} سنة`; };
  const hue = t => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const mmss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
  const ytIdOf = u => { const m = String(u).match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/); return m ? m[1] : null; };
  const thumbHTML = (url, n) => { const id = ytIdOf(url); return `<span class="th">${id ? `<img loading="lazy" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="">` : '<i class="fa-solid fa-circle-play ph"></i>'}<b>${n}</b></span>`; };
  const cache = {};
  let route = { v: 'stages' }, cleanup = null, token = 0;

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
    $('#top').hidden = route.v === 'player' || route.v === 'stages';
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
    document.title = 'الدروس | نبض التفوق';
    view.innerHTML = `<header class="ls-hero"><span class="eyebrow">شروحات مرئية</span><h2>الدروس</h2><p>اختر قسمك لتصل إلى مواده ودروسه المصوّرة.</p></header><div class="ls-stages">` + STAGES.map(s => `<button class="ls-stage" data-k="${s.k}"><i class="ic fa-solid ${s.icon}"></i><span><b>${s.name}</b><small>${s.sub}</small></span><i class="go fa-solid fa-chevron-left"></i></button>`).join('') + '</div>';
    view.querySelectorAll('.ls-stage').forEach(b => b.addEventListener('click', () => go(b.dataset.k)));
  }

  /* ===== 2) بطاقات المواد 2× ===== */
  async function subjectsView(my) {
    const st = stageOf(route.stage);
    setTop(st.name, 'اختر المادة');
    const key = 's:' + route.stage;
    if (cache[key]) paint(cache[key]); else loading();
    const rows = await rpc('lessons_subjects', { p_stage: route.stage });
    if (my !== token) return;
    cache[key] = rows; paint(rows);
    function paint(rows) {
      if (!rows.length) { view.innerHTML = '<div class="ls-empty"><i class="fa-solid fa-folder-open"></i>لا توجد مواد في هذا القسم بعد</div>'; return; }
      view.innerHTML = '<div class="ls-grid">' + rows.map(r => `<button class="ls-subj" data-id="${r.id}"><i class="ic fa-solid ${esc(r.icon)}"></i><b>${esc(r.name)}</b><small>${r.lesson_count} درس</small></button>`).join('') + '</div>';
      view.querySelectorAll('.ls-subj').forEach(c => c.addEventListener('click', () => go(`${route.stage}/${c.dataset.id}`)));
    }
  }

  /* ===== 3) قائمة دروس المادة بالترتيب ===== */
  async function lessonsView(my) {
    const st = stageOf(route.stage);
    const subj = (cache['s:' + route.stage] || []).find(x => x.id === route.sub);
    setTop(subj?.name || 'الدروس', st.name);
    view.innerHTML = '<div class="ls-load"><span class="ls-spin"></span></div>';
    const [rows, subs] = await Promise.all([rpc('lessons_list_v2', { p_subject: route.sub }), subj ? null : rpc('lessons_subjects', { p_stage: route.stage })]);
    if (my !== token) return;
    if (subs) { cache['s:' + route.stage] = subs; const f = subs.find(x => x.id === route.sub); if (f) setTop(f.name, st.name); }
    if (!rows.length) { view.innerHTML = '<div class="ls-empty"><i class="fa-solid fa-film"></i>لا توجد دروس في هذه المادة بعد</div>'; return; }
    topSub.textContent = `${st.name} · ${rows.length} درس`;
    view.innerHTML = '<div class="ls-list">' + rows.map((r, i) => `<button class="ls-item" data-id="${r.id}">${thumbHTML(r.video_url, i + 1)}<span class="t"><b>${esc(r.title)}</b><small>${fmtN(r.views)} مشاهدة · ${ago(r.created_at)}</small></span></button>`).join('') + '</div>';
    view.querySelectorAll('.ls-item').forEach(c => c.addEventListener('click', () => go(`${route.stage}/${route.sub}/${c.dataset.id}`)));
  }

  /* ===== 4) المشغّل ===== */
  let ytLoading = null;
  const loadYT = () => ytLoading || (ytLoading = new Promise(res => { if (window.YT?.Player) return res(); const p = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { p?.(); res(); }; const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }));

  /* محوّل موحّد لمصدرَي الفيديو (ملف مباشر أو يوتيوب) */
  function makeEngine(host, url, cb) {
    const id = ytIdOf(url);
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
    if (!L) { document.body.classList.remove('player'); $('#top').hidden = false; setTop('الدروس', ''); view.innerHTML = '<div class="ls-empty"><i class="fa-solid fa-circle-exclamation"></i>هذا الدرس غير متاح</div>'; return; }
    document.title = `${L.title} | نبض التفوق`;
    view.innerHTML = `<div class="ls-player-page">
      <div class="vp show" id="vp"><div class="tap" id="tap"></div><div class="ripple l" id="rpl"></div><div class="ripple r" id="rpr"></div><div class="spin"><i></i></div>
        <div class="ctl" id="ctl">
          <div class="tp"><button class="vb" id="vb" aria-label="رجوع"><i class="fa-solid fa-chevron-left"></i></button></div>
          <div class="mid"><button class="sk" id="bk" aria-label="رجوع 10 ثوان"><i class="fa-solid fa-rotate-left"></i><b>10</b></button><button class="pp" id="pp" aria-label="تشغيل"><i class="fa-solid fa-play"></i></button><button class="sk" id="fw" aria-label="تقديم 10 ثوان"><i class="fa-solid fa-rotate-right"></i><b>10</b></button></div>
          <div class="bar"><div class="seek" id="seek"><div class="tr"></div><div class="bf" id="bf"></div><div class="pr" id="pr"></div><div class="kn" id="kn"></div></div>
            <div class="row"><span id="tm">0:00 / 0:00</span><span class="sp"></span><button id="spd">1x</button><button id="fs" aria-label="ملء الشاشة / عرضي"><i class="fa-solid fa-expand"></i></button></div></div>
        </div>
        <div class="speedmenu" id="spm">${[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => `<button data-r="${r}" class="${r === 1 ? 'on' : ''}">${r}x</button>`).join('')}</div>
      </div>
      <div class="det">
        <h2>${esc(L.title)}</h2>
        <div class="meta"><span id="vw">${fmtN(L.views)} مشاهدة</span><span>${ago(L.created_at)}</span>${L.description ? '<button class="mm" id="mm">…المزيد</button>' : ''}</div>
        ${L.description ? `<div class="descbox" id="ds" hidden>${esc(L.description)}</div>` : ''}
        <div class="ch"><img src="assets/nabd-logo.jpg" alt="" width="44" height="44"><div><b>نبض التفوق <i class="vf fa-solid fa-circle-check"></i></b><small>${esc(L.subject_name)}</small></div><button class="chip" id="allL"><i class="fa-solid fa-list-ul"></i> كل الدروس</button></div>
        <div class="acts"><button class="act ${L.liked ? 'on' : ''}" id="lk"><i class="fa-${L.liked ? 'solid' : 'regular'} fa-thumbs-up"></i><span id="lkn">${fmtN(L.likes)}</span></button><button class="act" id="cmo"><i class="fa-regular fa-comment"></i><span id="cmc">${fmtN(L.comments)}</span></button><button class="act" id="sh"><i class="fa-solid fa-share"></i><span>مشاركة</span></button></div>
        <button class="cmcard" id="cmcard"><div class="h"><b>التعليقات</b><small id="cmn">${fmtN(L.comments)}</small><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div><div class="pv" id="cmpv"><span class="muted">اضغط لإضافة تعليق أو قراءة التعليقات</span></div></button>
        <h3 class="rel-h">دروس المادة</h3><div class="rel" id="rel"></div>
      </div></div>
      <div class="cs-bg" id="csbg" hidden><section class="cs" id="cs" role="dialog" aria-label="التعليقات"><header><b>التعليقات <small id="cmn2">${fmtN(L.comments)}</small></b><button id="csx" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button></header><div class="cs-list" id="cml"></div><button class="ls-more" id="cmm" hidden>عرض المزيد</button><div class="cm-form"><textarea id="cmt" rows="1" maxlength="600" placeholder="أضف تعليقاً…"></textarea><button id="cms" disabled><i class="fa-solid fa-paper-plane"></i></button></div></section></div>`;
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
    const ratio = (e, el = vp) => { const r = el.getBoundingClientRect(); return vp.classList.contains('rot') ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width; };
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
      const x = ratio(e), now = Date.now();
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
    const posOf = e => Math.max(0, Math.min(1, ratio(e, seek)));
    seek.addEventListener('pointerdown', e => { e.stopPropagation(); dragging = true; vp.classList.add('dragging'); seek.setPointerCapture(e.pointerId); const p = posOf(e); $('#pr').style.width = p * 100 + '%'; $('#kn').style.left = p * 100 + '%'; });
    seek.addEventListener('pointermove', e => { if (!dragging) return; const p = posOf(e); $('#pr').style.width = p * 100 + '%'; $('#kn').style.left = p * 100 + '%'; $('#tm').textContent = `${mmss(p * eng.dur)} / ${mmss(eng.dur)}`; });
    const endDrag = e => { if (!dragging) return; dragging = false; vp.classList.remove('dragging'); eng.seek(posOf(e) * eng.dur); showCtl(); };
    seek.addEventListener('pointerup', endDrag); seek.addEventListener('pointercancel', () => { dragging = false; vp.classList.remove('dragging'); });
    /* السرعة */
    $('#spd').onclick = e => { e.stopPropagation(); $('#spm').classList.toggle('on'); showCtl(true); };
    $('#spm').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; curRate = Number(b.dataset.r); eng.rate(curRate); $('#spd').textContent = curRate + 'x'; $('#spm').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); $('#spm').classList.remove('on'); showCtl(); });
    /* ملء الشاشة + قفل الوضع الأفقي */
    const isFs = () => document.fullscreenElement === vp || document.webkitFullscreenElement === vp || vp.classList.contains('fs');
    const fsIcon = () => { $('#fs').innerHTML = `<i class="fa-solid fa-${isFs() ? 'compress' : 'expand'}"></i>`; };
    const unlock = () => { try { screen.orientation?.unlock?.(); } catch { /* غير مدعوم */ } };
    const exitFs = () => { vp.classList.remove('fs', 'rot'); document.body.style.overflow = ''; unlock(); fsIcon(); showCtl(); };
    const onFs = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement && !vp.classList.contains('fs')) exitFs(); else fsIcon(); };
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
    const onResize = () => { if (vp.classList.contains('rot') && innerWidth > innerHeight) vp.classList.remove('rot'); };
    window.addEventListener('resize', onResize);
    /* ملء الشاشة بالعرض: الواجهة الأصلية إن توفرت، وإلا وضع احتياطي (تغطية كاملة + تدوير للعرض) يعمل داخل WebView */
    $('#fs').onclick = async e => {
      e.stopPropagation();
      if (isFs()) { if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* تجاهل */ } } exitFs(); return; }
      let native = false;
      try { const req = vp.requestFullscreen || vp.webkitRequestFullscreen; if (req) { await req.call(vp); native = !!(document.fullscreenElement || document.webkitFullscreenElement); } } catch { native = false; }
      let locked = false;
      try { if (screen.orientation?.lock) { await screen.orientation.lock('landscape'); locked = true; } } catch { locked = false; }
      if (!native) { vp.classList.add('fs'); document.body.style.overflow = 'hidden'; }
      if (!locked && innerHeight > innerWidth) vp.classList.add('rot');
      fsIcon(); showCtl();
    };
    /* لوحة المفاتيح */
    const key = e => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); } else if (e.key === 'ArrowLeft' || e.key === 'j') seekBy(-10); else if (e.key === 'ArrowRight' || e.key === 'l') seekBy(10); else if (e.key === 'f') $('#fs').click(); else return;
      showCtl();
    };
    document.addEventListener('keydown', key);
    cleanup = () => { document.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs); window.removeEventListener('resize', onResize); document.body.style.overflow = ''; clearTimeout(hideT); clearTimeout(single); if (document.fullscreenElement) document.exitFullscreen?.(); try { screen.orientation?.unlock?.(); } catch {} eng.destroy(); document.title = 'الدروس | نبض التفوق'; };
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
      catch { b.classList.toggle('on', was); b.querySelector('i').className = `fa-${was ? 'solid' : 'regular'} fa-thumbs-up`; toast('تعذر تسجيل الإعجاب'); }
      busy = false;
    };
    $('#sh').onclick = async () => { const url = location.href; try { if (navigator.share) await navigator.share({ title: L.title, text: `${L.title} — نبض التفوق`, url }); else { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); } } catch { /* أُلغيت المشاركة */ } };
    $('#allL').onclick = () => { history.replaceState({ d: history.state?.d || 0 }, '', `#${route.stage}/${route.sub}`); render(); };
    /* الوصف */
    const mm = $('#mm'); if (mm) mm.onclick = () => { const d = $('#ds'); d.hidden = !d.hidden; mm.textContent = d.hidden ? '…المزيد' : 'أقل'; };
    /* دروس المادة */
    rpc('lessons_list_v2', { p_subject: L.subject_id }).then(rows => {
      if (my !== token) return;
      $('#rel').innerHTML = rows.map((r, i) => `<button class="rel-i ${r.id === L.id ? 'cur' : ''}" data-id="${r.id}">${thumbHTML(r.video_url, i + 1)}<span class="t"><b>${esc(r.title)}</b><small>${r.id === L.id ? 'يُعرض الآن' : `${fmtN(r.views)} مشاهدة · ${ago(r.created_at)}`}</small></span></button>`).join('');
      $('#rel').querySelectorAll('.rel-i').forEach(c => c.addEventListener('click', () => { if (c.dataset.id !== L.id) go(`${route.stage}/${route.sub}/${c.dataset.id}`); }));
    }).catch(() => { $('#rel').innerHTML = ''; });
    /* التعليقات: معاينة + نافذة كاملة */
    const bg = $('#csbg'), list = $('#cml'), more = $('#cmm'), ta = $('#cmt'), send = $('#cms'); let last = null, total = Number(L.comments) || 0;
    const setTotal = () => { ['#cmn', '#cmn2', '#cmc'].forEach(s => { $(s).textContent = fmtN(total); }); };
    const item = c => `<div class="cm" data-id="${c.id}"><span class="av" style="background:hsl(${hue(c.name)} 55% 45%)">${esc(Array.from(c.name)[0] || '؟')}</span><div class="b"><div class="n">${esc(c.name)}${c.is_verified ? ' <i class="fa-solid fa-circle-check" style="color:var(--primary);font-size:11px"></i>' : ''}<small>${ago(c.created_at)}</small></div><p>${esc(c.body)}</p>${c.mine ? '<button class="x" data-del="1"><i class="fa-regular fa-trash-can"></i> حذف</button>' : ''}</div></div>`;
    const preview = rows => { $('#cmpv').innerHTML = rows.length ? `<span class="av" style="background:hsl(${hue(rows[0].name)} 55% 45%)">${esc(Array.from(rows[0].name)[0] || '؟')}</span><span class="tx">${esc(rows[0].body)}</span>` : '<span class="muted">كن أول من يعلّق</span>'; };
    const load = async (reset) => {
      const rows = await rpc('lesson_comments_list', { p_lesson: L.id, p_limit: 20, p_before: reset ? null : last });
      if (my !== token) return;
      if (reset) { list.innerHTML = rows.length ? '' : '<div class="ls-empty" style="padding:24px">كن أول من يعلّق</div>'; preview(rows); }
      list.insertAdjacentHTML('beforeend', rows.map(item).join(''));
      if (rows.length) last = rows[rows.length - 1].created_at;
      more.hidden = rows.length < 20;
    };
    load(true).catch(() => { $('#cmpv').innerHTML = '<span class="muted">تعذر تحميل التعليقات</span>'; });
    const open = () => { bg.hidden = false; history.pushState({ ...(history.state || {}), cs: 1 }, '', location.href); };
    const close = () => { if (bg.hidden) return; bg.hidden = true; if (history.state?.cs) history.back(); };
    $('#cmcard').onclick = open; $('#cmo').onclick = open; $('#csx').onclick = close; bg.addEventListener('click', e => { if (e.target === bg) close(); });
    const onPop = () => { if (!history.state?.cs) bg.hidden = true; };
    window.addEventListener('popstate', onPop);
    const prevClean = cleanup; cleanup = () => { window.removeEventListener('popstate', onPop); prevClean?.(); };
    more.onclick = () => load(false).catch(() => toast('تعذر التحميل'));
    ta.addEventListener('input', () => { send.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; });
    send.onclick = async () => {
      const body = ta.value.trim(); if (!body) return; send.disabled = true;
      try { await rpc('lesson_comment_add', { p_lesson: L.id, p_body: body }); ta.value = ''; ta.style.height = 'auto'; total += 1; setTotal(); await load(true); list.scrollTop = 0; }
      catch (e) { toast(/slow down/.test(e.message || '') ? 'انتظر قليلاً قبل التعليق مجدداً' : 'تعذر نشر التعليق'); send.disabled = false; }
    };
    list.addEventListener('click', async e => {
      const b = e.target.closest('[data-del]'); if (!b) return; const row = b.closest('.cm');
      if (!confirm('حذف هذا التعليق؟')) return;
      try { await rpc('lesson_comment_delete', { p_id: row.dataset.id }); row.remove(); total = Math.max(0, total - 1); setTotal(); load(true); } catch { toast('تعذر الحذف'); }
    });
  }

  /* ===== بدء ===== */
  history.replaceState({ d: 0 }, '', location.href);
  render();
})();
