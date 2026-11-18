/* تفاعلات إيموجي على رسائل الدعم (للطالب وللمشرف). الضغط المطوّل أو النقر المزدوج على فقاعة يفتح شريط التفاعلات.
   تُحفظ في الخادم عند توفره (support_react)، وإلا محلياً على الجهاز. */
(() => {
  'use strict';
  const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const store = { thread: null, client: null, myId: null, onReply: null, map: {} }; // map[mid] = [{emoji,user}]
  const LS = 'nabd_support_reactions';
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const writeLocal = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch { /* تجاهل */ } };

  const bubbleOf = el => el.querySelector(':scope > .wc-bubble, :scope > div') || el;
  function paint() {
    document.querySelectorAll('[data-mid]').forEach(msg => {
      const host = bubbleOf(msg); host.querySelector(':scope > .wc-rx')?.remove();
      const list = store.map[msg.dataset.mid] || []; if (!list.length) return;
      const counts = {}; list.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
      const chip = document.createElement('div'); chip.className = 'wc-rx';
      chip.innerHTML = Object.entries(counts).map(([e, n]) => `<span class="${list.some(r => r.emoji === e && r.user === store.myId) ? 'is-mine' : ''}">${e}${n > 1 ? `<b>${n}</b>` : ''}</span>`).join('');
      host.appendChild(chip);
    });
  }
  async function load() {
    const local = readLocal(); store.map = {};
    Object.entries(local).forEach(([mid, emoji]) => { store.map[mid] = [{ emoji, user: store.myId }]; });
    if (store.client && store.thread) {
      try {
        const { data, error } = await store.client.rpc('support_get_reactions', { p_thread_id: store.thread });
        if (!error && Array.isArray(data)) { store.map = {}; data.forEach(r => { (store.map[r.message_id] ||= []).push({ emoji: r.emoji, user: r.user_id }); }); }
      } catch { /* نبقى على المحلي */ }
    }
    paint();
  }
  async function react(mid, emoji) {
    const list = store.map[mid] || []; const mine = list.find(r => r.user === store.myId);
    const next = mine && mine.emoji === emoji ? null : emoji;
    store.map[mid] = list.filter(r => r.user !== store.myId).concat(next ? [{ emoji: next, user: store.myId }] : []); paint();
    let saved = false;
    if (store.client) { try { const { error } = await store.client.rpc('support_react', { p_message_id: mid, p_emoji: emoji }); saved = !error; } catch { /* محلي */ } }
    if (!saved) { const local = readLocal(); if (next) local[mid] = next; else delete local[mid]; writeLocal(local); }
  }
  let picker = null;
  const closePicker = () => { picker?.remove(); picker = null; };
  function openPicker(msg) {
    closePicker();
    picker = document.createElement('div'); picker.className = 'wc-picker'; picker.setAttribute('role', 'toolbar');
    picker.innerHTML = EMOJIS.map(e => `<button type="button" data-rx="${e}" aria-label="تفاعل ${e}">${e}</button>`).join('') + (store.onReply ? '<button type="button" data-rx-reply aria-label="رد"><i class="fa-solid fa-reply"></i></button>' : '');
    document.body.appendChild(picker);
    const r = msg.getBoundingClientRect(); const w = picker.offsetWidth;
    picker.style.top = `${Math.max(70, r.top - 54)}px`; picker.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8)}px`;
    picker.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.rx) void react(msg.dataset.mid, b.dataset.rx); else if (store.onReply) store.onReply(msg);
      closePicker();
    });
  }
  let timer = null, startX = 0, startY = 0;
  document.addEventListener('pointerdown', e => {
    const msg = e.target.closest('[data-mid]:not([data-mid=""])'); if (!msg || e.target.closest('.wc-picker')) { if (!e.target.closest('.wc-picker')) closePicker(); return; }
    startX = e.clientX; startY = e.clientY; clearTimeout(timer); timer = setTimeout(() => openPicker(msg), 450);
  });
  document.addEventListener('pointermove', e => { if (timer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) { clearTimeout(timer); timer = null; } });
  ['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { clearTimeout(timer); timer = null; }));
  document.addEventListener('dblclick', e => { const msg = e.target.closest('[data-mid]:not([data-mid=""])'); if (msg) openPicker(msg); });
  document.addEventListener('contextmenu', e => { if (e.target.closest('[data-mid]')) e.preventDefault(); });
  window.addEventListener('scroll', closePicker, true);

  window.NabdSupportReactions = {
    configure(opts = {}) { Object.assign(store, { client: opts.client ?? store.client, thread: opts.thread ?? store.thread, myId: opts.myId ?? store.myId, onReply: opts.onReply ?? store.onReply }); return load(); },
    refresh: paint
  };
})();
