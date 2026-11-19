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
  async function run() {
    const c = window.nabdSupabase; if (!c) { $('#ptList').innerHTML = '<div class="pt-empty">تعذر الاتصال.</div>'; return; }
    const { data: s } = await c.auth.getSession(); const uid = s?.session?.user?.id;
    const [me, board] = await Promise.all([c.rpc('points_my_stats'), c.rpc('points_leaderboard', { p_limit: 100 })]);
    const m = Array.isArray(me.data) ? me.data[0] : me.data; const total = m?.total || 0, l = lvl(total);
    $('#ptLvl').textContent = l; $('#ptLvlName').textContent = `المستوى ${l} · ${lvlName(l)}`; $('#ptTotal').textContent = total;
    $('#ptRank').textContent = m?.rank ? `ترتيبك: #${m.rank}` + (m.today ? ` · اليوم +${m.today}` : '') : 'ابدأ بجمع النقاط لتدخل التصنيف';
    const lo = need(l - 1), hi = need(l); requestAnimationFrame(() => { $('#ptBar').style.width = Math.min(100, ((total - lo) / (hi - lo)) * 100) + '%'; });
    $('#ptNext').textContent = `باقي ${hi - total} نقطة للمستوى ${l + 1}`;
    const rows = board.data || [];
    if (board.error || !rows.length) { $('#ptList').innerHTML = `<div class="pt-empty">${board.error ? 'تعذر تحميل المتصدرين.' : 'لا يوجد متصدرون بعد — كن الأول!'}</div>`; $('#ptPodium').innerHTML = ''; return; }
    const prof = {}; const { data: ps } = await c.rpc('chat_get_profiles_v2', { p_user_ids: rows.map(r => r.user_id) }); (ps || []).forEach(p => { prof[p.user_id] = p; });
    const pod = (r, i) => r ? `<div class="pt-pod p${i}" style="animation-delay:${i * 90}ms">${i === 1 ? '<span class="crown">👑</span>' : ''}${ava(prof[r.user_id])}<b>${esc(nm(prof[r.user_id]))}${badge(prof[r.user_id])}</b><span class="sc">${r.total} ⭐</span><span class="lv">م${lvl(r.total)} · ${lvlName(lvl(r.total))}</span></div>` : '<div></div>';
    $('#ptPodium').innerHTML = pod(rows[1], 2) + pod(rows[0], 1) + pod(rows[2], 3);
    $('#ptList').innerHTML = rows.map((r, i) => `<div class="pt-row ${r.user_id === uid ? 'me' : ''}"><span class="n">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>${ava(prof[r.user_id])}<span class="nm"><b>${esc(nm(prof[r.user_id]))}${badge(prof[r.user_id])}</b><small>${esc(prof[r.user_id]?.study_stage || '')} · مستوى ${lvl(r.total)}</small></span><span class="sc">${r.total}</span></div>`).join('');
  }
  window.addEventListener('load', () => setTimeout(run, 400));
})();
