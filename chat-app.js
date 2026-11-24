/* نبض التفوق — تطبيق الدردشة (v2)
   دردشة عامة + رسائل خاصة بأسلوب واتساب/تلجرام فوق Supabase.
   - عرض فوري من الكاش المحلي ثم مزامنة في الخلفية
   - صفحات رسائل مرقّمة بطلب واحد وتحديثات لحظية تزايدية (دون إعادة تحميل)
   - صور مصغّرة بدل الصور الكاملة (كانت ~145KB لكل مستخدم) */
(() => {
  'use strict';

  const sb = window.nabdSupabase;
  const $ = selector => document.querySelector(selector);
  const PAGE = 40;
  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const MAX_THUMBS = 200;
  const LS = { uid: 'nabd_chat_uid', cache: 'nabd_chat_v2_', thumbs: 'nabd_chat_thumbs_v1', seen: 'nabd_chat_pub_seen_', drafts: 'nabd_chat_drafts_' };

  /* ───────── عناصر الصفحة ───────── */
  const E = {
    app: $('#app'), listPane: $('#listPane'), chatPane: $('#chatPane'), convList: $('#convList'), convScroll: $('#convScroll'),
    searchBar: $('#searchBar'), searchInput: $('#searchInput'), listSub: $('#listSub'), navBadge: $('#navBadge'),
    msgs: $('#msgs'), fab: $('#fab'), fabBadge: $('#fabBadge'), input: $('#input'), sendBtn: $('#sendBtn'), counter: $('#counter'),
    ctx: $('#ctx'), ctxTitle: $('#ctxTitle'), ctxText: $('#ctxText'), ctxIc: $('#ctxIc'), composer: $('#composer'),
    chatAv: $('#chatAv'), chatTitle: $('#chatTitle'), chatSub: $('#chatSub'), pinnedBar: $('#pinnedBar'), pinnedText: $('#pinnedText'),
    announce: $('#announce'), blockBtn: $('#blockBtn'), scrim: $('#scrim'), sheet: $('#sheet'), menu: $('#menu'), toast: $('#toast')
  };

  /* ───────── أدوات ───────── */
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const IC = {
    reply: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 016 6v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    pin: '<path d="M12 17v5M9 3h6l-1 7 3 3v2H7v-2l3-3z"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    checks: '<path d="M1 13l4 4L15 7M9 15l2 2L21 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
    bell: '<path d="M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 004 0"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 6M20 4v7h-7"/>',
    chat: '<path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H9l-5 4v-4a2 2 0 01-2-2V6a2 2 0 012-2z"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'
  };
  const ic = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ''}</svg>`;
  const IMG_RE = /^\[\[img:(https:\/\/[^\]\s]+)\]\]\s*/;
  const imgOf = body => { const m = IMG_RE.exec(body || ''); return m ? { url: m[1], cap: body.slice(m[0].length) } : null; };
  const ONCE_RE = /^\[\[once:([^\]\s]+)\]\]\s*/;
  const onceOf = body => { const m = ONCE_RE.exec(body || ''); return m ? { path: m[1], cap: body.slice(m[0].length) } : null; };
  const shotOf = body => /^\[\[sys:shot:[0-9a-f-]{36}\]\]$/.test(body || '');
  const onceState = new Map(), onceShots = new Map();
  const plain = body => window.nabdMentions?.hasToken(body) ? window.nabdMentions.strip(body) : shotOf(body) ? '📸 لقطة شاشة' : onceOf(body) ? '👁 صورة لمرة واحدة' : (() => { const i = imgOf(body); return i ? `📷 ${i.cap || 'صورة'}` : (body || ''); })();
  const linkify = text => { const h = esc(text).replace(/(https?:\/\/[^\s<]+)/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`); return window.nabdMentions ? window.nabdMentions.render(h) : h; };
  const hueOf = text => { let h = 0; const s = String(text || ''); for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => Array.from(w)[0] || '').join('') || '؟';
  const fullName = (a, b, c) => [a, b, c].map(v => String(v || '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => { const r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 3) | 8).toString(16); }));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const TF = new Intl.DateTimeFormat('ar-u-nu-latn', { hour: 'numeric', minute: '2-digit', hour12: true });
  const DF = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long' });
  const SF = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'numeric' });
  const fmtTime = iso => TF.format(new Date(iso));
  const dayKey = iso => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const dayLabel = iso => { const now = new Date(); if (dayKey(iso) === dayKey(now)) return 'اليوم'; const y = new Date(now); y.setDate(now.getDate() - 1); if (dayKey(iso) === dayKey(y)) return 'أمس'; return DF.format(new Date(iso)); };
  const listTime = iso => { if (!iso) return ''; const now = new Date(); if (dayKey(iso) === dayKey(now)) return fmtTime(iso); const y = new Date(now); y.setDate(now.getDate() - 1); return dayKey(iso) === dayKey(y) ? 'أمس' : SF.format(new Date(iso)); };
  const readJSON = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const writeJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* الحصة ممتلئة */ } };
  const rpc = async (name, args) => { const { data, error } = await sb.rpc(name, args); if (error) throw error; return data; };
  const errText = error => {
    const text = String(error?.message || error || '');
    if (error?.code === '42501' || /row-level security/i.test(text)) return 'تعذر الإرسال: الدردشة متوقفة مؤقتًا أو الحساب محظور.';
    if (/Failed to fetch|NetworkError|network/i.test(text)) return 'لا يوجد اتصال بالإنترنت.';
    return text || 'حدث خطأ غير متوقع';
  };

  /* ───────── الحالة ───────── */
  const stored = readJSON('nabd_v3_student', {}) || {};
  const S = {
    uid: localStorage.getItem(LS.uid) || null,
    me: { name: fullName(stored.first, stored.father, stored.last) || 'أنت', stage: stored.stage || '', mod: false },
    canMod: false,
    platform: { enabled: true, announcement: '' },
    profiles: new Map(),
    thumbs: readJSON(LS.thumbs, {}),
    convs: [], requests: [], search: '',
    pub: { scope: 'public', id: 'public', msgs: [], hasMore: true, loaded: false, loading: false, pinned: null, unreadFrom: null, newCount: 0 },
    threads: new Map(),
    selMode: false, sel: new Set(),
    view: { type: 'list', userId: null, threadId: null },
    stats: { total: 0, online: 0, at: 0 },
    settings: { privateOn: true, notices: true },
    replyTo: null, editing: null, typingUntil: 0, atBottom: true
  };
  const drafts = new Map();
  let chan = null, typingChan = null, sheetOpen = false, sheetAfter = null, seenAt = '';

  /* ───────── الإشعارات الصغيرة والأوراق ───────── */
  let toastTimer;
  function toast(message) { E.toast.textContent = message; E.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => E.toast.classList.remove('show'), 2600); }

  function openSheet(html) {
    E.sheet.innerHTML = `<div class="grab"></div>${html}`;
    E.scrim.classList.add('show'); E.sheet.classList.add('show');
    if (!sheetOpen) { sheetOpen = true; history.pushState({ sheet: true }, '', location.href); }
  }
  function setSheet(html) { E.sheet.innerHTML = `<div class="grab"></div>${html}`; }
  function hideSheetUI() { E.scrim.classList.remove('show'); E.sheet.classList.remove('show'); }
  function closeSheet(after) { if (!sheetOpen) { if (after) after(); return; } sheetAfter = after || null; history.back(); }
  window.addEventListener('popstate', () => {
    if (!sheetOpen) return;
    sheetOpen = false; hideSheetUI();
    const after = sheetAfter; sheetAfter = null; if (after) after();
  });
  E.scrim.addEventListener('click', () => closeSheet());

  function openMenu(anchor, html) {
    E.menu.innerHTML = html;
    const rect = anchor.getBoundingClientRect();
    E.menu.style.top = `${rect.bottom + 4}px`;
    E.menu.style.left = `${Math.max(8, rect.left)}px`;
    E.menu.classList.add('show');
  }
  const closeMenu = () => E.menu.classList.remove('show');
  document.addEventListener('pointerdown', event => { if (!event.target.closest('#menu, #listMenuBtn')) closeMenu(); }, true);

  /* ───────── الملفات والصور المصغّرة ───────── */
  const VT_TITLE = { admin: 'مشرف موثّق', teacher: 'أستاذ موثّق', developer: 'مطوّر المنصة' };
  function badgeHTML(p) {
    if (p?.ver) { const t = VT_TITLE[p.vt] ? p.vt : 'verified'; return `<i class="verified vk-${t}" title="${VT_TITLE[t] || 'حساب موثّق'}">✓</i>`; }
    return p?.mod ? '<i class="verified" title="مشرف">✓</i>' : '';
  }
  function putProfile(row) {
    const id = row.user_id || row.id; if (!id) return null;
    const prev = S.profiles.get(id) || {};
    const profile = {
      id,
      name: fullName(row.first_name, row.father_name, row.family_name) || prev.name || '',
      stage: row.study_stage ?? prev.stage ?? '',
      province: row.province ?? prev.province ?? '',
      bio: row.bio ?? prev.bio ?? '',
      mod: row.is_moderator ?? prev.mod ?? false,
      ver: row.is_verified ?? prev.ver ?? false,
      vt: row.verification_type ?? prev.vt ?? '',
      has: row.has_avatar ?? prev.has ?? false
    };
    S.profiles.set(id, profile);
    if (row.avatar_thumb) setThumb(id, row.avatar_thumb);
    else if (profile.has && !S.thumbs[id]) needAvatar(id);
    return profile;
  }
  async function ensureProfiles(ids) {
    const missing = [...new Set(ids.filter(Boolean))].filter(id => { const p = S.profiles.get(id); return !p || !p.name; });
    if (!missing.length) return;
    try { (await rpc('chat_get_profiles_v2', { p_user_ids: missing }) || []).forEach(putProfile); } catch (error) { console.warn('تعذر تحميل ملفات المستخدمين', error); }
  }
  const nameOf = id => (id === S.uid ? S.me.name : S.profiles.get(id)?.name) || 'طالب';

  const saveThumbs = debounce(() => {
    const keys = Object.keys(S.thumbs);
    if (keys.length > MAX_THUMBS) keys.slice(0, keys.length - MAX_THUMBS).forEach(key => delete S.thumbs[key]);
    writeJSON(LS.thumbs, S.thumbs);
  }, 800);
  const validThumb = value => typeof value === 'string' && value.length < 60000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  function setThumb(id, dataUrl) {
    if (!validThumb(dataUrl) || S.thumbs[id] === dataUrl) return;
    S.thumbs[id] = dataUrl; saveThumbs();
    document.querySelectorAll(`[data-av="${id}"]`).forEach(node => { node.innerHTML = `<img src="${dataUrl}" alt="" decoding="async">`; });
  }
  function makeThumb(source, size = 128) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height), canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject; img.src = source;
    });
  }
  const avQueue = []; const avSeen = new Set(); let avActive = 0;
  function needAvatar(id) { if (!id || S.thumbs[id] || avSeen.has(id)) return; avSeen.add(id); avQueue.push(id); pumpAvatars(); }
  function pumpAvatars() {
    while (avActive < 2 && avQueue.length) {
      const id = avQueue.shift(); avActive += 1;
      (async () => {
        try {
          const data = await rpc('chat_get_avatar', { p_user: id });
          if (data) setThumb(id, validThumb(data) && data.length <= 30000 ? data : await makeThumb(data));
        } catch (error) { /* تبقى الأحرف الأولى */ } finally { avActive -= 1; pumpAvatars(); }
      })();
    }
  }
  function avatarHTML(id, name, size = '') {
    const thumb = S.thumbs[id];
    if (!thumb && S.profiles.get(id)?.has) needAvatar(id);
    return `<span class="av ${size}" data-av="${esc(id)}" style="--h:${hueOf(id)}">${thumb ? `<img src="${thumb}" alt="" decoding="async">` : esc(initials(name))}</span>`;
  }
  const brandAvatar = (size = '') => `<span class="av brand ${size}"><img src="assets/nabd-logo.jpg" alt="" width="50" height="50"></span>`;

  async function ensureMyThumb() {
    try {
      const rows = await rpc('chat_get_profiles_v2', { p_user_ids: [S.uid] });
      const mine = rows && rows[0]; if (!mine) return;
      putProfile(mine);
      S.me.name = fullName(mine.first_name, mine.father_name, mine.family_name) || S.me.name;
      S.me.stage = mine.study_stage || S.me.stage; S.me.mod = !!mine.is_moderator;
      if (mine.has_avatar && !mine.avatar_thumb) {
        const { data } = await sb.from('student_profiles').select('avatar_url').eq('user_id', S.uid).maybeSingle();
        if (data?.avatar_url) {
          const thumb = await makeThumb(data.avatar_url);
          setThumb(S.uid, thumb);
          await sb.from('student_profiles').update({ avatar_thumb: thumb }).eq('user_id', S.uid);
        }
      }
    } catch (error) { console.warn('تعذر تجهيز صورتك المصغّرة', error); }
  }

  /* ───────── تعيين الصفوف إلى رسائل ───────── */
  function mapPub(row) {
    putProfile({ user_id: row.sender_id, first_name: row.first_name, father_name: row.father_name, family_name: row.family_name, study_stage: row.study_stage, avatar_thumb: row.avatar_thumb, has_avatar: row.has_avatar, is_moderator: row.is_moderator, is_verified: row.is_verified, verification_type: row.verification_type });
    return {
      id: row.id, scope: 'public', sid: row.sender_id, body: row.body, at: row.created_at, edited: !!row.edited_at, pinned: !!row.pinned_at,
      rid: row.reply_to_id, rbody: row.reply_body, rname: row.reply_name, reacts: row.reactions || {}, my: row.my_reaction || null
    };
  }
  function mapPriv(row) {
    return { id: row.id, scope: 'private', sid: row.sender_id, body: row.body, at: row.created_at, edited: !!row.edited_at, read: !!row.read_at, react: row.reaction || null, rid: row.reply_to_id, rbody: row.reply_body, rsid: row.reply_sender_id };
  }
  const replyName = (m, list) => {
    if (m.scope === 'public') return m.rname || '';
    const sid = m.rsid || list?.find(x => x.id === m.rid)?.sid;
    return sid ? (sid === S.uid ? 'أنت' : nameOf(sid)) : '';
  };

  /* ───────── الكاش المحلي (فتح فوري) ───────── */
  const saveCache = debounce(() => {
    if (!S.uid) return;
    writeJSON(LS.cache + S.uid, {
      convs: S.convs, platform: S.platform, stats: S.stats,
      pub: S.pub.msgs.filter(m => !m.status).slice(-PAGE),
      priv: [...S.threads.values()].filter(t => t.msgs.length).sort((a, b) => (b.msgs[b.msgs.length - 1].at || '').localeCompare(a.msgs[a.msgs.length - 1].at || '')).slice(0, 12).map(t => ({ id: t.id, otherId: t.otherId, msgs: t.msgs.filter(m => !m.status).slice(-30) })),
      names: [...S.profiles.values()].filter(p => p.name).slice(-120)
    });
  }, 500);
  function loadCache() {
    if (!S.uid) return;
    const cache = readJSON(LS.cache + S.uid, null); if (!cache) return;
    S.convs = cache.convs || []; S.platform = cache.platform || S.platform; S.stats = cache.stats || S.stats;
    (cache.names || []).forEach(p => S.profiles.set(p.id, p));
    S.pub.msgs = cache.pub || []; S.pub.loaded = S.pub.msgs.length > 0;
    (cache.priv || []).forEach(t => { if (t?.id && Array.isArray(t.msgs) && t.msgs.length) S.threads.set(t.id, { scope: 'private', id: t.id, otherId: t.otherId, msgs: t.msgs, hasMore: true, loaded: true, loading: false, unreadFrom: null, newCount: 0 }); });
    seenAt = localStorage.getItem(LS.seen + S.uid) || '';
  }

  /* ───────── قائمة المحادثات ───────── */
  const pubUnread = () => S.pub.msgs.reduce((n, m) => n + (m.sid !== S.uid && seenAt && m.at > seenAt ? 1 : 0), 0);
  const totalUnread = () => S.convs.reduce((n, c) => n + Number(c.unread_count || 0), 0);
  function updateBadges() {
    const n = totalUnread();
    E.navBadge.hidden = n === 0; E.navBadge.textContent = n > 99 ? '99+' : String(n);
    document.title = `${n ? `(${n}) ` : ''}الدردشة | نبض التفوق`;
  }
  function renderList() {
    const q = S.search.trim().toLowerCase();
    const last = S.pub.msgs[S.pub.msgs.length - 1];
    const pubName = 'دردشة نبض التفوق';
    let html = '';
    if (S.requests.length) html += `<button class="requests-row" type="button" data-act="requests">${ic('bell')}<span style="flex:1">طلبات الدردشة الخاصة</span><b class="count">${S.requests.length}</b></button>`;
    if (!q || pubName.includes(q)) {
      const unread = pubUnread();
      const preview = last ? `<b>${esc(last.sid === S.uid ? 'أنت' : nameOf(last.sid))}:</b> ${esc(last.body)}` : 'مجتمع الطلاب';
      html += `<button class="conv ${unread ? 'unread' : ''} ${S.view.type === 'public' ? 'active' : ''}" type="button" data-open="public">${brandAvatar()}<div class="body"><div class="row1"><span class="name">${pubName}</span><span class="time">${last ? listTime(last.at) : ''}</span></div><div class="row2"><span class="preview">${preview}</span>${unread ? `<span class="count">${unread > 99 ? '99+' : unread}</span>` : ''}</div></div></button>`;
    }
    const convs = S.convs.filter(c => !q || String(c.other_name || '').toLowerCase().includes(q));
    if (convs.length) html += '<div class="section-label">الرسائل الخاصة</div>';
    html += convs.map(c => {
      const unread = Number(c.unread_count || 0);
      const mine = c.last_sender_id === S.uid;
      const preview = c.last_message ? `${mine ? '<b>أنت:</b> ' : ''}${esc(plain(c.last_message))}` : 'ابدأ المحادثة';
      const active = S.view.type === 'private' && S.view.userId === c.other_user_id;
      const picked = S.sel.has(c.other_user_id);
      return `<button class="conv ${unread ? 'unread' : ''} ${active ? 'active' : ''} ${picked ? 'picked' : ''}" type="button" data-open="${esc(c.other_user_id)}">${S.selMode ? `<span class="pick">${picked ? '✓' : ''}</span>` : ''}${avatarHTML(c.other_user_id, c.other_name)}<div class="body"><div class="row1"><span class="name">${esc(c.other_name || 'مستخدم')}${badgeHTML({ mod: c.other_is_moderator, ver: S.profiles.get(c.other_user_id)?.ver, vt: S.profiles.get(c.other_user_id)?.vt })}</span><span class="time">${listTime(c.last_message_at)}</span></div><div class="row2"><span class="preview">${preview}</span>${unread ? `<span class="count">${unread > 99 ? '99+' : unread}</span>` : ''}</div></div></button>`;
    }).join('');
    if (!S.convs.length && !q) html += `<div class="empty">${ic('lock')}<b>لا توجد رسائل خاصة بعد</b><span>اضغط على اسم أي طالب في الدردشة العامة لبدء محادثة خاصة.</span></div>`;
    if (q && !convs.length && !pubName.includes(q)) html = `<div class="empty">${ic('chat')}<b>لا نتائج</b><span>جرّب اسمًا آخر.</span></div>`;
    E.convList.innerHTML = html;
    updateBadges();
  }
  const renderListSoon = debounce(renderList, 60);

  async function loadConvs() {
    try {
      const rows = await rpc('chat_list_private_v2');
      S.convs = (rows || []).map(row => ({ ...row, unread_count: Number(row.unread_count || 0) }));
      S.convs.forEach(c => putProfile({ user_id: c.other_user_id, first_name: c.other_name, avatar_thumb: c.other_avatar_thumb, has_avatar: c.other_has_avatar, study_stage: c.other_stage, is_moderator: c.other_is_moderator }));
      // الاسم الكامل جاهز في other_name؛ نحفظه كاسم مباشر
      S.convs.forEach(c => { const p = S.profiles.get(c.other_user_id); if (p) p.name = c.other_name; });
      renderList(); saveCache();
      // شارات التوثيق للطرف الآخر (استدعاء واحد لكل المحادثات)
      const ids = S.convs.map(c => c.other_user_id).filter(Boolean);
      if (ids.length) { try { ((await rpc('chat_get_profiles_v2', { p_user_ids: ids })) || []).forEach(r => { const p = S.profiles.get(r.user_id); if (p) { p.ver = !!r.is_verified; p.vt = r.verification_type || ''; } }); renderList(); } catch { /* تجاهل */ } }
    } catch (error) { console.warn('تعذر تحميل المحادثات الخاصة', error); }
  }

  /* ───────── الرسائل: عرض ───────── */
  const cur = () => (S.view.type === 'public' ? S.pub : S.view.type === 'private' ? S.threads.get(S.view.threadId) : null);
  const nearBottom = () => E.msgs.scrollHeight - E.msgs.scrollTop - E.msgs.clientHeight < 140;
  const scrollBottom = smooth => E.msgs.scrollTo({ top: E.msgs.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

  const gap = (a, b) => !a || !b || a.sid !== b.sid || dayKey(a.at) !== dayKey(b.at) || Math.abs(new Date(b.at) - new Date(a.at)) > 300000;
  function tickHTML(m) {
    if (m.status === 'sending') return ic('clock', 'tick');
    if (m.status === 'failed') return `<button type="button" class="failed-ic" data-retry="${esc(m.id)}" aria-label="إعادة الإرسال">${ic('alert', 'tick')}</button>`;
    if (m.scope !== 'private') return '';
    return ic(m.read ? 'checks' : 'check', `tick ${m.read ? 'read' : ''}`);
  }
  function rowHTML(m, prev, next, isNew = false) {
    const mine = m.sid === S.uid, pub = m.scope === 'public';
    const first = gap(prev, m), last = gap(m, next);
    const staff = pub && (mine ? S.me.mod : S.profiles.get(m.sid)?.mod);
    if (shotOf(m.body)) return mine ? '' : `<div class="sys-note" data-id="${esc(m.id)}">📸 ${mine ? 'تم تسجيل لقطة شاشة لصورة المرة الواحدة' : `${esc(nameOf(m.sid))} أخذ لقطة شاشة لصورتك`}</div>`;
    let h = `<div class="row ${mine ? 'mine' : 'other'} ${staff ? 'staff' : ''} ${first ? 'first' : ''} ${isNew ? 'new' : ''}" data-id="${esc(m.id)}" style="--h:${hueOf(m.sid)}">`;
    if (pub && !mine) h += `<div class="av-col">${last ? `<button type="button" data-profile="${esc(m.sid)}" aria-label="الملف">${avatarHTML(m.sid, nameOf(m.sid), 'sm')}</button>` : ''}</div>`;
    h += '<div class="bubble">';
    if (staff && (mine || !first)) h += '<div class="staff-tag"><i>✦</i> مشرف</div>';
    if (pub && !mine && first) { const p = S.profiles.get(m.sid); h += `<div class="who-name" data-profile="${esc(m.sid)}">${esc(nameOf(m.sid))}${badgeHTML(p)}${staff ? '<span class="staff-tag inline"><i>✦</i> مشرف</span>' : ''}</div>`; }
    if (m.rid || m.rbody) {
      const list = cur()?.msgs;
      h += `<button type="button" class="quote" data-goto="${esc(m.rid || '')}"><b>${esc(replyName(m, list) || 'رسالة')}</b><span>${esc(plain(m.rbody) || 'رسالة غير متاحة')}</span></button>`;
    }
    { const oc = onceOf(m.body); if (oc) { const seen = onceState.get(m.id) === true; h += mine ? `<div class="once-card ${seen ? 'seen' : ''}"><i>👁</i><b>صورة لمرة واحدة</b><small>${seen ? 'تم فتحها' : 'لم تُفتح بعد'}</small></div>${onceShots.has(m.id) ? `<div class="shot-alert">📸 ${esc(nameOf(cur()?.other || S.view.userId) || 'المستلم')} حاول التقاط لقطة شاشة لصورتك${onceShots.get(m.id) > 1 ? ` (${onceShots.get(m.id)} مرات)` : ''}</div>` : ''}` : `<button type="button" class="once-card ${seen ? 'seen' : ''}" data-once="${esc(m.id)}" ${seen ? 'disabled' : ''}><i>👁</i><b>${seen ? 'فُتحت الصورة' : 'اضغط لعرض الصورة'}</b><small>مرة واحدة فقط</small></button>`; if (oc.cap) h += `<p dir="auto">${linkify(oc.cap)}</p>`; } else
    { const im = imgOf(m.body); if (im) { h += `<button type="button" class="msg-img" data-img="${esc(im.url)}"><img src="${esc(im.url)}" alt="صورة" loading="lazy" decoding="async"></button>`; if (im.cap) h += `<p dir="auto">${linkify(im.cap)}</p>`; } else h += `<p dir="auto">${linkify(m.body)}</p>`; } }
    if (pub) {
      const chips = Object.entries(m.reacts || {}).filter(([, n]) => n > 0).map(([e, n]) => `<button type="button" class="react ${m.my === e ? 'me' : ''}" data-react="${e}">${e}<i>${n}</i></button>`).join('');
      if (chips) h += `<div class="reacts">${chips}</div>`;
    } else if (m.react) h += `<div class="reacts"><button type="button" class="react" data-react="${m.react}">${m.react}</button></div>`;
    h += `<div class="meta">${m.edited ? '<span>معدّلة</span>' : ''}<span>${fmtTime(m.at)}</span>${mine ? tickHTML(m) : ''}</div></div></div>`;
    return h;
  }

  function emptyHTML(c) {
    return c.scope === 'public'
      ? `<div class="empty">${ic('chat')}<b>ابدأ المحادثة</b><span>كن أول من يكتب رسالة في الدردشة العامة.</span></div>`
      : `<div class="empty">${ic('lock')}<b>محادثة خاصة</b><span>أرسل أول رسالة لبدء المحادثة.</span></div>`;
  }
  function renderMsgs(opts = {}) {
    const c = cur(); if (!c) return;
    const oldH = E.msgs.scrollHeight, oldTop = E.msgs.scrollTop;
    const stick = opts.stick ?? (opts.anchor ? false : nearBottom());
    let html = '', lastDay = '';
    if (c.hasMore && c.msgs.length) html += '<div class="loader" id="olderLoader"><div class="spin"></div></div>';
    c.msgs.forEach((m, i) => {
      const d = dayKey(m.at);
      if (d !== lastDay) { html += `<div class="day">${dayLabel(m.at)}</div>`; lastDay = d; }
      if (c.unreadFrom && c.unreadFrom === m.id) html += '<div class="unread-div">رسائل غير مقروءة</div>';
      html += rowHTML(m, c.msgs[i - 1], c.msgs[i + 1]);
    });
    if (!c.msgs.length) html = c.loaded ? emptyHTML(c) : '<div class="loader"><div class="spin"></div></div>';
    E.msgs.innerHTML = html;
    if (opts.anchor) E.msgs.scrollTop = E.msgs.scrollHeight - oldH + oldTop;
    else if (stick) scrollBottom(false);
    else E.msgs.scrollTop = oldTop;
  }
  function patchRow(id) {
    const c = cur(); if (!c) return;
    const i = c.msgs.findIndex(x => x.id === id), node = E.msgs.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (i < 0 || !node) return;
    node.outerHTML = rowHTML(c.msgs[i], c.msgs[i - 1], c.msgs[i + 1]);
  }
  function appendRow(m, forceStick) {
    const c = cur(); if (!c) return;
    const i = c.msgs.length - 1, prev = c.msgs[i - 1];
    const stick = forceStick || nearBottom();
    E.msgs.querySelector('.empty')?.remove();
    let html = '';
    if (!prev || dayKey(prev.at) !== dayKey(m.at)) html += `<div class="day">${dayLabel(m.at)}</div>`;
    html += rowHTML(m, prev, null, true);
    E.msgs.insertAdjacentHTML('beforeend', html);
    if (prev) patchRow(prev.id);
    if (stick) scrollBottom(true);
    else if (m.sid !== S.uid) { c.newCount = (c.newCount || 0) + 1; syncFab(); }
  }
  function syncFab() {
    const c = cur(); const far = E.msgs.scrollHeight - E.msgs.scrollTop - E.msgs.clientHeight > 320;
    E.fab.hidden = !far;
    const n = c?.newCount || 0; E.fabBadge.hidden = !n || !far; E.fabBadge.textContent = String(n);
  }

  /* ───────── الرسائل: تحميل ودمج ───────── */
  function mergeLatest(c, fetched) {
    const oldest = fetched.length ? fetched[0].at : null, newest = fetched.length ? fetched[fetched.length - 1].at : null;
    const have = new Set(fetched.map(f => f.id));
    const pending = c.msgs.filter(m => m.status && !have.has(m.id));
    // نبقي ما هو أقدم من الصفحة، وما وصل لحظيًا بعد لحظة الطلب؛ ونُسقط ما حُذف داخل النافذة
    const kept = oldest ? c.msgs.filter(m => !m.status && !have.has(m.id) && (m.at < oldest || m.at > newest)) : c.msgs.filter(m => !m.status);
    c.msgs = [...kept.filter(m => m.at < (oldest || '9')), ...fetched, ...kept.filter(m => oldest && m.at > newest), ...pending];
  }
  const signature = list => list.map(m => `${m.id}|${m.body}|${m.edited ? 1 : 0}|${m.my || ''}|${m.react || ''}|${m.read ? 1 : 0}|${JSON.stringify(m.reacts || '')}`).join('~');

  /* إن كان هناك طلب جارٍ لنفس المحادثة ننتظره بدل أن نعود فارغين (كان يسبب «العدّاد موجود والرسائل لا تظهر») */
  function loadLatest(c, opts) {
    if (c.pendingLatest) return c.pendingLatest;
    c.pendingLatest = loadLatestRun(c, opts || {}).finally(() => { c.pendingLatest = null; });
    return c.pendingLatest;
  }
  async function loadLatestRun(c, { silent = false } = {}) {
    c.loading = true;
    try {
      const before = signature(c.msgs);
      let rows;
      if (c.scope === 'public') rows = await rpc('chat_list_public_v2', { p_limit: PAGE, p_before: null });
      else rows = await rpc('chat_list_private_messages', { p_thread: c.id, p_limit: PAGE, p_before: null });
      const fetched = (rows || []).map(c.scope === 'public' ? mapPub : mapPriv).reverse();
      c.hasMore = (rows || []).length >= PAGE;
      const wasLoaded = c.loaded;
      mergeLatest(c, fetched); c.loaded = true;
      if (c.scope === 'private' && fetched.some(x => onceOf(x.body))) { rpc('chat_once_state_v2', { p_thread: c.id }).then(st => { let ch = false; (st || []).forEach(r => { if (onceState.get(r.message_id) !== !!r.viewed) ch = true; onceState.set(r.message_id, !!r.viewed); if (r.shot_at && onceShots.get(r.message_id) !== (Number(r.shot_count) || 1)) { ch = true; onceShots.set(r.message_id, Number(r.shot_count) || 1); } }); if (ch && cur() === c) renderMsgs(); }).catch(() => {}); }
      if (c.scope === 'public') { const pin = c.msgs.find(m => m.pinned); if (pin) c.pinned = { id: pin.id, body: pin.body }; }
      if (cur() === c && (!silent || signature(c.msgs) !== before || !wasLoaded)) renderMsgs({ stick: !wasLoaded ? true : undefined });
      if (c.scope === 'public') renderListSoon();
      saveCache();
    } catch (error) {
      console.warn('تعذر تحميل الرسائل', error);
      if (!silent && cur() === c) { c.loaded = true; if (!c.msgs.length) E.msgs.innerHTML = `<div class="empty">${ic('alert')}<b>تعذر تحميل الرسائل</b><button class="btn sm" type="button" data-act="reload">إعادة المحاولة</button></div>`; }
    } finally { c.loading = false; }
  }
  async function loadOlder() {
    const c = cur(); if (!c || c.loading || !c.hasMore || !c.msgs.length) return;
    c.loading = true;
    try {
      const rows = c.scope === 'public'
        ? await rpc('chat_list_public_v2', { p_limit: PAGE, p_before: c.msgs[0].at })
        : await rpc('chat_list_private_messages', { p_thread: c.id, p_limit: PAGE, p_before: c.msgs[0].at });
      const older = (rows || []).map(c.scope === 'public' ? mapPub : mapPriv).reverse();
      c.hasMore = (rows || []).length >= PAGE;
      const have = new Set(c.msgs.map(m => m.id));
      c.msgs = older.filter(m => !have.has(m.id)).concat(c.msgs);
      renderMsgs({ anchor: true });
    } catch (error) { toast('تعذر تحميل الرسائل الأقدم'); } finally { c.loading = false; }
  }

  /* ───────── فتح المحادثات (التوجيه) ───────── */
  function setHeader({ avatar, title, sub, mod, ver, vt }) {
    E.chatAv.innerHTML = avatar;
    E.chatTitle.innerHTML = `${esc(title)}${badgeHTML({ mod, ver, vt })}`;
    E.chatSub.textContent = sub || ''; E.chatSub.classList.remove('typing');
  }
  function statsText() { return S.stats.total ? `${S.stats.total} عضو · ${S.stats.online} متصل الآن` : 'مجتمع الطلاب'; }
  async function loadStats(force) {
    if (!force && Date.now() - S.stats.at < 60000) return;
    try {
      const rows = await rpc('chat_get_stats'); const row = Array.isArray(rows) ? rows[0] : rows;
      if (row) { S.stats = { total: Number(row.total || 0), online: Number(row.online || 0), at: Date.now() }; if (S.view.type === 'public') E.chatSub.textContent = statsText(); saveCache(); }
    } catch (error) { /* اختياري */ }
  }

  function resetComposer() {
    S.replyTo = null; S.editing = null; E.ctx.hidden = true;
    E.sendBtn.classList.remove('edit'); E.sendBtn.innerHTML = ic('send');
  }
  S.blocks = new Map();
  async function loadBlocks() { try { const rows = await rpc('chat_list_blocks'); S.blocks = new Map((rows || []).map(r => [r.user_id, !!r.blocked_by_me])); } catch (e) { /* اختياري */ } applyBlockUI(); }
  function applyBlockUI() {
    const priv = S.view.type === 'private'; E.blockBtn.hidden = !priv;
    const st = priv ? S.blocks.get(S.view.userId) : undefined; const blocked = st !== undefined;
    E.blockBtn.classList.toggle('active', st === true); E.blockBtn.title = st === true ? 'إلغاء الحظر' : 'حظر المستخدم';
    if (priv) { E.input.disabled = blocked; E.input.placeholder = st === true ? 'لقد حظرت هذا المستخدم' : st === false ? 'لا يمكنك مراسلة هذا المستخدم' : 'اكتب رسالة…'; syncSend(); }
  }
  async function toggleBlock() {
    if (S.view.type !== 'private') return; const id = S.view.userId; const was = S.blocks.get(id) === true;
    if (!was && !confirm('حظر هذا المستخدم؟ لن يستطيع أي منكما مراسلة الآخر.')) return;
    try { await rpc('chat_set_block', { p_user: id, p_blocked: !was }); if (was) S.blocks.delete(id); else S.blocks.set(id, true); applyBlockUI(); toast(was ? 'تم إلغاء الحظر' : 'تم حظر المستخدم'); } catch (e) { toast(errText(e)); }
  }
  E.blockBtn.addEventListener('click', toggleBlock);
  function applyPlatform() {
    const pub = S.view.type === 'public';
    const off = pub && S.platform.enabled === false;
    E.input.disabled = off; E.input.placeholder = off ? 'الدردشة متوقفة مؤقتًا' : 'اكتب رسالة…';
    const text = pub && off ? 'الدردشة متوقفة مؤقتًا من قبل الإدارة.' : '';
    E.announce.hidden = !text; E.announce.textContent = text; E.announce.classList.toggle('off', off);
    syncSend(); if (S.view.type === 'private') applyBlockUI(); else E.blockBtn.hidden = true;
  }
  async function loadPlatform() {
    try {
      const data = await rpc('chat_get_platform_settings'); const row = Array.isArray(data) ? data[0] : data;
      if (row) { S.platform = { enabled: row.enabled !== false, announcement: row.announcement || '' }; applyPlatform(); saveCache(); }
    } catch (error) { /* اختياري */ }
  }
  async function refreshPinned() {
    try {
      const rows = await rpc('chat_get_pinned_public'); const row = rows && rows[0];
      S.pub.pinned = row ? { id: row.id, body: row.body, name: row.sender_name } : null;
      S.pub.msgs.forEach(m => { m.pinned = !!row && m.id === row.id; });
      showPinned();
    } catch (error) { /* اختياري */ }
  }
  function showPinned() {
        E.pinnedBar.hidden = true;
  }

  function saveDraft() { const c = cur(); if (c && !S.editing) drafts.set(c.id, E.input.value); }
  function enterConversation() {
    E.chatPane.classList.add('open'); E.listPane.classList.add('behind');
    resetComposer();
    const c = cur(); E.input.value = drafts.get(c.id) || ''; autosize(); syncSend();
    E.msgs.innerHTML = ''; E.fab.hidden = true; c.newCount = 0;
  }

  async function openPublic() {
    saveDraft(); leaveTyping();
    S.view = { type: 'public', userId: null, threadId: null };
    const c = S.pub; enterConversation();
    c.unreadFrom = seenAt ? (c.msgs.find(m => m.sid !== S.uid && m.at > seenAt)?.id || null) : null;
    setHeader({ avatar: brandAvatar('xs'), title: 'دردشة نبض التفوق', sub: statsText() });
    applyPlatform(); showPinned(); renderMsgs({ stick: true }); skelMsgs(c); renderList();
    const done = loadLatest(c, { silent: c.loaded });
    void refreshPinned(); void loadStats();
    await done;
    if (S.view.type !== 'public') return;
    if (seenAt) {
      const first = c.msgs.find(m => m.sid !== S.uid && m.at > seenAt)?.id || null;
      if (first !== c.unreadFrom) { c.unreadFrom = first; renderMsgs({ stick: true }); }
    }
    markPublicSeen();
  }
  const skelMsgs = c => { if (c && !c.loaded && !c.msgs.length) E.msgs.innerHTML = '<div class="msk"><i></i><i class="me"></i><i></i><i class="me"></i><i></i></div>'; };
  function markPublicSeen() {
    const last = S.pub.msgs[S.pub.msgs.length - 1]; if (!last || !S.uid) return;
    try { window.nabdBadges?.seenChat(new Date(last.at).toISOString()); } catch { /* تجاهل */ }
    seenAt = last.at; localStorage.setItem(LS.seen + S.uid, seenAt); renderListSoon();
  }

  async function threadFor(userId) {
    const known = S.convs.find(c => c.other_user_id === userId);
    let threadId = known?.thread_id;
    if (!threadId) {
      const thread = await rpc('chat_get_or_create_thread', { p_other_user: userId });
      threadId = thread?.id; if (!threadId) throw new Error('تعذر فتح المحادثة');
      void loadConvs();
    }
    if (!S.threads.has(threadId)) S.threads.set(threadId, { scope: 'private', id: threadId, otherId: userId, msgs: [], hasMore: true, loaded: false, loading: false, unreadFrom: null, newCount: 0 });
    return S.threads.get(threadId);
  }
  async function openPrivate(userId) {
    saveDraft(); leaveTyping();
    let thread;
    try { thread = await threadFor(userId); } catch (error) { toast(errText(error)); location.hash = '#/'; return; }
    S.view = { type: 'private', userId, threadId: thread.id };
    enterConversation(); showPinned(); applyPlatform();
    const paintHeader = () => {
      const p = S.profiles.get(userId) || {}, conv = S.convs.find(c => c.other_user_id === userId);
      setHeader({ avatar: avatarHTML(userId, p.name || conv?.other_name, 'xs'), title: p.name || conv?.other_name || 'مستخدم', sub: p.stage || 'محادثة خاصة', mod: p.mod || conv?.other_is_moderator, ver: p.ver, vt: p.vt });
    };
    paintHeader(); renderMsgs({ stick: true }); skelMsgs(thread); renderList();
    joinTyping(thread.id);
    void ensureProfiles([userId]).then(() => { if (S.view.userId === userId) paintHeader(); });
    void loadBlocks();
    await loadLatest(thread, { silent: thread.loaded });
    if (S.view.threadId !== thread.id) return;
    thread.unreadFrom = thread.msgs.find(m => m.sid !== S.uid && !m.read)?.id || null;
    renderMsgs({ stick: true });
    markRead(thread);
  }
  async function markRead(thread) {
    const conv = S.convs.find(c => c.thread_id === thread.id);
    if (conv && conv.unread_count) { conv.unread_count = 0; renderListSoon(); }
    thread.msgs.forEach(m => { if (m.sid !== S.uid) m.read = true; });
    try { await rpc('chat_mark_private_thread_read', { p_thread_id: thread.id }); } catch (error) { /* يعاد لاحقًا */ }
  }
  const markReadSoon = debounce(() => { const c = cur(); if (c?.scope === 'private' && document.visibilityState === 'visible') void markRead(c); }, 350);

  function showList() {
    saveDraft(); leaveTyping(); closeMenu();
    S.view = { type: 'list', userId: null, threadId: null };
    E.chatPane.classList.remove('open'); E.listPane.classList.remove('behind');
    const c = S.pub; c.unreadFrom = null;
    resetComposer(); renderList();
    if (matchMedia('(min-width:900px)').matches) { E.msgs.innerHTML = ''; E.chatTitle.textContent = ''; E.chatSub.textContent = ''; E.chatAv.innerHTML = ''; E.pinnedBar.hidden = true; E.announce.hidden = true; }
  }
  function route() {
    const hash = location.hash || '#/';
    if (hash.startsWith('#/u/')) return void openPrivate(decodeURIComponent(hash.slice(4)));
    if (hash === '#/public') return void openPublic();
    showList();
  }
  window.addEventListener('hashchange', route);
  let navigated = false; window.addEventListener('hashchange', () => { navigated = true; });
  const goBack = () => { if (navigated && history.length > 1) history.back(); else location.hash = '#/'; };

  /* ───────── المؤلّف ───────── */
  function autosize() { E.input.style.height = 'auto'; E.input.style.height = `${Math.min(140, E.input.scrollHeight)}px`; }
  function syncSend() { E.sendBtn.disabled = E.input.disabled || (!E.input.value.trim() && !pendImg); const n = E.input.value.length; E.counter.hidden = n < 850; E.counter.textContent = `${n}/1000`; E.counter.classList.toggle('warn', n >= 980); }
  let pendImg = null;
  const clearImg = () => { if (pendImg) URL.revokeObjectURL(pendImg.prev); pendImg = null; $('#imgPrev').hidden = true; $('#imgFile').value = ''; syncSend(); };
  const shrink = file => new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const k = Math.min(1, 1280 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => b ? res(b) : rej(new Error('تعذر معالجة الصورة')), 'image/jpeg', .82); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('ملف الصورة غير صالح')); }; im.src = url;
  });
  $('#attachBtn').addEventListener('click', () => { if (S.editing) return; $('#imgFile').click(); });
  $('#imgPrevX').addEventListener('click', clearImg);
  $('#onceToggle').addEventListener('click', () => { if (!pendImg) return; pendImg.once = !pendImg.once; $('#onceToggle').classList.toggle('on', pendImg.once); $('#onceToggle').setAttribute('aria-pressed', String(pendImg.once)); });
  $('#imgFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) { e.target.value = ''; return toast('اختر ملف صورة'); }
    try { const blob = await shrink(f); pendImg = { blob, prev: URL.createObjectURL(blob), once: false }; { const t = $('#onceToggle'); t.hidden = S.view.type !== 'private'; t.classList.remove('on'); t.setAttribute('aria-pressed', 'false'); } $('#imgPrevImg').src = pendImg.prev; $('#imgPrev').hidden = false; syncSend(); E.input.focus(); }
    catch (err) { toast(err.message || 'تعذر قراءة الصورة'); e.target.value = ''; }
  });
  async function uploadOnceImage(blob) {
    const path = `${S.uid}/${uuid()}.jpg`;
    const { error } = await sb.storage.from('chat-once').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error; return path;
  }
  async function uploadChatImage(blob) {
    const path = `chat/${S.uid}/${uuid()}.jpg`;
    const { error } = await sb.storage.from('nabd').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (error) throw error;
    return sb.storage.from('nabd').getPublicUrl(path).data.publicUrl;
  }
  const isTouch = matchMedia('(pointer:coarse)').matches;
  let lastTypingSent = 0;
  E.input.addEventListener('input', () => {
    autosize(); syncSend();
    if (typingChan && Date.now() - lastTypingSent > 2500 && E.input.value.trim()) { lastTypingSent = Date.now(); typingChan.send({ type: 'broadcast', event: 'typing', payload: { uid: S.uid } }); }
  });
  E.input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !isTouch && !event.isComposing) { event.preventDefault(); E.composer.requestSubmit(); } });
  E.input.addEventListener('focus', () => { setTimeout(() => { if (S.atBottom) scrollBottom(false); }, 250); });
  E.composer.addEventListener('submit', event => { event.preventDefault(); let text = E.input.value.trim(); text = window.nabdMentions ? window.nabdMentions.encode(E.input, text) : text; if (text.length > 1000) return toast('الرسالة طويلة بسبب الإشارات'); if (!text && !pendImg) return; if (S.editing) return void submitEdit(text);
    if (!pendImg) return void sendMessage(text);
    const img = pendImg; E.sendBtn.disabled = true; toast('جارٍ رفع الصورة…');
    const once = img.once && S.view.type === 'private';
    (once ? uploadOnceImage(img.blob) : uploadChatImage(img.blob)).then(ref => { clearImg(); void sendMessage(`[[${once ? 'once' : 'img'}:${ref}]]${text ? '\n' + text : ''}`.slice(0, 1000), once ? { once: ref } : {}); }).catch(err => { syncSend(); toast(errText(err)); });
  });
  let onceView = null;
  async function openOnce(id, btn) {
    if (onceView) return; btn.disabled = true; try { await window.NabdScreenGuard?.refresh?.(true); } catch { /* تجاهل */ }
    try {
      const path = await rpc('chat_once_open', { p_message: id });
      const { data, error } = await sb.storage.from('chat-once').createSignedUrl(path, 60); if (error) throw error;
      const blob = await (await fetch(data.signedUrl)).blob(); const url = URL.createObjectURL(blob);
      onceState.set(id, true);
      const v = document.createElement('div'); v.className = 'once-view'; v.oncontextmenu = ev => ev.preventDefault();
      v.innerHTML = `<div class="once-top"><span>👁 صورة لمرة واحدة</span><button type="button" data-once-close aria-label="إغلاق">✕</button></div><div class="once-img" style="background-image:url('${url}')"></div>`;
      document.body.appendChild(v); onceView = { id, url, el: v, reported: false };
      { const pol = window.NabdScreenGuard?.policy?.() || {}; if (pol.chat_once !== false) { try { window.NabdAndroid?.setSecureScreen?.(true); } catch { /* تجاهل */ } try { window.Capacitor?.Plugins?.PrivacyScreen?.enable?.(); } catch { /* تجاهل */ } onceView.lock = true; } }
      renderMsgs();
    } catch (err) {
      btn.disabled = false;
      if (err?.code === 'P0003') { onceState.set(id, true); renderMsgs(); toast('فُتحت هذه الصورة سابقًا'); } else toast(errText(err));
    }
  }
  function closeOnce() { if (!onceView) return; URL.revokeObjectURL(onceView.url); onceView.el.remove(); onceView = null; try { window.NabdScreenGuard?.apply?.(); } catch { /* تجاهل */ } }
  async function reportShot() { if (!onceView || onceView.reported) return; onceView.reported = true; try { await rpc('chat_once_report_screenshot', { p_message: onceView.id }); } catch (e) { console.warn(e); } }
  window.nabdMentions?.attach(E.input, { exclude: ['chat'], people: () => [...S.profiles.keys()].filter(id => id !== S.uid).map(id => ({ id, name: nameOf(id) })) });
  window.addEventListener('nabd-mention-user', e => { e.preventDefault(); if (e.detail && e.detail !== S.uid) void profileSheet(e.detail); });
  window.nabdScreenshotDetected = () => { void reportShot(); };
  document.addEventListener('keyup', e => { if (!onceView) return; const k = e.key; if (k === 'PrintScreen' || (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(k)) || (e.metaKey && e.shiftKey && (k === 's' || k === 'S'))) void reportShot(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) closeOnce(); });
  window.addEventListener('blur', () => closeOnce());
  document.addEventListener('click', e => { if (e.target.closest?.('[data-once-close]')) { closeOnce(); return; } const o = e.target.closest?.('[data-once]'); if (o) void openOnce(o.dataset.once, o); });
  document.addEventListener('click', e => { const b = e.target.closest?.('.msg-img'); if (!b) return; const v = document.createElement('div'); v.className = 'img-view'; v.innerHTML = `<img src="${esc(b.dataset.img)}" alt="">`; v.onclick = () => v.remove(); document.body.appendChild(v); });

  function setContext(kind, msg) {
    E.ctx.hidden = false;
    E.ctxTitle.textContent = kind === 'edit' ? 'تعديل الرسالة' : `رد على ${msg.sid === S.uid ? 'نفسك' : nameOf(msg.sid)}`;
    E.ctxText.textContent = plain(msg.body);
    E.ctxIc.innerHTML = kind === 'edit' ? IC.edit : IC.reply;
  }
  $('#ctxCancel').addEventListener('click', () => { const wasEdit = !!S.editing; resetComposer(); if (wasEdit) { E.input.value = ''; autosize(); syncSend(); } });
  function startReply(msg) { S.editing = null; S.replyTo = msg; setContext('reply', msg); E.sendBtn.classList.remove('edit'); E.sendBtn.innerHTML = ic('send'); E.input.focus(); }
  function startEdit(msg) { if (imgOf(msg.body)) return toast('لا يمكن تعديل رسالة صورة'); S.replyTo = null; S.editing = msg; setContext('edit', msg); E.input.value = window.nabdMentions ? window.nabdMentions.decode(E.input, msg.body) : msg.body; autosize(); syncSend(); E.sendBtn.classList.add('edit'); E.sendBtn.innerHTML = ic('check'); E.input.focus(); }

  async function sendMessage(text, opts = {}) {
    const c = cur(); if (!c) return;
    const reply = S.replyTo;
    const m = { id: uuid(), scope: c.scope, sid: S.uid, body: text, at: new Date().toISOString(), status: 'sending', edited: false, rid: reply?.id || null, rbody: reply?.body || null, rname: reply ? (reply.sid === S.uid ? 'أنت' : nameOf(reply.sid)) : null, rsid: reply?.sid || null, reacts: {}, my: null, read: false, react: null };
    if (c.scope === 'public' && !S.platform.enabled) return toast('الدردشة متوقفة مؤقتًا');
    E.input.value = ''; drafts.delete(c.id); autosize(); syncSend(); resetComposer();
    c.msgs.push(m); appendRow(m, true);
    if (c.scope === 'public') seenAt = m.at;
    await deliver(c, m);
    if (opts.once && !m.status) { try { await rpc('chat_once_register', { p_message: m.id, p_path: opts.once }); } catch (e) { console.warn('تعذر تسجيل الصورة', e); } }
  }
  async function deliver(c, m) {
    m.status = 'sending'; patchRow(m.id);
    try {
      if (c.scope === 'public') {
        const { error } = await sb.from('public_chat_messages').insert({ id: m.id, sender_id: S.uid, body: m.body, reply_to_id: m.rid });
        if (error && error.code !== '23505') throw error;
        if (!error) window.nabdPoints?.award('chat_message');
      } else {
        const row = await rpc('chat_send_private_v2', { p_thread_id: c.id, p_body: m.body, p_reply_to: m.rid, p_id: m.id });
        if (row?.created_at) m.at = row.created_at;
        window.nabdPoints?.award('chat_message');
        const conv = S.convs.find(x => x.thread_id === c.id);
        if (conv) { conv.last_message = m.body; conv.last_sender_id = S.uid; conv.last_message_at = m.at; S.convs.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)); }
      }
      m.status = null; patchRow(m.id); renderListSoon(); saveCache();
    } catch (error) {
      m.status = 'failed'; patchRow(m.id); toast(errText(error));
    }
  }
  async function submitEdit(text) {
    const m = S.editing, c = cur(); resetComposer(); E.input.value = ''; autosize(); syncSend();
    if (!m || !c || text === m.body) return;
    const old = { body: m.body, edited: m.edited };
    m.body = text; m.edited = true; patchRow(m.id);
    try { await rpc('chat_edit_message', { p_scope: c.scope, p_id: m.id, p_body: text }); renderListSoon(); }
    catch (error) { m.body = old.body; m.edited = old.edited; patchRow(m.id); toast(errText(error)); }
  }

  /* ───────── تفاعلات / حذف / تثبيت ───────── */
  async function react(m, emoji) {
    const c = cur(); if (!c) return;
    const snapshot = { reacts: { ...(m.reacts || {}) }, my: m.my, react: m.react };
    if (c.scope === 'public') {
      if (m.my) { m.reacts[m.my] = Math.max(0, (m.reacts[m.my] || 1) - 1); }
      m.my = m.my === emoji ? null : emoji;
      if (m.my) m.reacts[emoji] = (m.reacts[emoji] || 0) + 1;
    } else m.react = m.react === emoji ? null : emoji;
    patchRow(m.id);
    try { await rpc('chat_react', { p_scope: c.scope, p_id: m.id, p_emoji: emoji }); }
    catch (error) { Object.assign(m, snapshot); patchRow(m.id); toast(errText(error)); }
  }
  function removeLocal(scope, id, threadId) {
    const c = scope === 'public' ? S.pub : S.threads.get(threadId);
    if (!c) return;
    const i = c.msgs.findIndex(m => m.id === id); if (i < 0) return;
    c.msgs.splice(i, 1);
    if (cur() === c) renderMsgs();
    renderListSoon(); saveCache();
  }
  async function deleteMessage(m) {
    const c = cur(); if (!c) return;
    try {
      if (m.sid === S.uid) await rpc('chat_delete_message', { p_scope: c.scope, p_id: m.id });
      else await rpc('chat_moderate_delete_message', { p_message: m.id });
      removeLocal(c.scope, m.id, c.id);
      const target = c.scope === 'public' ? chan : typingChan;
      target?.send({ type: 'broadcast', event: 'del', payload: { id: m.id, scope: c.scope, thread: c.id } });
      if (c.scope === 'private') void loadConvs();
    } catch (error) { toast(errText(error)); }
  }
  async function togglePin(m) {
    try { await rpc('chat_toggle_pin', { p_message: m.id, p_pinned: !m.pinned }); await refreshPinned(); toast(m.pinned ? 'تم تثبيت الرسالة' : 'أُلغي التثبيت'); }
    catch (error) { toast(errText(error)); }
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('تم النسخ'); }
    catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('تم النسخ'); } catch { toast('تعذر النسخ'); } t.remove(); }
  }

  function messageSheet(m) {
    const c = cur(); if (!c || m.status) return;
    const mine = m.sid === S.uid, pub = c.scope === 'public';
    const current = pub ? m.my : m.react;
    let html = `<div class="emoji-row">${EMOJIS.map(e => `<button type="button" data-emoji="${e}" class="${current === e ? 'on' : ''}">${e}</button>`).join('')}</div>`;
    html += `<button class="opt" type="button" data-act="reply">${ic('reply')}<span class="grow">رد</span></button>`;
    html += `<button class="opt" type="button" data-act="copy">${ic('copy')}<span class="grow">نسخ النص</span></button>`;
    if (mine) html += `<button class="opt" type="button" data-act="edit">${ic('edit')}<span class="grow">تعديل</span></button>`;
    if (pub && S.canMod) html += `<button class="opt" type="button" data-act="pin">${ic('pin')}<span class="grow">${m.pinned ? 'إلغاء التثبيت' : 'تثبيت الرسالة'}</span></button>`;
    if (mine || (pub && S.canMod)) html += `<button class="opt danger" type="button" data-act="delete">${ic('trash')}<span class="grow">حذف</span></button>`;
    openSheet(html);
    E.sheet.onclick = event => {
      const emoji = event.target.closest('[data-emoji]')?.dataset.emoji;
      if (emoji) return closeSheet(() => void react(m, emoji));
      const act = event.target.closest('[data-act]')?.dataset.act; if (!act) return;
      if (act === 'reply') closeSheet(() => startReply(m));
      else if (act === 'copy') closeSheet(() => void copyText(m.body));
      else if (act === 'edit') closeSheet(() => startEdit(m));
      else if (act === 'pin') closeSheet(() => void togglePin(m));
      else if (act === 'delete') {
        setSheet(`<h3>حذف الرسالة؟</h3><p style="margin:0 20px 10px;color:var(--muted);font-size:14px">${mine ? 'ستُحذف الرسالة للجميع.' : 'ستُحذف رسالة هذا المستخدم من الدردشة.'}</p><button class="opt danger" type="button" data-act="confirm-delete">${ic('trash')}<span class="grow">حذف نهائيًا</span></button><button class="opt" type="button" data-act="cancel"><span class="grow">إلغاء</span></button>`);
      } else if (act === 'confirm-delete') closeSheet(() => void deleteMessage(m));
      else if (act === 'cancel') closeSheet();
    };
  }

  /* ───────── الملف الشخصي والطلبات والإعدادات ───────── */
  async function profileSheet(userId) {
    if (!userId) return;
    await ensureProfiles([userId]);
    const p = S.profiles.get(userId); if (!p) return toast('معلومات هذا الطالب غير متاحة');
    const self = userId === S.uid, inThread = S.view.type === 'private' && S.view.userId === userId;
    openSheet(`<div class="profile-sheet">${avatarHTML(userId, p.name, 'xl')}<h3>${esc(p.name || 'طالب')}${badgeHTML(p)}</h3><div class="sub">${esc([p.stage, p.province].filter(Boolean).join(' · ') || 'نبض التفوق')}</div><p>${esc(p.bio || 'لا توجد نبذة مضافة.')}</p>${self || inThread ? '' : `<button class="btn block" type="button" id="startPrivate">${ic('lock')} مراسلة خاصة</button>`}</div>`);
    E.sheet.onclick = event => { if (event.target.closest('#startPrivate')) closeSheet(() => { location.hash = `#/u/${encodeURIComponent(userId)}`; }); };
  }

  async function loadRequests() {
    try {
      const { data, error } = await sb.from('private_chat_requests').select('id,sender_id,created_at').eq('recipient_id', S.uid).eq('status', 'pending').order('created_at', { ascending: false });
      if (error) throw error;
      S.requests = data || []; await ensureProfiles(S.requests.map(r => r.sender_id)); renderList();
    } catch (error) { console.warn('تعذر تحميل الطلبات', error); }
  }
  function requestsSheet() {
    const rows = S.requests.map(r => { const p = S.profiles.get(r.sender_id) || {}; return `<div class="req">${avatarHTML(r.sender_id, p.name, 'xs')}<div class="body"><b>${esc(p.name || 'طالب')}</b><small>${esc(p.stage || 'طالب')} · يريد مراسلتك</small></div><button class="btn sm" type="button" data-accept="${esc(r.id)}" data-from="${esc(r.sender_id)}">قبول</button><button class="btn sm ghost" type="button" data-reject="${esc(r.id)}">رفض</button></div>`; }).join('');
    openSheet(`<h3>طلبات الدردشة الخاصة</h3>${rows || `<div class="empty">${ic('bell')}<span>لا توجد طلبات جديدة.</span></div>`}`);
    E.sheet.onclick = async event => {
      const accept = event.target.closest('[data-accept]'), reject = event.target.closest('[data-reject]');
      const button = accept || reject; if (!button) return;
      const id = (accept || reject).dataset.accept || reject.dataset.reject;
      try {
        await rpc('chat_respond_private_request', { p_request: id, p_accept: !!accept });
        S.requests = S.requests.filter(r => r.id !== id); renderList();
        if (accept) { void loadConvs(); closeSheet(() => { location.hash = `#/u/${encodeURIComponent(accept.dataset.from)}`; }); }
        else { toast('تم رفض الطلب'); S.requests.length ? requestsSheet() : closeSheet(); }
      } catch (error) { toast(errText(error)); }
    };
  }
  async function loadSettings() {
    try {
      const { data } = await sb.from('chat_settings').select('private_chat_enabled,chat_notifications_enabled').eq('user_id', S.uid).maybeSingle();
      if (data) { S.settings.privateOn = data.private_chat_enabled !== false; S.settings.notices = data.chat_notifications_enabled !== false; }
    } catch (error) { /* اختياري */ }
  }
  function settingsSheet() {
    openSheet(`<h3>إعدادات الدردشة</h3>
      <label class="switch-row"><span class="grow"><b>السماح بالدردشة الخاصة</b><small>يمكن للطلاب مراسلتك خاصةً</small></span><input class="sw" type="checkbox" id="swPrivate" ${S.settings.privateOn ? 'checked' : ''}></label>
      <label class="switch-row"><span class="grow"><b>إشعارات الدردشة</b><small>تنبيه عند وصول رسالة جديدة</small></span><input class="sw" type="checkbox" id="swNotices" ${S.settings.notices ? 'checked' : ''}></label>
      <p style="margin:6px 20px 8px;color:var(--muted);font-size:12.5px">الاسم والصورة والنبذة تُجلب من ملفك الشخصي.</p>
      <a class="opt" href="profile.html">${ic('user')}<span class="grow">تعديل ملفي الشخصي</span></a>`);
    E.sheet.onchange = async event => {
      const on = event.target.checked;
      if (event.target.id === 'swPrivate') S.settings.privateOn = on; else if (event.target.id === 'swNotices') S.settings.notices = on; else return;
      const { error } = await sb.from('chat_settings').upsert({ user_id: S.uid, private_chat_enabled: S.settings.privateOn, chat_notifications_enabled: S.settings.notices, updated_at: new Date().toISOString() });
      toast(error ? 'تعذر حفظ الإعداد' : 'تم الحفظ');
    };
    E.sheet.onclick = null;
  }

  /* ───────── اللحظي (Realtime) ───────── */
  function joinTyping(threadId) {
    leaveTyping();
    typingChan = sb.channel(`thread-${threadId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.uid === S.uid || S.view.threadId !== threadId) return;
        E.chatSub.textContent = 'يكتب…'; E.chatSub.classList.add('typing');
        clearTimeout(joinTyping.t);
        joinTyping.t = setTimeout(() => { E.chatSub.classList.remove('typing'); E.chatSub.textContent = S.profiles.get(S.view.userId)?.stage || 'محادثة خاصة'; }, 3500);
      })
      .on('broadcast', { event: 'del' }, ({ payload }) => { if (payload?.id) removeLocal('private', payload.id, threadId); })
      .subscribe();
  }
  function leaveTyping() { if (typingChan) { sb.removeChannel(typingChan); typingChan = null; } }

  const reactTimers = new Map();
  function refreshReacts(id) {
    clearTimeout(reactTimers.get(id));
    reactTimers.set(id, setTimeout(async () => {
      const m = S.pub.msgs.find(x => x.id === id); if (!m) return;
      const { data, error } = await sb.from('public_chat_reactions').select('user_id,reaction').eq('message_id', id);
      if (error) return;
      m.reacts = {}; m.my = null;
      (data || []).forEach(r => { m.reacts[r.reaction] = (m.reacts[r.reaction] || 0) + 1; if (r.user_id === S.uid) m.my = r.reaction; });
      if (S.view.type === 'public') patchRow(id);
    }, 150));
  }

  async function onPublicInsert(payload) {
    const r = payload.new; if (!r || r.deleted_at || S.pub.msgs.some(m => m.id === r.id)) return;
    await ensureProfiles([r.sender_id]);
    if (S.pub.msgs.some(m => m.id === r.id)) return;
    const reply = r.reply_to_id ? S.pub.msgs.find(m => m.id === r.reply_to_id) : null;
    const m = { id: r.id, scope: 'public', sid: r.sender_id, body: r.body, at: r.created_at, edited: false, pinned: false, rid: r.reply_to_id, rbody: reply?.body || null, rname: reply ? nameOf(reply.sid) : null, reacts: {}, my: null };
    S.pub.msgs.push(m);
    if (S.view.type === 'public') { appendRow(m, r.sender_id === S.uid); if (document.visibilityState === 'visible' && nearBottom()) markPublicSeen(); }
    else if (r.sender_id !== S.uid && S.settings.notices && document.visibilityState === 'visible') { /* عدّاد القائمة يكفي */ }
    renderListSoon(); saveCache();
  }
  function onPublicUpdate(payload) {
    const r = payload.new; if (!r) return;
    const m = S.pub.msgs.find(x => x.id === r.id); if (!m) return;
    if (r.deleted_at) return removeLocal('public', r.id);
    const changed = m.body !== r.body;
    m.body = r.body; m.edited = !!r.edited_at;
    if (!!r.pinned_at !== !!m.pinned) void refreshPinned();
    if (changed && S.view.type === 'public') patchRow(m.id);
    renderListSoon();
  }
  async function onPrivateInsert(payload) {
    const r = payload.new; if (!r) return;
    const thread = S.threads.get(r.thread_id);
    const conv = S.convs.find(c => c.thread_id === r.thread_id);
    const incoming = r.sender_id !== S.uid;
    if (!conv) { await loadConvs(); } else {
      conv.last_message = r.body; conv.last_sender_id = r.sender_id; conv.last_message_at = r.created_at;
      const open = S.view.type === 'private' && S.view.threadId === r.thread_id && document.visibilityState === 'visible';
      if (incoming && !open) conv.unread_count = Number(conv.unread_count || 0) + 1;
      S.convs.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
    }
    if (thread && !thread.msgs.some(m => m.id === r.id)) {
      const reply = r.reply_to_id ? thread.msgs.find(m => m.id === r.reply_to_id) : null;
      const m = { id: r.id, scope: 'private', sid: r.sender_id, body: r.body, at: r.created_at, edited: false, read: false, react: null, rid: r.reply_to_id, rbody: reply?.body || null, rsid: reply?.sid || null };
      thread.msgs.push(m);
      if (S.view.type === 'private' && S.view.threadId === r.thread_id) { appendRow(m, !incoming); if (incoming) markReadSoon(); }
    }
    if (incoming && !(S.view.type === 'private' && S.view.threadId === r.thread_id) && S.settings.notices && document.visibilityState === 'visible') {
      toast(`${conv?.other_name || 'رسالة جديدة'}: ${String(r.body).slice(0, 60)}`);
    }
    renderListSoon(); saveCache();
  }
  function onPrivateUpdate(payload) {
    const r = payload.new; if (!r) return;
    const thread = S.threads.get(r.thread_id); const m = thread?.msgs.find(x => x.id === r.id); if (!m) return;
    m.read = !!r.read_at; m.react = r.reaction || null;
    const changed = m.body !== r.body; m.body = r.body; m.edited = !!r.edited_at;
    if (S.view.threadId === r.thread_id) patchRow(m.id);
    if (changed) void loadConvs();
  }

  function startRealtime() {
    if (chan || !sb || !S.uid) return;
    chan = sb.channel('nabd-chat-v2', { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'public_chat_messages' }, onPublicInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'public_chat_messages' }, onPublicUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'public_chat_reactions' }, p => { const id = p.new?.message_id || p.old?.message_id; if (id && S.pub.msgs.some(m => m.id === id)) refreshReacts(id); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_chat_messages' }, onPrivateInsert)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'private_chat_messages' }, onPrivateUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_chat_requests', filter: `recipient_id=eq.${S.uid}` }, () => void loadRequests())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_platform_settings' }, () => void loadPlatform())
      .on('broadcast', { event: 'del' }, ({ payload }) => { if (payload?.id && payload.scope === 'public') removeLocal('public', payload.id); })
      .subscribe(status => { if (status === 'SUBSCRIBED') { if (startRealtime.wasDown) reconcile(); startRealtime.wasDown = false; } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') startRealtime.wasDown = true; });
  }

  /* مطابقة دورية تلتقط ما لا يصل لحظيًا (الحذف الناعم، انقطاع الشبكة) */
  let reconciling = false;
  async function reconcile() {
    if (reconciling || document.visibilityState !== 'visible' || !S.uid) return;
    reconciling = true;
    try {
      await Promise.allSettled([loadLatest(S.pub, { silent: true }), loadConvs(), loadPlatform(), loadRequests()]);
      const c = cur(); if (c?.scope === 'private') { await loadLatest(c, { silent: true }); markReadSoon(); }
      if (S.view.type === 'public') void refreshPinned();
    } finally { reconciling = false; }
  }
  setInterval(reconcile, 45000);
  /* احتياطي سريع: إن تأخر الوصول اللحظي نجلب آخر الرسائل بسرعة */
  let fastBusy = false;
  setInterval(async () => {
    if (fastBusy || document.visibilityState !== 'visible' || !S.uid) return; const c = cur(); if (!c) return;
    fastBusy = true;
    try { await loadLatest(c, { silent: true }); if (c.scope === 'private') markReadSoon(); } catch { /* تجاهل */ } finally { fastBusy = false; }
  }, 4000);
  setInterval(() => { if (document.visibilityState === 'visible' && S.uid && S.view.type === 'list') void loadConvs(); }, 8000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { reconcile(); markReadSoon(); if (S.view.type === 'public' && nearBottom()) markPublicSeen(); } });
  window.addEventListener('online', reconcile);

  /* ───────── التفاعل مع الرسائل (نقر، ضغط مطوّل، سحب للرد) ───────── */
  E.msgs.addEventListener('scroll', () => {
    S.atBottom = nearBottom();
    const c = cur(); if (S.atBottom && c) { c.newCount = 0; if (c.scope === 'public') markPublicSeen(); }
    syncFab();
    if (E.msgs.scrollTop < 260) void loadOlder();
  }, { passive: true });
  E.fab.addEventListener('click', () => { const c = cur(); if (c) c.newCount = 0; scrollBottom(true); });

  const findMsg = id => cur()?.msgs.find(m => m.id === id);
  let press = null, suppressClick = false, lastTap = { id: '', at: 0 };
  E.msgs.addEventListener('pointerdown', event => {
    const row = event.target.closest('.row'); if (!row || event.target.closest('a,[data-retry]')) { press = null; return; }
    press = { row, id: row.dataset.id, x: event.clientX, y: event.clientY, dx: 0, swiping: false, timer: null };
    press.timer = setTimeout(() => { if (!press) return; suppressClick = true; navigator.vibrate?.(12); const m = findMsg(press.id); press = null; if (m) messageSheet(m); }, 480);
  });
  E.msgs.addEventListener('pointermove', event => {
    if (!press) return;
    const dx = event.clientX - press.x, dy = event.clientY - press.y;
    if (!press.swiping && (Math.abs(dy) > 10 || Math.abs(dx) > 10)) { clearTimeout(press.timer); if (Math.abs(dx) > Math.abs(dy) * 1.4) press.swiping = true; else { press = null; return; } }
    if (press.swiping) { press.dx = dx; press.row.style.transform = `translateX(${Math.max(-72, Math.min(72, dx * 0.6))}px)`; }
  });
  const endPress = event => {
    if (!press) return;
    clearTimeout(press.timer);
    const p = press; press = null;
    if (p.swiping) {
      p.row.style.transition = 'transform .18s'; p.row.style.transform = '';
      setTimeout(() => { p.row.style.transition = ''; }, 200);
      suppressClick = true;
      if (Math.abs(p.dx) >= 70) { const m = findMsg(p.id); if (m && !m.status) { navigator.vibrate?.(8); startReply(m); } }
      return;
    }
    if (event.type === 'pointerup' && !suppressClick) {
      const now = Date.now();
      if (lastTap.id === p.id && now - lastTap.at < 320) { const m = findMsg(p.id); if (m && !m.status) void react(m, '❤️'); lastTap = { id: '', at: 0 }; } else lastTap = { id: p.id, at: now };
    }
  };
  E.msgs.addEventListener('pointerup', endPress);
  E.msgs.addEventListener('pointercancel', endPress);
  // يُعاد ضبط منع النقر بعد الضغط المطوّل حتى لا يبتلع نقرة لاحقة مشروعة
  // على مستوى المستند: عند فتح الورقة يُرفع الإصبع فوق الطبقة المعتمة فلا يصل الحدث إلى #msgs
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, () => setTimeout(() => { suppressClick = false; }, 350), true));
  E.msgs.addEventListener('contextmenu', event => { const row = event.target.closest('.row'); if (!row) return; event.preventDefault(); if (sheetOpen) return; const m = findMsg(row.dataset.id); if (m) messageSheet(m); });
  E.msgs.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; return; }
    const profile = event.target.closest('[data-profile]'); if (profile) return void profileSheet(profile.dataset.profile);
    const chip = event.target.closest('[data-react]'); if (chip) { const m = findMsg(chip.closest('.row').dataset.id); if (m) void react(m, chip.dataset.react); return; }
    const retry = event.target.closest('[data-retry]'); if (retry) { const m = findMsg(retry.dataset.retry); if (m) void deliver(cur(), m); return; }
    const quote = event.target.closest('[data-goto]'); if (quote) return void gotoMessage(quote.dataset.goto);
    if (event.target.closest('[data-act="reload"]')) void loadLatest(cur());
  });
  function gotoMessage(id) {
    const node = id && E.msgs.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!node) return toast('الرسالة الأصلية غير محمّلة');
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.classList.add('flash'); setTimeout(() => node.classList.remove('flash'), 1300);
  }
  E.pinnedBar.addEventListener('click', () => { if (S.pub.pinned) gotoMessage(S.pub.pinned.id); });
  $('#chatWho').addEventListener('click', () => { if (S.view.type === 'private') void profileSheet(S.view.userId); });
  $('#backBtn').addEventListener('click', goBack);

  /* ───────── قائمة المحادثات: أحداث ───────── */
  /* ───────── حذف المحادثات الخاصة (لدي أنا فقط) عبر التحديد ───────── */
  function ensureSelBar() {
    let bar = $('#selBar'); if (bar) return bar;
    bar = document.createElement('div'); bar.id = 'selBar'; bar.className = 'selbar'; bar.hidden = true;
    bar.innerHTML = '<button type="button" id="selCancel" aria-label="إلغاء">✕</button><b id="selCount">0</b><span style="flex:1">محدد</span><button type="button" id="selAll">تحديد الكل</button><button type="button" id="selDel" class="danger" aria-label="حذف">🗑 حذف</button>';
    $('#listPane').prepend(bar); return bar;
  }
  function paintSel() { const bar = ensureSelBar(); bar.hidden = !S.selMode; $('#selCount').textContent = String(S.sel.size); $('#selDel').disabled = !S.sel.size; renderList(); }
  function enterSelect(firstId) { S.selMode = true; S.sel = new Set(firstId ? [firstId] : []); paintSel(); }
  function exitSelect() { S.selMode = false; S.sel = new Set(); paintSel(); }
  async function deleteSelected() {
    const users = [...S.sel]; if (!users.length) return;
    if (!confirm(users.length === 1 ? 'حذف هذه المحادثة من عندك؟ لن تُحذف من عند الطرف الآخر.' : `حذف ${users.length} محادثات من عندك؟ لن تُحذف من عند الطرف الآخر.`)) return;
    const ids = S.convs.filter(c => S.sel.has(c.other_user_id)).map(c => c.thread_id);
    try {
      await rpc('chat_delete_private_threads', { p_threads: ids });
      ids.forEach(id => S.threads.delete(id)); S.convs = S.convs.filter(c => !S.sel.has(c.other_user_id));
      saveCache(); exitSelect(); toast('تم حذف المحادثات');
      if (S.view.type === 'private' && users.includes(S.view.userId)) location.hash = '#/';
      void loadConvs().then(() => renderList()); window.nabdBadges?.refresh?.();
    } catch (error) { toast('تعذر حذف المحادثات'); }
  }
  let pressT = null, pressed = false;
  E.convList.addEventListener('pointerdown', event => { const row = event.target.closest('.conv[data-open]'); if (!row || row.dataset.open === 'public' || S.selMode) return; pressed = false; clearTimeout(pressT); pressT = setTimeout(() => { pressed = true; try { navigator.vibrate?.(20); } catch { /* تجاهل */ } enterSelect(row.dataset.open); }, 480); });
  ['pointerup', 'pointerleave', 'pointercancel', 'scroll'].forEach(ev => E.convList.addEventListener(ev, () => clearTimeout(pressT), true));
  E.convList.addEventListener('contextmenu', event => { if (event.target.closest('.conv[data-open]')) event.preventDefault(); });
  document.addEventListener('click', event => {
    if (event.target.closest('#selCancel')) exitSelect();
    else if (event.target.closest('#selAll')) { S.sel = S.sel.size === S.convs.length ? new Set() : new Set(S.convs.map(c => c.other_user_id)); paintSel(); }
    else if (event.target.closest('#selDel')) void deleteSelected();
  });
  E.convList.addEventListener('click', event => {
    const open = event.target.closest('[data-open]');
    if (pressed) { pressed = false; event.preventDefault(); return; }
    if (S.selMode && open) { if (open.dataset.open === 'public') return; S.sel.has(open.dataset.open) ? S.sel.delete(open.dataset.open) : S.sel.add(open.dataset.open); if (!S.sel.size) exitSelect(); else paintSel(); return; }
    if (open) { location.hash = open.dataset.open === 'public' ? '#/public' : `#/u/${encodeURIComponent(open.dataset.open)}`; return; }
    if (event.target.closest('[data-act="requests"]')) requestsSheet();
  });
  $('#searchToggle').addEventListener('click', () => {
    E.searchBar.hidden = !E.searchBar.hidden;
    if (E.searchBar.hidden) { S.search = ''; E.searchInput.value = ''; renderList(); } else E.searchInput.focus();
  });
  E.searchInput.addEventListener('input', () => { S.search = E.searchInput.value; renderList(); });
  $('#listMenuBtn').addEventListener('click', event => {
    event.stopPropagation();
    if (E.menu.classList.contains('show')) return closeMenu();
    openMenu(event.currentTarget, `<button type="button" data-m="settings">${ic('sliders')}<span>إعدادات الدردشة</span></button><button type="button" data-m="refresh">${ic('refresh')}<span>تحديث</span></button><button type="button" data-m="select">${ic('check')}<span>تحديد وحذف محادثات</span></button><a href="profile.html">${ic('user')}<span>ملفي الشخصي</span></a><a href="index.html">${ic('home')}<span>الرئيسية</span></a>`);
  });
  E.menu.addEventListener('click', event => {
    const item = event.target.closest('[data-m]'); if (!item) return;
    closeMenu();
    if (item.dataset.m === 'settings') settingsSheet(); else if (item.dataset.m === 'refresh') { toast('جارٍ التحديث…'); void reconcile(); } else if (item.dataset.m === 'select') { if (!S.convs.length) toast('لا توجد محادثات خاصة للحذف'); else enterSelect(null); }
  });
  $('#navAi').addEventListener('click', () => {
    try {
      const url = new URL('https://rtl-pulse-chat.lovable.app/');
      url.searchParams.set('first_name', stored.first || ''); url.searchParams.set('father_name', stored.father || ''); url.searchParams.set('family_name', stored.last || '');
      const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; url.searchParams.set('theme', theme);
      if (typeof window.NabdAndroid?.openNativeChatViewer === 'function') window.NabdAndroid.openNativeChatViewer(url.toString(), 'AI', theme); else window.open(url.toString(), '_blank', 'noopener,noreferrer');
    } catch (error) { toast('تعذر فتح الصفحة الآن'); }
  });

  /* ───────── مزامنة الاستخدام وOneSignal ───────── */
  async function syncOneSignal() {
    const os = window.OneSignal || window.Capacitor?.Plugins?.OneSignal; if (!os || !S.uid) return;
    try {
      const appId = window.NABD_ONESIGNAL_APP_ID || document.querySelector('meta[name="onesignal-app-id"]')?.content || '';
      if (appId && typeof os.initialize === 'function') await os.initialize(appId);
      if (typeof os.login === 'function') await os.login(String(S.uid));
      const userApi = os.User || os.user || null, subscription = userApi?.pushSubscription || os.pushSubscription || null;
      const osId = typeof userApi?.getOnesignalId === 'function' ? await userApi.getOnesignalId() : typeof userApi?.getOneSignalId === 'function' ? await userApi.getOneSignalId() : (userApi?.onesignalId || userApi?.id || null);
      const subId = typeof subscription?.getIdAsync === 'function' ? await subscription.getIdAsync() : typeof subscription?.getId === 'function' ? await subscription.getId() : (subscription?.id || null);
      const id = osId || subId; if (!id) return;
      const now = new Date().toISOString();
      await sb.from('user_push_subscriptions').upsert({ user_id: S.uid, onesignal_id: id, subscription_id: subId || null, platform: window.Capacitor?.getPlatform?.() || 'web', last_seen_at: now, updated_at: now }, { onConflict: 'user_id,onesignal_id' });
    } catch (error) { console.warn('تعذر مزامنة OneSignal', error); }
  }
  function usagePulse() {
    if (document.visibilityState !== 'visible' || !S.uid) return;
    try {
      const student = readJSON('nabd_v3_student', {}) || {}, now = Date.now(), today = new Date().toISOString().slice(0, 10);
      if (student.usageDay !== today) { student.usageDay = today; student.dailyUsageMinutes = 0; }
      const prev = student.lastUsageAt ? new Date(student.lastUsageAt).getTime() : now;
      const elapsed = Math.max(0, Math.min(5, (now - prev) / 60000));
      if (elapsed >= 0.5) student.dailyUsageMinutes = Number(student.dailyUsageMinutes || 0) + elapsed;
      student.lastUsageAt = new Date(now).toISOString();
      writeJSON('nabd_v3_student', student);
      void sb.from('student_profiles').update({ last_usage_at: student.lastUsageAt, daily_usage_minutes: Number(student.dailyUsageMinutes || 0), usage_day: today }).eq('user_id', S.uid);
    } catch (error) { /* غير حرج */ }
  }

  /* ───────── لوحة المفاتيح والارتفاع ───────── */
  if (window.visualViewport) {
    const fit = () => { document.documentElement.style.setProperty('--app-h', `${visualViewport.height}px`); window.scrollTo(0, 0); if (S.atBottom && S.view.type !== 'list') scrollBottom(false); };
    visualViewport.addEventListener('resize', fit); fit();
  }

  /* ───────── الإقلاع ───────── */
  async function boot() {
    if (!sb) { E.convList.innerHTML = `<div class="empty">${ic('alert')}<b>تعذر تحميل الخدمة</b><span>تحقق من الاتصال ثم أعد فتح الصفحة.</span></div>`; return; }
    let routedEarly = false;
    loadCache(); renderList(); if (S.uid) { route(); routedEarly = true; }
    requestAnimationFrame(() => { window.nabdNativeReady?.(); setTimeout(() => window.nabdNativeReady?.(), 450); });
    let session = null;
    for (let attempt = 0; attempt < 4 && !session; attempt += 1) {
      const { data } = await sb.auth.getSession(); session = data?.session || null;
      if (!session && attempt < 3) await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!session) { location.replace('auth.html'); return; }
    if (S.uid && S.uid !== session.user.id) { S.convs = []; S.pub.msgs = []; S.pub.loaded = false; }
    S.uid = session.user.id; localStorage.setItem(LS.uid, S.uid);
    seenAt = localStorage.getItem(LS.seen + S.uid) || '';
    sb.auth.onAuthStateChange((event, next) => { if (event === 'SIGNED_OUT' || !next) location.replace('auth.html'); });

    if (!routedEarly) route();
    try { startRealtime(); } catch (e) { console.warn(e); }
    await Promise.allSettled([
      loadConvs().then(() => renderList()), loadLatest(S.pub, { silent: S.pub.loaded }), loadPlatform(), loadSettings(), loadRequests(), ensureMyThumb(),
      rpc('chat_can_moderate').then(v => { S.canMod = v === true; }).catch(() => { S.canMod = false; })
    ]);
    if (!seenAt && S.pub.msgs.length) markPublicSeen();
    renderList();
    // روابط من بوابة الإدارة: chat.html?dm=<id> يفتح محادثة خاصة، و?profile=<id> يفتح الملف الشخصي
    try {
      const q = new URLSearchParams(location.search), pu = q.get('profile'), du = q.get('dm');
      if (pu || du) {
        history.replaceState(null, '', location.pathname + location.hash);
        if (du) location.hash = `#/u/${encodeURIComponent(du)}`; else void profileSheet(pu);
      }
    } catch { /* رابط غير صالح: نتجاهله */ }
    void syncOneSignal(); usagePulse(); setInterval(usagePulse, 60000);
  }
  boot().catch(error => { console.error('تعذر تشغيل الدردشة', error); toast('تعذر تشغيل الدردشة'); });
})();
