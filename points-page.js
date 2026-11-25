(() => {
  'use strict';
  const $ = s => document.querySelector(s); const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NAMES = ['مبتدئ', 'نشيط', 'مجتهد', 'متفوق', 'محترف', 'خبير', 'نخبة', 'أسطورة'];
  const lvl = t => Math.floor(Math.sqrt(t / 30)) + 1;
  const lvlName = l => NAMES[Math.min(l - 1, NAMES.length - 1)];
  const need = l => 30 * l * l;
  const ava = p => p?.avatar_thumb && /^(data:|https?:)/.test(p.avatar_thumb) ? `<span class="pt-av"><img src="${esc(p.avatar_thumb)}" alt=""></span>` : `<span class="pt-av">${esc((p?.first_name || '؟').charAt(0))}</span>`;
  const nm = p => p ? [p.first_name, p.family_name].filter(Boolean).join(' ') || 'طالب' : 'طالب';
  const badge = p => p?.is_verified ? ' <span class="verified-badge" title="موثّق"></span>' : '';
  function paintBoard(rows, prof, uid) {
    const pod = (r, i) => r ? `<div class="pt-pod p${i}" data-uid="${esc(r.user_id)}" style="animation-delay:${i * 90}ms">${i === 1 ? '<span class="crown"><i class="fa-solid fa-crown"></i></span>' : ''}<span class="ring">${ava(prof[r.user_id])}<em class="rk">${i}</em></span><b class="pn">${esc(nm(prof[r.user_id]))}${badge(prof[r.user_id])}</b><div class="blk"><strong>${r.total}</strong><span>نقطة</span><small><i class="fa-regular fa-file-lines"></i> ${lvl(r.total)}</small></div></div>` : '<div></div>';
    window.__ptProf = prof; window.__ptRows = rows;
    $('#ptPodium').innerHTML = pod(rows[2], 3) + pod(rows[0], 1) + pod(rows[1], 2);
    const topT = Math.max(1, rows[0].total);
    $('#ptList').innerHTML = rows.slice(3).map((r, k) => { const i = k + 3; const pr = prof[r.user_id]; return `<div class="pt-row ${r.user_id === uid ? 'me' : ''}" data-uid="${esc(r.user_id)}"><span class="n">${i + 1}</span>${ava(pr)}<span class="nm"><b>${esc(nm(pr))}${badge(pr)}</b><span class="pg"><i class="fa-regular fa-file-lines"></i><u>${lvl(r.total)}</u><s><i style="width:${Math.max(4, Math.round(r.total / topT * 100))}%"></i></s></span></span><span class="sc"><b>${r.total}</b><small>نقطة</small></span></div>`; }).join('') || '<div class="pt-empty">لا مزيد من المتصدرين بعد</div>';
    $('#ptList').closest('.pt-list').querySelector('h3').hidden = true;
  }
  async function run() {
    const c = window.nabdSupabase; if (!c) { $('#ptList').innerHTML = '<div class="pt-empty">تعذر الاتصال.</div>'; return; }
    const { data: s } = await c.auth.getSession(); const uid = s?.session?.user?.id;
    const CK = 'nabd_pt_board_v1';
    try { const cs = JSON.parse(localStorage.getItem(CK) || 'null'); if (cs?.rows?.length && !window.__ptPainted) { window.__ptPainted = true; paintBoard(cs.rows, cs.prof, uid); } } catch { /* لا كاش */ }
    const [me, board] = await Promise.all([c.rpc('points_my_stats'), c.rpc('points_leaderboard', { p_limit: 100 })]);
    const m = Array.isArray(me.data) ? me.data[0] : me.data; const total = m?.total || 0, l = lvl(total);
    $('#ptLvl').textContent = l; $('#ptLvlName').textContent = `المستوى ${l} · ${lvlName(l)}`; $('#ptTotal').textContent = total;
    $('#ptRank').textContent = m?.rank ? `ترتيبك: #${m.rank}` + (m.today ? ` · اليوم +${m.today}` : '') : 'ابدأ بجمع النقاط لتدخل التصنيف';
    const lo = need(l - 1), hi = need(l); requestAnimationFrame(() => { $('#ptBar').style.width = Math.min(100, ((total - lo) / (hi - lo)) * 100) + '%'; });
    $('#ptNext').textContent = `باقي ${hi - total} نقطة للمستوى ${l + 1}`;
    const rows = board.data || [];
    if (board.error || !rows.length) { $('#ptList').innerHTML = `<div class="pt-empty">${board.error ? 'تعذر تحميل لوحة الشرف.' : 'لا يوجد أحد في لوحة الشرف بعد — كن الأول!'}</div>`; $('#ptPodium').innerHTML = ''; return; }
    const prof = {}; const { data: ps } = await c.rpc('chat_get_profiles_v2', { p_user_ids: rows.map(r => r.user_id) }); (ps || []).forEach(p => { prof[p.user_id] = p; });
    paintBoard(rows, prof, uid);
    try { localStorage.setItem('nabd_pt_board_v1', JSON.stringify({ rows: rows.slice(0, 100), prof })); } catch { /* تجاهل */ }
  }
  const sheet = html => { const m = $('#modalContent'), b = $('#modalBackdrop'); if (!m || !b) return; m.innerHTML = '<div class="modal-head"><div><span class="eyebrow">لوحة الشرف</span></div><button class="close-modal" aria-label="إغلاق">×</button></div>' + html; document.body.classList.add('sheet-open'); b.classList.add('show'); };
  $('#hbBack')?.addEventListener('click', () => { if (history.length > 1) history.back(); else location.href = 'index.html'; });
  $('#hbGift')?.addEventListener('click', () => sheet('<div class="pt-prof"><h3>🏆 الجوائز</h3><p class="bio">سيتم توزيع جوائز قيّمة للمتصدرين في تطبيق نبض التفوق.. الكل يشارك!</p></div>'));
  $('#hbHelp')?.addEventListener('click', () => sheet('<div class="pt-prof"><h3>كيف أجمع النقاط؟</h3><p class="bio">أنجز المهام اليومية من ملفك الشخصي، وتفاعل مع الأخبار والدردشة والدروس، وادخل التطبيق كل يوم. كلما زادت نقاطك ارتفع ترتيبك ومستواك.</p><a class="pt-act" href="profile.html"><i class="fa-solid fa-list-check"></i> المهام اليومية</a></div>'));
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-uid]'); if (el) { openUser(el.dataset.uid); return; }
  });
  async function openUser(id) {
    const { data: s } = await window.nabdSupabase.auth.getSession(); const mine = s?.session?.user?.id === id;
    const modal = $('#modalContent'), backdrop = $('#modalBackdrop'); if (!modal || !backdrop) return;
    const p = window.__ptProf?.[id] || {}; const r = (window.__ptRows || []).find(x => x.user_id === id) || {}; const t = r.total || 0, l = lvl(t);
    const bio = p.bio ? esc(p.bio) : 'طالب في نبض التفوق';
    modal.innerHTML = `<div class="modal-head"><div><span class="eyebrow">الملف الشخصي</span></div><button class="close-modal" aria-label="إغلاق">×</button></div><div class="pt-prof">${ava(p)}<h3>${esc(nm(p))}${badge(p)}</h3><div class="st">${esc([p.study_stage, p.province].filter(Boolean).join(' · ') || 'نبض التفوق')}</div><p class="bio">${bio}</p><div class="lv"><span class="b">${l}</span><span><b>المستوى ${l} · ${lvlName(l)}</b><small>${t} نقطة${r.rank ? ' · الترتيب #' + r.rank : ''}</small></span></div>${mine ? '<a class="pt-act" href="profile.html"><i class="fa-solid fa-user"></i> ملفي الشخصي</a>' : `<a class="pt-act" href="chat.html?dm=${encodeURIComponent(id)}"><i class="fa-solid fa-paper-plane"></i> مراسلة في الدردشة الخاصة</a>`}</div>`;
    document.body.classList.add('sheet-open'); backdrop.classList.add('show');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
