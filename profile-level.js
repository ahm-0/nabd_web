/* شريط مستوى الطالب + نافذة «كيف تجمع النقاط؟» + مشاركة التطبيق */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const NAMES = ['مبتدئ', 'نشيط', 'مجتهد', 'متفوق', 'محترف', 'خبير', 'نخبة', 'أسطورة'];
  const lvl = t => Math.floor(Math.sqrt(t / 30)) + 1, need = l => 30 * l * l;
  const SHARE_TEXT = `🚀 تطبيق نبض التفوق – رفيقك الأول نحو النجاح!
هل أنت طالب تاسع، بكالوريا، أو جامعة؟ تطبيق نبض التفوق يجمع لك كل ما تحتاجه لتنظيم دراستك، متابعة عداد الامتحانات، التفاعل مع زملائك، والمنافسة على الصدارة!
📲 حمّل التطبيق الآن من متجر Google Play:
https://play.google.com/store/apps/details?id=com.nabdaltawafuq.app
🌐 أو إذا كان المتجر لا يعمل لديك، يمكنك التحميل مباشرة من موقعنا:
https://nabd0.github.io/app/`;
  const toast = m => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); };
  async function loadLevel() {
    const c = window.nabdSupabase; if (!c) return;
    try {
      const { data: s } = await c.auth.getSession(); if (!s?.session) return;
      const { data } = await c.rpc('points_my_stats'); const m = Array.isArray(data) ? data[0] : data; const total = m?.total || 0, l = lvl(total);
      $('#pfLvlNum').textContent = l; $('#pfLvlName').textContent = `المستوى ${l} · ${NAMES[Math.min(l - 1, NAMES.length - 1)]}`;
      $('#pfLvlPts').textContent = `${total} نقطة` + (m?.rank ? ` · الترتيب #${m.rank}` : '');
      const lo = need(l - 1), hi = need(l); $('#pfLvlBar').style.width = Math.min(100, ((total - lo) / (hi - lo)) * 100) + '%';
      $('#pfLvlNext').textContent = `باقي ${hi - total} نقطة للوصول إلى المستوى ${l + 1}`;
    } catch { /* صامت */ }
  }
  async function shareApp() {
    try { if (window.NabdAndroid?.shareText) { window.NabdAndroid.shareText(SHARE_TEXT); return; } } catch { /* تابع */ }
    try { if (navigator.share) { await navigator.share({ text: SHARE_TEXT }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(SHARE_TEXT); toast('تم نسخ نص المشاركة، الصقه في أي تطبيق.'); } catch { toast('تعذر فتح المشاركة.'); }
  }
  function openHow() {
    const modal = $('#modalContent'), backdrop = $('#modalBackdrop'); if (!modal || !backdrop) return;
    modal.innerHTML = `<div class="modal-head"><div><span class="eyebrow">النقاط</span><h3>كيف تجمع النقاط؟</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div>
      <div class="pts-sheet"><p class="pts-sub">أنجز المهام التالية لترفع مستواك وتصعد في لوحة الصدارة:</p>
      <ul class="pts-list">
        <li><i class="fa-solid fa-comments"></i><span>المشاركة في الدردشة العامة.</span></li>
        <li><i class="fa-solid fa-heart"></i><span>التفاعل في الدردشة، والتفاعل والتعليق على منشورات قسم الأخبار.</span></li>
        <li><i class="fa-solid fa-hourglass-half"></i><span>مشاركة عداد الامتحان.</span></li>
        <li class="big"><i class="fa-solid fa-share-nodes"></i><span><b>المساهمة في نشر التطبيق:</b> شارك رابط تحميل التطبيق في 10 مجموعات واتساب + مع 10 من أصدقائك + في 10 قنوات تليجرام، لتحصل على <em>50 نقطة</em> (بشرط أن تجذب هذه المشاركات عمليات تحميل فعلية للتطبيق).</span></li>
      </ul><button type="button" class="pts-share" id="ptsShareApp"><i class="fa-solid fa-share-nodes"></i> مشاركة التطبيق</button></div>`;
    document.body.classList.add('sheet-open'); backdrop.classList.add('show');
    $('#ptsShareApp')?.addEventListener('click', shareApp);
  }
  document.addEventListener('click', e => { if (e.target.closest('#pfHowPoints')) openHow(); });
  window.addEventListener('load', () => setTimeout(loadLevel, 600));
})();
