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
    const P = window.nabdPoints;
    try { if (window.NabdAndroid?.shareText) { const w = P?.awardOnShareLeave('app_share'); try { await window.NabdAndroid.shareText(SHARE_TEXT); } catch (e) { w?.cancel(); } return; } } catch { /* تابع */ }
    try { if (navigator.share) { await navigator.share({ text: SHARE_TEXT }); P?.award('app_share'); return; } } catch (e) { return; /* إلغاء المشاركة = لا نقاط */ }
    try { await navigator.clipboard.writeText(SHARE_TEXT); toast('تم نسخ نص المشاركة، الصقه في أي تطبيق.'); } catch { toast('تعذر فتح المشاركة.'); }
  }
  function openHow() {
    const modal = $('#modalContent'), backdrop = $('#modalBackdrop'); if (!modal || !backdrop) return;
    modal.innerHTML = `<div class="modal-head"><div><span class="eyebrow">النقاط</span><h3>كيف تجمع النقاط؟</h3></div><button class="close-modal" aria-label="إغلاق">×</button></div>
      <div class="pts-sheet"><p class="pts-sub">اضغط على أي مهمة لتنتقل إليها مباشرة:</p>
      <section class="pt-how"><div class="pt-how-grid-wrap"><div class="pt-how-grid"><a href="chat.html"><i class="fa-solid fa-comments"></i> المشاركة في الدردشة العامة <em>+1</em></a><a href="chat.html"><i class="fa-solid fa-heart"></i> التفاعل في الدردشة <em>+1</em></a><a href="news.html"><i class="fa-solid fa-message"></i> التعليق على منشورات الأخبار <em>+3</em></a><a href="news.html"><i class="fa-solid fa-thumbs-up"></i> التفاعل مع منشورات الأخبار <em>+1</em></a><a href="exam-countdown.html"><i class="fa-solid fa-share-nodes"></i> مشاركة عداد الامتحان <em>+10</em></a><a href="tests.html"><i class="fa-solid fa-clipboard-check"></i> إنهاء اختبار <em>+10</em></a><a href="index.html"><i class="fa-solid fa-door-open"></i> فتح التطبيق يوميًا <em>+5</em></a></div></div><a class="pts-big" href="#" id="ptsShareBig"><i class="fa-solid fa-share-nodes"></i><span><b>المساهمة في نشر التطبيق:</b> شارك رابط تحميل التطبيق في 10 مجموعات واتساب + مع 10 من أصدقائك + في 10 قنوات تليجرام، لتحصل على <em>+50 نقطة</em> (بشرط أن تجذب هذه المشاركات عمليات تحميل فعلية للتطبيق).</span></a></section><button type="button" class="pts-share" id="ptsShareApp"><i class="fa-solid fa-share-nodes"></i> مشاركة التطبيق</button></div>`;
    document.body.classList.add('sheet-open'); backdrop.classList.add('show');
    $('#ptsShareApp')?.addEventListener('click', shareApp);
    $('#ptsShareBig')?.addEventListener('click', e => { e.preventDefault(); shareApp(); });
  }
  document.addEventListener('click', e => { if (e.target.closest('#pfHowPoints')) openHow(); });
  window.addEventListener('load', () => setTimeout(loadLevel, 600));
})();
